import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import Deposit from "../models/deposits.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import { sequelize } from "../config/db.js";
import config from "../config/env.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { tierlockClient } from "../config/tierlockClient.js";
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

  const where = {};
  if (user_id) where.user_id = user_id;
  if (game_id) where.game_id = game_id;
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (id) where.id = id;

  const { rows: deposits, count } = await Deposit.findAndCountAll({
    where,
    offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    limit: parseInt(limit, 10),
    include: [
      {
        association: "user",
        attributes: ["id", "email", "firstName", "lastName"],
      },
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
    const terminalStatuses = new Set(["confirmed", "approved", "completed"]);
    const shouldCredit =
      !terminalStatuses.has(String(existingDeposit.status || "").toLowerCase()) &&
      terminalStatuses.has(String(nextStatus || "").toLowerCase());

    const [updatedCount] = await Deposit.update(data, {
      where: { id },
      transaction: tx,
    });

    if (!updatedCount) {
      throw createError(400, "deposit-update-failed");
    }

    const updatedDeposit = await Deposit.findByPk(id, { transaction: tx });

    if (shouldCredit) {
      const walletAccount = await ensureWalletAccount({
        userId: updatedDeposit.user_id,
        transaction: tx,
      });

      const idempotencyKey = `manual-deposit:${updatedDeposit.id}:${nextStatus}`;

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
            status: "completed",
            api_status: "SUCCESS",
            reference_type: "deposit",
            reference_id: updatedDeposit.id,
            user_id: updatedDeposit.user_id,
            game_id: updatedDeposit.game_id,
            game_name: updatedDeposit.game_name,
            idempotency_key: idempotencyKey,
            meta: {
              provider: "manual",
              stage: "approval",
              targetStatus: nextStatus,
            },
          },
          { transaction: tx },
        );
      }

      await walletTransaction.update(
        {
          status: "completed",
          api_status: "SUCCESS",
        },
        { transaction: tx },
      );

      await walletAccount.increment("balance", {
        by: Number(updatedDeposit.amount),
        transaction: tx,
      });
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

const depositFunds = async ({
  userId,
  amount,
  amountSats,
  type,
  paymentChannel,
  memo,
  referenceId,
  gameId,
  gameName,
}) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  const numericAmount = normalizeDepositAmount({ amount, amountSats });
  const normalizedType = String(type || "").toLowerCase();
  const normalizedChannel = String(paymentChannel || "").toLowerCase();
  const useTierlock =
    normalizedChannel === "tierlock" || normalizedType === "tierlock";
  const orderId =
    referenceId || `ORD-DEPOSIT-${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const tx = await sequelize.transaction();

  try {
    const existing = await WalletTransaction.findOne({
      where: { idempotency_key: orderId },
      transaction: tx,
    });

    if (existing) {
      throw createError(409, "duplicate-reference-id");
    }

    let walletTx;
    let provider;

    if (useTierlock) {
      walletTx = await WalletTransaction.create(
        {
          wallet_account_id: userContext.wallet.id,
          user_id: userId,
          type: "deposit",
          direction: "credit",
          amount: numericAmount,
          status: "pending",
          api_status: "pending",
          reference_type: "tierlock_checkout",
          game_id: gameId || null,
          game_name: gameName || null,
          idempotency_key: orderId,
          meta: {
            provider: "Tierlock",
            memo,
            amountUsd: String(numericAmount),
            orderId,
            paymentChannel: paymentChannel || type || null,
          },
        },
        { transaction: tx },
      );

      provider = await tierlockClient.generateCheckoutLink({
        displayName: config.tierlock.displayName,
        total: numericAmount,
        orderId,
      });

      await walletTx.update(
        {
          api_status: "checkout_created",
          meta: {
            ...(walletTx.meta || {}),
            provider: "Tierlock",
            providerResponse: provider,
            linkKey: provider.link_key || null,
            paymentUrl: provider.payment_url,
            checkoutExpiresIn: provider.expires_in || null,
            amountUsd: String(numericAmount),
            orderId,
          },
        },
        { transaction: tx },
      );
    } else {
      if (!["lightning", "onchain", "on-chain"].includes(normalizedType)) {
        throw createError(400, "invalid-receive-type");
      }

      walletTx = await WalletTransaction.create(
        {
          wallet_account_id: userContext.wallet.id,
          user_id: userId,
          type: "deposit",
          direction: "credit",
          amount: numericAmount,
          status: "pending",
          api_status: "pending",
          reference_type: "pointsmate_receive",
          game_id: gameId || null,
          game_name: gameName || null,
          idempotency_key: orderId,
          meta: {
            memo,
            amountUsd: String(numericAmount),
            amountSats: String(numericAmount),
          },
        },
        { transaction: tx },
      );

      provider = await pointsmateClient.createReceive({
        accountId: userContext.accountId,
        type: normalizedType.includes("on") ? "onchain" : "lightning",
        amount: numericAmount,
        memo,
        referenceId: orderId,
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
            amountUsd: provider.amountUsd ?? String(numericAmount),
            amountSats: provider.amountSats || String(numericAmount),
          },
        },
        { transaction: tx },
      );
    }

    await tx.commit();

    const txPayload = walletTx.get({ plain: true });
    emitToUserAndAdmins(userId, "deposit:updated", {
      type: "deposit",
      action: "initiated",
      transactionId: txPayload.id,
      userId,
      status: txPayload.status,
      api_status: useTierlock ? "checkout_created" : "created",
      data: {
        ...txPayload,
        ...(useTierlock
          ? {
              payment_url: provider.payment_url,
              order_id: orderId,
            }
          : {
              address: provider.address,
              magic_link: provider.magicLink,
            }),
      },
    });

    await notificationService.createForUserAndAdmins({
      userId,
      type: "deposit",
      title: useTierlock ? "Deposit checkout created" : "Deposit initiated",
      message: useTierlock
        ? `Deposit transaction ${txPayload.id} is awaiting Tierlock payment completion.`
        : `Deposit transaction ${txPayload.id} is initiated.`,
      meta: {
        transactionId: txPayload.id,
        status: txPayload.status,
        api_status: useTierlock ? "checkout_created" : "created",
        ...(useTierlock ? { orderId } : {}),
      },
    });

    if (useTierlock) {
      return {
        transactionId: walletTx.id,
        order_id: orderId,
        orderId,
        link_key: provider.link_key,
        payment_url: provider.payment_url,
        paymentUrl: provider.payment_url,
        expires_in: provider.expires_in,
        amount: String(numericAmount),
        amount_usd: String(numericAmount),
        amountUsd: String(numericAmount),
        status: "PENDING",
      };
    }

    return {
      transactionId: walletTx.id,
      pmTransactionId: provider.transactionId,
      address: provider.address,
      magic_link: provider.magicLink,
      magicLink: provider.magicLink,
      magic_link_expires_at: provider.magicLinkExpiresAt,
      magicLinkExpiresAt: provider.magicLinkExpiresAt,
      amount: provider.amountUsd ?? String(numericAmount),
      amount_usd: provider.amountUsd ?? String(numericAmount),
      amountUsd: provider.amountUsd ?? String(numericAmount),
      amountSats: provider.amountSats,
      status: "PENDING",
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const getDepositedGames = async (userId) => {
  if (!userId) throw createError(400, "user_id-required");

  const rows = await WalletTransaction.findAll({
    where: {
      user_id: userId,
      game_id: { [Op.ne]: null },
      [Op.or]: [
        { direction: "credit", status: "completed" },
        { direction: "debit", status: { [Op.in]: ["pending", "completed"] } },
      ],
    },
    attributes: ["game_id", "game_name", "direction", "amount"],
    raw: true,
  });

  const gameMap = new Map();
  for (const row of rows) {
    const gid = row.game_id;
    if (!gameMap.has(gid)) {
      gameMap.set(gid, { id: gid, name: row.game_name ?? gid, net: 0 });
    }
    const entry = gameMap.get(gid);
    const amt = Number(row.amount) || 0;
    if (row.direction === "credit") {
      entry.net += amt;
    } else {
      entry.net -= amt;
    }
  }

  const games = Array.from(gameMap.values())
    .filter((g) => g.net >= 1)
    .map(({ id, name }) => ({ id, name }));

  return {
    success: true,
    data: games,
    message: "deposited-games-retrieved",
    code: 200,
  };
};

export const depositService = {
  createDeposit,
  getDeposits,
  updateDeposit,
  deleteDeposit,
  depositFunds,
  getDepositedGames,
};
