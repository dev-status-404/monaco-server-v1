import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import Deposit from "../models/deposits.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import { sequelize } from "../config/db.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { walletIntegrationService } from "./walletIntegrationService.js";
import { transactionService } from "./transaction.service.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const normalizeDepositAmount = ({ amount, amountSats }) => {
  const rawValue = amount ?? amountSats;
  const numericAmount = Number(rawValue);

  if (!Number.isFinite(numericAmount) || numericAmount < 1) {
    throw createError(400, "invalid-amount");
  }

  return numericAmount;
};

const ensureWalletAccount = async ({ userId, transaction }) => {
  let walletAccount = await WalletAccount.findOne({
    where: { user_id: userId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (walletAccount) {
    return walletAccount;
  }

  walletAccount = await WalletAccount.create(
    {
      user_id: userId,
      balance: 0,
      currency: "USD",
      status: "active",
    },
    { transaction },
  );

  return walletAccount;
};

const createDeposit = async (data) => {
  const deposit = await Deposit.create(data);

  if (!deposit) {
    throw createError(400, "deposit-creation-failed");
  }

  emitToUserAndAdmins(deposit.user_id, "deposit:created", {
    type: "deposit",
    action: "created",
    depositId: deposit.id,
    userId: deposit.user_id,
    status: deposit.status,
    data: deposit,
  });

  await notificationService.createForUserAndAdmins({
    userId: deposit.user_id,
    type: "deposit",
    title: "Deposit created",
    message: `Deposit request for ${deposit.amount} is created.`,
    meta: {
      depositId: deposit.id,
      status: deposit.status,
    },
  });

  return {
    success: true,
    data: deposit,
    message: "deposit-created",
    code: 201,
  };
};

const getDeposits = async (q) => {
  const { user_id, game_id, provider, status, page = 1, limit = 10, id } = q;

  let where = {};
  if (user_id) where.user_id = user_id;
  if (game_id) where.game_id = game_id;
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (id) where.id = id;

  const { rows: deposits, count } = await Deposit.findAndCountAll({
    where,
    offset: (parseInt(page) - 1) * parseInt(limit),
    limit: parseInt(limit),
    include: [
      {
        association: "user",
        attributes: ["id", "email", "firstName", "lastName"],
      },
      // OPTIONAL: only if you add Deposit.belongsTo(Game, { as: "game", foreignKey: "game_id" })
      {
        association: "game",
        attributes: ["id", "name", "status"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!deposits) throw createError(400, "not-found");

  return {
    success: true,
    data: {
      deposits,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "deposits-retrieved",
    code: 200,
  };
};

const updateDeposit = async (id, data) => {
  const tx = await sequelize.transaction();

  try {
    const existingDeposit = await Deposit.findByPk(id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!existingDeposit) {
      throw createError(404, "deposit-not-found");
    }

    const nextStatus = data.status ?? existingDeposit.status;
    const shouldTrigger = walletIntegrationService.shouldTriggerDepositReceive(
      existingDeposit.status,
      nextStatus,
    );

    const [updatedCount] = await Deposit.update(data, {
      where: { id },
      transaction: tx,
    });

    if (!updatedCount) {
      throw createError(400, "deposit-update-failed");
    }

    const updatedDeposit = await Deposit.findByPk(id, { transaction: tx });

    if (shouldTrigger) {
      const walletAccount = await ensureWalletAccount({
        userId: updatedDeposit.user_id,
        transaction: tx,
      });

      const idempotencyKey = walletIntegrationService.buildIdempotencyKey({
        entityType: "deposit",
        entityId: updatedDeposit.id,
        status: nextStatus,
      });

      let walletTransaction = await WalletTransaction.findOne({
        where: { idempotency_key: idempotencyKey },
        transaction: tx,
      });

      if (!walletTransaction) {
        walletTransaction = await WalletTransaction.create(
          {
            wallet_account_id: walletAccount.id,
            type: "deposit",
            direction: "credit",
            amount: updatedDeposit.amount,
            status: "pending",
            api_status: "pending",
            reference_type: "deposit",
            reference_id: updatedDeposit.id,
            user_id: updatedDeposit.user_id,
            game_id: updatedDeposit.game_id,
            game_name: updatedDeposit.game_name,
            idempotency_key: idempotencyKey,
            meta: {
              provider: "PointsMate",
              stage: "approval",
              targetStatus: nextStatus,
            },
          },
          { transaction: tx },
        );
      }

      const providerResponse = await walletIntegrationService.createReceiveRequest({
        accountId: walletAccount.id,
        type: updatedDeposit.provider,
        amount: updatedDeposit.amount,
        memo: `Deposit ${updatedDeposit.id}`,
        referenceId: `deposit:${updatedDeposit.id}`,
        idempotencyKey,
      });

      await walletTransaction.update(
        {
          status: "completed",
          api_status: "SUCCESS",
          meta: {
            ...(walletTransaction.meta || {}),
            providerResponse,
          },
        },
        { transaction: tx },
      );
    }

    await tx.commit();

    emitToUserAndAdmins(updatedDeposit.user_id, "deposit:updated", {
      type: "deposit",
      action: "updated",
      depositId: updatedDeposit.id,
      userId: updatedDeposit.user_id,
      status: updatedDeposit.status,
      data: updatedDeposit,
    });

    await notificationService.createForUserAndAdmins({
      userId: updatedDeposit.user_id,
      type: "deposit",
      title: "Deposit updated",
      message: `Deposit ${updatedDeposit.id} is now ${updatedDeposit.status}.`,
      meta: {
        depositId: updatedDeposit.id,
        status: updatedDeposit.status,
      },
    });

    return {
      success: true,
      data: updatedDeposit,
      message: "deposit-updated",
      code: 200,
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const deleteDeposit = async (id) => {
  const deposit = await Deposit.destroy({ where: { id } });
  if (!deposit) throw createError(404, "not-found");

  return {
    success: true,
    data: deposit,
    message: "deposit-deleted",
    code: 200,
  };
};

const depositFunds = async ({ userId, amount, amountSats, type, memo, referenceId, gameId, gameName }) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  const normalizedType = String(type || "").toLowerCase();
  if (!["lightning", "onchain", "on-chain"].includes(normalizedType)) {
    throw createError(400, "invalid-receive-type");
  }

  const numericAmount = normalizeDepositAmount({ amount, amountSats });

  const safeReferenceId = referenceId || uuidv4();
  const tx = await sequelize.transaction();

  try {
    const existing = await WalletTransaction.findOne({
      where: { idempotency_key: safeReferenceId },
      transaction: tx,
    });

    if (existing) {
      throw createError(409, "duplicate-reference-id");
    }

    const walletTx = await WalletTransaction.create(
      {
        wallet_account_id: userContext.wallet.id,
        user_id: userId,
        type: "deposit",
        direction: "credit",
        amount: (numericAmount / 100000000).toFixed(8),
        status: "pending",
        api_status: "pending",
        reference_type: "pointsmate_receive",
        game_id: gameId || null,
        game_name: gameName || null,
        idempotency_key: safeReferenceId,
        meta: {
          memo,
          amount: String(numericAmount),
          amountSats: String(numericAmount),
        },
      },
      { transaction: tx },
    );

    const provider = await pointsmateClient.createReceive({
      accountId: userContext.accountId,
      type: normalizedType.includes("on") ? "onchain" : "lightning",
      amountSats: numericAmount,
      memo,
      referenceId: safeReferenceId,
    });

    await walletTx.update(
      {
        api_status: "created",
        meta: {
          ...(walletTx.meta || {}),
          providerTransactionId: provider.transactionId,
          providerResponse: provider,
          address: provider.address,
          magicLink: provider.magicLink,
          magicLinkExpiresAt: provider.magicLinkExpiresAt,
          amountUsd: provider.amountUsd,
          amount: provider.amountSats || String(numericAmount),
          amountSats: provider.amountSats || String(numericAmount),
        },
      },
      { transaction: tx },
    );

    await tx.commit();

    const txPayload = walletTx.get({ plain: true });
    emitToUserAndAdmins(userId, "deposit:updated", {
      type: "deposit",
      action: "initiated",
      transactionId: txPayload.id,
      userId,
      status: txPayload.status,
      api_status: "created",
      data: {
        ...txPayload,
        address: provider.address,
        magic_link: provider.magicLink,
      },
    });

    await notificationService.createForUserAndAdmins({
      userId,
      type: "deposit",
      title: "Deposit initiated",
      message: `Deposit transaction ${txPayload.id} is initiated.`,
      meta: {
        transactionId: txPayload.id,
        status: txPayload.status,
        api_status: "created",
      },
    });

    return {
      transactionId: walletTx.id,
      pmTransactionId: provider.transactionId,
      address: provider.address,
      magic_link: provider.magicLink,
      magicLink: provider.magicLink,
      magic_link_expires_at: provider.magicLinkExpiresAt,
      magicLinkExpiresAt: provider.magicLinkExpiresAt,
      amount: provider.amountSats || String(numericAmount),
      amount_usd: provider.amountUsd,
      amountUsd: provider.amountUsd,
      status: "PENDING",
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const depositService = {
  createDeposit,
  getDeposits,
  updateDeposit,
  deleteDeposit,
  depositFunds,
};
