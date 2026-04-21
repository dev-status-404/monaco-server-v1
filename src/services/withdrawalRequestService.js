import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import config from "../config/env.js";
import { WithdrawalRequest } from "../models/associations.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { sequelize } from "../config/db.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { walletIntegrationService } from "./walletIntegrationService.js";
import { transactionService } from "./transaction.service.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const normalizeDestination = (payload = {}) => {
  const rawValue = payload.destination ?? payload.address;
  return String(rawValue ?? "").trim();
};

const buildWithdrawalPayload = (payload = {}) => {
  const { address, ...rest } = payload;
  const destination = normalizeDestination(payload);

  return {
    ...rest,
    destination,
  };
};

const createWithdrawalRequest = async (data) => {
  const payload = buildWithdrawalPayload(data);

  if (!payload.destination) {
    throw createError(400, "withdrawal-destination-required");
  }

  const user = await WithdrawalRequest.create(payload, {
    returning: true,
  });

  if (!user) {
    throw createError(400, "withdrawal-request-failed");
  }

  emitToUserAndAdmins(user.user_id, "withdrawal:created", {
    type: "withdrawal",
    action: "created",
    withdrawalId: user.id,
    userId: user.user_id,
    status: user.status,
    data: user,
  });

  await notificationService.createForUserAndAdmins({
    userId: user.user_id,
    type: "withdrawal",
    title: "Withdrawal request created",
    message: `Withdrawal request ${user.id} has been created.`,
    meta: {
      withdrawalId: user.id,
      status: user.status,
    },
  });

  return {
    success: true,
    data: user,
    message: "withdrawal-request-created",
    code: 201,
  };
};

const updateWithdrawalRequest = async (data) => {
  const tx = await sequelize.transaction();

  try {
    const payload = buildWithdrawalPayload(data);
    const existingWithdrawal = await WithdrawalRequest.findByPk(data.id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!existingWithdrawal) {
      throw createError(404, "withdrawal-request-not-found");
    }

    const nextStatus = data.status ?? existingWithdrawal.status;
    const shouldTrigger =
      String(existingWithdrawal.status).toLowerCase() !== "approved" &&
      String(nextStatus).toLowerCase() === "approved";

    const [updatedCount] = await WithdrawalRequest.update(payload, {
      where: { id: data.id },
      transaction: tx,
    });

    if (!updatedCount) {
      throw createError(400, "withdrawal-request-failed");
    }

    const updatedWithdrawal = await WithdrawalRequest.findByPk(data.id, {
      transaction: tx,
    });

    if (shouldTrigger) {
      const destination = normalizeDestination(updatedWithdrawal);
      if (!destination) {
        throw createError(400, "withdrawal-destination-required");
      }

      const platformAccountId = config.pointsMate.accountId;
      if (!platformAccountId) {
        throw createError(500, "pointsmate-account-id-required");
      }

      const idempotencyKey = walletIntegrationService.buildIdempotencyKey({
        entityType: "withdrawal",
        entityId: updatedWithdrawal.id,
        status: nextStatus,
      });

      let walletTransaction = await WalletTransaction.findOne({
        where: { idempotency_key: idempotencyKey },
        transaction: tx,
      });

      if (!walletTransaction) {
        walletTransaction = await WalletTransaction.create(
          {
            wallet_account_id: platformAccountId,
            type: "withdrawal",
            direction: "debit",
            amount: updatedWithdrawal.amount,
            status: "pending",
            api_status: "pending",
            reference_type: "withdrawal",
            reference_id: updatedWithdrawal.id,
            user_id: updatedWithdrawal.user_id,
            game_id: updatedWithdrawal.game_id,
            game_name: updatedWithdrawal.game_name,
            idempotency_key: idempotencyKey,
            meta: {
              provider: "PointsMate",
              stage: "approval",
              targetStatus: nextStatus,
              destination,
            },
          },
          { transaction: tx },
        );
      }

      const providerResponse = await walletIntegrationService.createSendRequest({
        accountId: platformAccountId,
        address: destination,
        amount: updatedWithdrawal.amount,
        memo: `Withdrawal ${updatedWithdrawal.id}`,
        referenceId: `withdrawal:${updatedWithdrawal.id}`,
        idempotencyKey,
      });

      await updatedWithdrawal.update(
        {
          api_status: providerResponse?.isSucceed === false ? "failed" : "initiated",
        },
        { transaction: tx },
      );

      await walletTransaction.update(
        {
          status: "pending",
          api_status: providerResponse?.isSucceed === false ? "failed" : "initiated",
          meta: {
            ...(walletTransaction.meta || {}),
            providerResponse,
            destination,
          },
        },
        { transaction: tx },
      );
    }

    await tx.commit();

    const normalizedStatus = String(updatedWithdrawal.status || "").toLowerCase();
    emitToUserAndAdmins(updatedWithdrawal.user_id, "withdrawal:updated", {
      type: "withdrawal",
      action: normalizedStatus === "approved" ? "approved" : "updated",
      withdrawalId: updatedWithdrawal.id,
      userId: updatedWithdrawal.user_id,
      status: updatedWithdrawal.status,
      api_status: updatedWithdrawal.api_status,
      data: updatedWithdrawal,
    });

    await notificationService.createForUserAndAdmins({
      userId: updatedWithdrawal.user_id,
      type: "withdrawal",
      title: "Withdrawal updated",
      message: `Withdrawal ${updatedWithdrawal.id} is now ${updatedWithdrawal.status}.`,
      meta: {
        withdrawalId: updatedWithdrawal.id,
        status: updatedWithdrawal.status,
        api_status: updatedWithdrawal.api_status,
      },
    });

    if (normalizedStatus === "approved") {
      emitToUserAndAdmins(updatedWithdrawal.user_id, "withdrawal:approved", {
        type: "withdrawal",
        action: "approved",
        withdrawalId: updatedWithdrawal.id,
        userId: updatedWithdrawal.user_id,
        status: updatedWithdrawal.status,
        api_status: updatedWithdrawal.api_status,
      });

      await notificationService.createForUserAndAdmins({
        userId: updatedWithdrawal.user_id,
        type: "withdrawal",
        title: "Withdrawal approved",
        message: `Withdrawal ${updatedWithdrawal.id} was approved.`,
        meta: {
          withdrawalId: updatedWithdrawal.id,
          status: updatedWithdrawal.status,
          api_status: updatedWithdrawal.api_status,
        },
      });
    }

    return {
      success: true,
      data: updatedWithdrawal,
      message: "withdrawal-request-updated",
      code: 200,
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const getWithdrawalRequest = async (q) => {
  const {
    user_id,
    game_id,
    id,
    amount,
    currency,
    method,
    destination,
    address,
    status,
    reviewed_by_admin_id,
    admin_note,
  } = q;
  console.log(q);
  
  // Pagination fix: Convert strings to numbers to avoid NaN
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 10;
  const offset = (page - 1) * limit;

  let where = {};
  if (user_id) where.user_id = user_id;
  if (game_id) where.game_id = game_id;
  if (id) where.id = id;
  if (amount) where.amount = amount;
  if (currency) where.currency = currency;
  if (method) where.method = method;
  if (destination || address) where.destination = destination || address;
  if (status) where.status = status;
  if (reviewed_by_admin_id) where.reviewed_by_admin_id = reviewed_by_admin_id;
  if (admin_note) where.admin_note = admin_note;

  const { rows: withdrawalrequests, count } =
    await WithdrawalRequest.findAndCountAll({
      where,
      offset: offset,
      limit: limit,
      attributes: [
        "id",
        "user_id",
        "amount",
        "currency",
        "method",
        "destination",
        "status",
        "api_status",
        "reviewed_by_admin_id",
        "admin_note",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        {
          association: "game",
          attributes: ["id", "name"],
        },
        {
          association: "reviewedByAdmin",
          attributes: ["id", "email", "firstName", "lastName"],
          required: false,
        },
      ],
    });

  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    pagination: {
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "withdrawal-requests-retrieved",
    code: 200,
  };
};

const deleteWithdrawalRequest = async (id) => {
  const withdrawalrequests = await WithdrawalRequest.destroy({ where: { id } });
  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    message: "withdrawal-request-deleted",
    code: 200,
  };
};

const bulkDeleteWithdrawalRequests = async (ids) => {
  const withdrawalrequests = await WithdrawalRequest.destroy({
    where: { id: ids },
  });
  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    message: "withdrawal-requests-deleted",
    code: 200,
  };
};

const requestWithdrawal = async ({ userId, address, amountSats, memo, referenceId }) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  if (!address || !String(address).trim()) {
    throw createError(400, "address-required");
  }

  const numericAmountSats = Number(amountSats);
  if (!Number.isFinite(numericAmountSats) || numericAmountSats < 1) {
    throw createError(400, "invalid-amountSats");
  }

  const balance = await pointsmateClient.getBalance({ accountId: userContext.accountId });
  const spendable = Number(balance?.totalBalance?.totalSpendableBalance || balance?.balanceSats || 0);
  if (!Number.isFinite(spendable) || numericAmountSats > spendable) {
    throw createError(400, "insufficient-balance");
  }

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
        type: "withdrawal",
        direction: "debit",
        amount: (numericAmountSats / 100000000).toFixed(8),
        status: "pending",
        api_status: "pending",
        reference_type: "pointsmate_send",
        idempotency_key: safeReferenceId,
        meta: {
          memo,
          amountSats: String(numericAmountSats),
          address: String(address).trim(),
        },
      },
      { transaction: tx },
    );

    const provider = await pointsmateClient.sendFunds({
      accountId: userContext.accountId,
      address: String(address).trim(),
      amountSats: numericAmountSats,
      memo,
      referenceId: safeReferenceId,
    });

    await walletTx.update(
      {
        api_status: provider?.isSucceed ? "initiated" : "failed",
        meta: {
          ...(walletTx.meta || {}),
          providerTransactionId: provider.transactionId,
          providerResponse: provider,
        },
      },
      { transaction: tx },
    );

    await tx.commit();

    const txPayload = walletTx.get({ plain: true });
    emitToUserAndAdmins(userId, "withdrawal:updated", {
      type: "withdrawal",
      action: "initiated",
      transactionId: txPayload.id,
      userId,
      status: txPayload.status,
      api_status: txPayload.api_status,
      data: txPayload,
    });

    await notificationService.createForUserAndAdmins({
      userId,
      type: "withdrawal",
      title: "Withdrawal initiated",
      message: `Withdrawal transaction ${txPayload.id} has been initiated.`,
      meta: {
        transactionId: txPayload.id,
        status: txPayload.status,
        api_status: txPayload.api_status,
      },
    });

    return {
      transactionId: walletTx.id,
      pmTransactionId: provider.transactionId,
      status: "PENDING",
      message: "Withdrawal initiated. Will complete when confirmed.",
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const withdrawalRequestService = {
  createWithdrawalRequest,
  updateWithdrawalRequest,
  getWithdrawalRequest,
  deleteWithdrawalRequest,
  bulkDeleteWithdrawalRequests,
  requestWithdrawal,
};
