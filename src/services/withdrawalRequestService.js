import createError from "http-errors";
import config from "../config/env.js";
import { WithdrawalRequest } from "../models/associations.js";
import WalletAccount from "../models/wallet_account.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { sequelize } from "../config/db.js";
import { walletIntegrationService } from "./walletIntegrationService.js";
import { tierlockClient } from "../config/tierlockClient.js";
import { transactionService } from "./transaction.service.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const normalizeDestination = (payload = {}) => {
  const rawValue = payload.destination ?? payload.address;

  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  return String(rawValue).trim();
};

const buildWithdrawalPayload = (payload = {}) => {
  const { address, ...rest } = payload;
  const destination = normalizeDestination(payload);

  if (destination === undefined) {
    return rest;
  }

  return {
    ...rest,
    destination,
  };
};

const assertMaxLength = (value, max, fieldName) => {
  if (value === undefined || value === null) return;
  if (String(value).length > max) {
    throw createError(400, `${fieldName}-too-long`);
  }
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

const createWithdrawalRequest = async (data) => {
  const payload = buildWithdrawalPayload(data);

  assertMaxLength(payload.destination, 1024, "destination");
  assertMaxLength(payload.admin_note, 255, "admin-note");

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
    assertMaxLength(payload.destination, 1024, "destination");
    assertMaxLength(payload.admin_note, 255, "admin-note");

    const existingWithdrawal = await WithdrawalRequest.findByPk(data.id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!existingWithdrawal) {
      throw createError(404, "withdrawal-request-not-found");
    }

    const nextStatus = data.status ?? existingWithdrawal.status;
    const prevStatus = String(existingWithdrawal.status).toLowerCase();
    const normalizedNext = String(nextStatus).toLowerCase();
    const method = String(
      payload.method ?? existingWithdrawal.method ?? "pointsmate",
    ).toLowerCase();
    const isTierlock = method === "tierlock";
    const isPixPay = method === "pixpay";

    const shouldTriggerApproval =
      prevStatus !== "approved" && normalizedNext === "approved";

    if (prevStatus === "approved" && normalizedNext === "approved") {
      throw createError(400, "withdrawal-already-approved");
    }

    if (prevStatus === "rejected" && normalizedNext === "approved") {
      throw createError(400, "withdrawal-already-rejected");
    }

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

    if (shouldTriggerApproval) {
      const destination = String(
        updatedWithdrawal.destination || existingWithdrawal.destination || "",
      ).trim();
      if (!destination) {
        throw createError(400, "withdrawal-destination-required");
      }

      const userWalletAccount = await ensureWalletAccount({
        userId: updatedWithdrawal.user_id,
        transaction: tx,
      });

      if (isTierlock) {
        const orderId = `CASH-OUT-${String(updatedWithdrawal.id)
          .replace(/-/g, "")
          .slice(0, 12)}`;

        let walletTransaction = await WalletTransaction.findOne({
          where: { idempotency_key: orderId },
          transaction: tx,
        });

        if (!walletTransaction) {
          walletTransaction = await WalletTransaction.create(
            {
              wallet_account_id: userWalletAccount.id,
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
              idempotency_key: orderId,
              meta: {
                provider: "Tierlock",
                stage: "release",
                orderId,
                destination,
              },
            },
            { transaction: tx },
          );
        }

        const providerResponse = await tierlockClient.createPayoutLink({
          orderId,
          phoneNumber: destination,
          amount: updatedWithdrawal.amount,
          memo: `Withdrawal ${updatedWithdrawal.id}`,
        });

        await updatedWithdrawal.update(
          {
            status: providerResponse?.success === false ? "failed" : "processing",
            api_status:
              providerResponse?.success === false
                ? "failed"
                : "payment_link_sent",
          },
          { transaction: tx },
        );

        await walletTransaction.update(
          {
            status: providerResponse?.success === false ? "failed" : "pending",
            api_status:
              providerResponse?.success === false
                ? "failed"
                : "payment_link_sent",
            meta: {
              ...(walletTransaction.meta || {}),
              provider: "Tierlock",
              providerResponse,
              orderId,
              destination,
            },
          },
          { transaction: tx },
        );
      } else if (isPixPay) {
        const idempotencyKey = `pixpay:withdrawal:${updatedWithdrawal.id}:approved`;

        let walletTransaction = await WalletTransaction.findOne({
          where: { idempotency_key: idempotencyKey },
          transaction: tx,
        });

        if (!walletTransaction) {
          walletTransaction = await WalletTransaction.create(
            {
              wallet_account_id: userWalletAccount.id,
              type: "withdrawal",
              direction: "debit",
              amount: updatedWithdrawal.amount,
              status: "completed",
              api_status: "manual_completed",
              reference_type: "withdrawal",
              reference_id: updatedWithdrawal.id,
              user_id: updatedWithdrawal.user_id,
              game_id: updatedWithdrawal.game_id,
              game_name: updatedWithdrawal.game_name,
              idempotency_key: idempotencyKey,
              meta: {
                provider: "PixPay",
                stage: "manual-approval",
                targetStatus: nextStatus,
                destination,
              },
            },
            { transaction: tx },
          );
        }

        await updatedWithdrawal.update(
          {
            status: "approved",
            api_status: "manual_completed",
          },
          { transaction: tx },
        );

        await walletTransaction.update(
          {
            status: "completed",
            api_status: "manual_completed",
            meta: {
              ...(walletTransaction.meta || {}),
              destination,
              provider: "PixPay",
              manualApprovedAt: new Date().toISOString(),
            },
          },
          { transaction: tx },
        );

        await userWalletAccount.decrement("balance", {
          by: Number(updatedWithdrawal.amount),
          transaction: tx,
        });
      } else {
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
              wallet_account_id: userWalletAccount.id,
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

        const providerResponse = await walletIntegrationService.createSendRequest(
          {
            accountId: platformAccountId,
            address: destination,
            amount: updatedWithdrawal.amount,
            memo: `Withdrawal ${updatedWithdrawal.id}`,
            referenceId: `withdrawal:${updatedWithdrawal.id}`,
            idempotencyKey,
          },
        );

        await updatedWithdrawal.update(
          {
            api_status:
              providerResponse?.isSucceed === false ? "failed" : "initiated",
          },
          { transaction: tx },
        );

        await walletTransaction.update(
          {
            status:
              providerResponse?.isSucceed === false ? "failed" : "completed",
            api_status:
              providerResponse?.isSucceed === false ? "failed" : "initiated",
            meta: {
              ...(walletTransaction.meta || {}),
              providerResponse,
              destination,
            },
          },
          { transaction: tx },
        );

        if (providerResponse?.isSucceed !== false) {
          await userWalletAccount.decrement("balance", {
            by: Number(updatedWithdrawal.amount),
            transaction: tx,
          });
        }
      }
    }

    if (normalizedNext === "rejected" && prevStatus !== "rejected") {
      const userWalletAccount = await ensureWalletAccount({
        userId: updatedWithdrawal.user_id,
        transaction: tx,
      });

      const rejectionKey = isTierlock
        ? `tierlock:withdrawal:${updatedWithdrawal.id}:rejected`
        : isPixPay
          ? `pixpay:withdrawal:${updatedWithdrawal.id}:rejected`
          : walletIntegrationService.buildIdempotencyKey({
            entityType: "withdrawal",
            entityId: updatedWithdrawal.id,
            status: "rejected",
          });

      const exists = await WalletTransaction.findOne({
        where: { idempotency_key: rejectionKey },
        transaction: tx,
      });

      if (!exists) {
        await WalletTransaction.create(
          {
            wallet_account_id: userWalletAccount.id,
            type: "withdrawal",
            direction: "debit",
            amount: updatedWithdrawal.amount,
            status: "canceled",
            api_status: "rejected",
            reference_type: "withdrawal",
            reference_id: updatedWithdrawal.id,
            user_id: updatedWithdrawal.user_id,
            game_id: updatedWithdrawal.game_id,
            game_name: updatedWithdrawal.game_name,
            idempotency_key: rejectionKey,
            meta: {
              provider: isTierlock
                ? "Tierlock"
                : isPixPay
                  ? "PixPay"
                  : "PointsMate",
              stage: "rejection",
              adminNote: data.admin_note || null,
              reviewedBy: data.reviewed_by_admin_id || null,
            },
          },
          { transaction: tx },
        );
      }
    }

    await tx.commit();

    const normalizedStatus = String(
      updatedWithdrawal.status || "",
    ).toLowerCase();
    emitToUserAndAdmins(updatedWithdrawal.user_id, "withdrawal:updated", {
      type: "withdrawal",
      action:
        normalizedStatus === "processing"
          ? "released"
          : normalizedStatus === "approved"
            ? "approved"
            : "updated",
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

    if (normalizedStatus === "processing") {
      emitToUserAndAdmins(updatedWithdrawal.user_id, "withdrawal:released", {
        type: "withdrawal",
        action: "released",
        withdrawalId: updatedWithdrawal.id,
        userId: updatedWithdrawal.user_id,
        status: updatedWithdrawal.status,
        api_status: updatedWithdrawal.api_status,
      });

      await notificationService.createForUserAndAdmins({
        userId: updatedWithdrawal.user_id,
        type: "withdrawal",
        title: "Withdrawal released",
        message: `Withdrawal ${updatedWithdrawal.id} was sent to Tierlock for customer approval.`,
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

const getWithdrawalRequest = async (q, requestingUser) => {
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

  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 10;
  const offset = (page - 1) * limit;

  const where = {};

  const isAdmin = String(requestingUser?.role ?? "").toLowerCase() === "admin";
  if (!isAdmin) {
    where.user_id = requestingUser?.id;
  } else if (user_id) {
    where.user_id = user_id;
  }

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
      order: [["createdAt", "DESC"]],
      offset,
      limit,
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

const requestWithdrawal = async ({
  userId,
  address,
  amount,
  memo,
  method,
  currency,
  gameId,
  gameName,
}) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  const destination = String(address || "").trim();
  if (!destination) {
    throw createError(400, "address-required");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw createError(400, "invalid-amount");
  }

  if (!gameId) {
    throw createError(400, "game-id-required");
  }

  if (!gameName) {
    throw createError(400, "game-name-required");
  }

  const normalizedMethod = String(method || "pointsmate").toLowerCase();

  const response = await createWithdrawalRequest({
    user_id: userId,
    game_id: gameId,
    game_name: gameName,
    amount: numericAmount,
    currency: currency || "USD",
    method: normalizedMethod,
    destination,
    status: "requested",
    api_status: "pending",
    admin_note: memo || null,
  });

  return {
    withdrawalId: response?.data?.id,
    status: response?.data?.status || "requested",
    api_status: response?.data?.api_status || "pending",
    message:
      normalizedMethod === "tierlock"
        ? "Withdrawal requested. A payout link will be sent after admin approval."
        : normalizedMethod === "pixpay"
          ? "Withdrawal requested. PixPay payout will be completed after admin approval."
        : "Withdrawal requested. Will proceed after admin approval.",
  };
};

const approveWithdrawalRequest = ({
  id,
  reviewedByAdminId,
  adminNote,
  destination,
  address,
}) => {
  if (!id) {
    throw createError(400, "withdrawal-id-required");
  }

  return updateWithdrawalRequest({
    id,
    status: "approved",
    reviewed_by_admin_id: reviewedByAdminId || null,
    admin_note: adminNote || null,
    destination: destination ?? address,
    address: address ?? destination,
  }).then((response) => response?.data);
};

export const withdrawalRequestService = {
  createWithdrawalRequest,
  updateWithdrawalRequest,
  getWithdrawalRequest,
  deleteWithdrawalRequest,
  bulkDeleteWithdrawalRequests,
  requestWithdrawal,
  approveWithdrawalRequest,
};
