import crypto from "crypto";
import { sequelize } from "../config/db.js";
import { verifyWebhookHash } from "../utils/webhookHash.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import WebhookEvent from "../models/webhook_events.model.js";
import { WithdrawalRequest } from "../models/associations.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const mapWebhookStatus = (transactionStatus = "") => {
  const normalized = String(transactionStatus).toUpperCase();
  if (normalized === "COMPLETED") return "completed";
  if (normalized === "FAILED" || normalized === "DENIED") return "failed";
  if (normalized === "CANCELLED" || normalized === "EXPIRED") return "canceled";
  return "pending";
};

const isTerminal = (status = "") =>
  ["completed", "failed", "canceled"].includes(status);

const normalizeSignature = (signature = "") => {
  const value = String(signature || "").trim();
  return value.startsWith("sha256=") ? value.slice(7) : value;
};

const verifyTierlockSignature = (rawBody, incomingSignature, webhookSecret) => {
  if (!rawBody || !incomingSignature || !webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(
    normalizeSignature(incomingSignature),
    "hex",
  );

  if (
    !expectedBuffer.length ||
    expectedBuffer.length !== receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const findTransactionByProvider = async ({ type, transactionId, referenceId }) => {
  const candidates = await WalletTransaction.findAll({ where: { type } });

  return (
    candidates.find((tx) => tx?.meta?.providerTransactionId === transactionId) ||
    candidates.find((tx) => tx.idempotency_key === referenceId) ||
    null
  );
};

const findTierlockTransaction = async ({ type, orderId, transactionId }) => {
  const candidates = await WalletTransaction.findAll({ where: { type } });

  return (
    candidates.find((tx) => tx?.meta?.orderId === orderId) ||
    candidates.find((tx) => tx.idempotency_key === orderId) ||
    candidates.find(
      (tx) =>
        String(tx?.meta?.providerTransactionId || "") ===
        String(transactionId || ""),
    ) ||
    null
  );
};

const persistWebhookEvent = async (payload, channel) => {
  const tierlockEventName =
    payload?.type || payload?.event || payload?.data?.event || channel;
  const tierlockEventEntity =
    payload?.data?.transaction_id || payload?.data?.order_id || payload?.timestamp;

  const eventId =
    payload?.eventId ||
    payload?.transactionId ||
    payload?.magicLinkId ||
    payload?.pointsCodeId ||
    payload?.referenceId ||
    `${tierlockEventName}:${tierlockEventEntity}` ||
    `${channel}:${payload?.timestamp || Date.now()}`;

  const existing = await WebhookEvent.findOne({ where: { event_id: eventId } });
  if (existing) return existing;

  return WebhookEvent.create({
    provider: channel.startsWith("tierlock") ? "tierlock" : "pointsmate",
    event_type:
      payload?.eventType ||
      payload?.type ||
      payload?.event ||
      payload?.data?.event ||
      channel,
    event_id: eventId,
    status: "received",
    payload,
  });
};

const applyBalanceDelta = async ({
  walletAccountId,
  direction,
  amountSats,
  transaction,
}) => {
  const amount = Number(amountSats) / 100000000;
  if (!Number.isFinite(amount) || amount <= 0) return;

  const wallet = await WalletAccount.findByPk(walletAccountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!wallet) return;

  const current = Number(wallet.balance || 0);
  const next = direction === "credit" ? current + amount : current - amount;

  await wallet.update({ balance: next.toFixed(8) }, { transaction });
};

const applyUsdBalanceDelta = async ({
  walletAccountId,
  direction,
  amount,
  transaction,
}) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;

  const wallet = await WalletAccount.findByPk(walletAccountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!wallet) return;

  const current = Number(wallet.balance || 0);
  const next = direction === "credit" ? current + numericAmount : current - numericAmount;

  await wallet.update({ balance: next.toFixed(2) }, { transaction });
};

const processReceiveWebhook = async ({ payload, incomingHash }) => {
  if (!verifyWebhookHash(payload, incomingHash, config.pointsMate.webhookSecret)) {
    logger.warn({ eventType: payload?.eventType }, "Invalid webhook hash - receive");
    return;
  }

  const tx = await findTransactionByProvider({
    type: "deposit",
    transactionId: payload.transactionId,
    referenceId: payload.referenceId,
  });

  if (!tx) {
    logger.warn({ transactionId: payload?.transactionId }, "No deposit transaction found");
    return;
  }

  const mappedStatus = mapWebhookStatus(payload.transactionStatus);
  if (isTerminal(tx.status)) return;

  const dbTx = await sequelize.transaction();
  try {
    await tx.update(
      {
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
        meta: {
          ...(tx.meta || {}),
          rawWebhook: payload,
          providerTransactionId: payload.transactionId || tx?.meta?.providerTransactionId,
          amountSats: payload.amountSats || tx?.meta?.amountSats,
          amountUsd: payload.amountUsd || tx?.meta?.amountUsd,
        },
      },
      { transaction: dbTx },
    );

    if (mappedStatus === "completed") {
      await applyBalanceDelta({
        walletAccountId: tx.wallet_account_id,
        direction: "credit",
        amountSats: payload.amountSats || tx?.meta?.amountSats,
        transaction: dbTx,
      });
    }

    await dbTx.commit();
    emitToUserAndAdmins(tx.user_id, "deposit:updated", {
      type: "deposit",
      action: mappedStatus === "completed" ? "completed" : "updated",
      transactionId: tx.id,
      userId: tx.user_id,
      status: mappedStatus,
      api_status: payload.transactionStatus || tx.api_status,
      data: {
        id: tx.id,
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
        amountSats: payload.amountSats || tx?.meta?.amountSats,
      },
    });

    await notificationService.createForUserAndAdmins({
      userId: tx.user_id,
      type: "deposit",
      title: "Deposit status updated",
      message: `Deposit transaction ${tx.id} is now ${mappedStatus}.`,
      meta: {
        transactionId: tx.id,
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
      },
    });
    logger.info({ txId: tx.id, status: mappedStatus }, "Processed receive webhook");
  } catch (error) {
    await dbTx.rollback();
    throw error;
  }
};

const processSendWebhook = async ({ payload, incomingHash }) => {
  if (!verifyWebhookHash(payload, incomingHash, config.pointsMate.webhookSecret)) {
    logger.warn({ eventType: payload?.eventType }, "Invalid webhook hash - send");
    return;
  }

  const tx = await findTransactionByProvider({
    type: "withdrawal",
    transactionId: payload.transactionId,
    referenceId: payload.referenceId,
  });

  if (!tx) {
    logger.warn({ transactionId: payload?.transactionId }, "No withdrawal transaction found");
    return;
  }

  const mappedStatus = mapWebhookStatus(payload.transactionStatus);
  if (isTerminal(tx.status)) return;

  const dbTx = await sequelize.transaction();
  try {
    await tx.update(
      {
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
        meta: {
          ...(tx.meta || {}),
          rawWebhook: payload,
          providerTransactionId: payload.transactionId || tx?.meta?.providerTransactionId,
          amountSats: payload.amountSats || tx?.meta?.amountSats,
          amountUsd: payload.amountUsd || tx?.meta?.amountUsd,
          error: payload.error,
        },
      },
      { transaction: dbTx },
    );

    if (mappedStatus === "completed") {
      await applyBalanceDelta({
        walletAccountId: tx.wallet_account_id,
        direction: "debit",
        amountSats: payload.amountSats || tx?.meta?.amountSats,
        transaction: dbTx,
      });
    }

    await dbTx.commit();
    emitToUserAndAdmins(tx.user_id, "withdrawal:updated", {
      type: "withdrawal",
      action: mappedStatus === "completed" ? "completed" : "updated",
      transactionId: tx.id,
      userId: tx.user_id,
      status: mappedStatus,
      api_status: payload.transactionStatus || tx.api_status,
      data: {
        id: tx.id,
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
        amountSats: payload.amountSats || tx?.meta?.amountSats,
      },
    });

    await notificationService.createForUserAndAdmins({
      userId: tx.user_id,
      type: "withdrawal",
      title: "Withdrawal status updated",
      message: `Withdrawal transaction ${tx.id} is now ${mappedStatus}.`,
      meta: {
        transactionId: tx.id,
        status: mappedStatus,
        api_status: payload.transactionStatus || tx.api_status,
      },
    });
    logger.info({ txId: tx.id, status: mappedStatus }, "Processed send webhook");
  } catch (error) {
    await dbTx.rollback();
    throw error;
  }
};

const processTierlockPaymentWebhook = async ({
  payload,
  rawBody,
  incomingSignature,
}) => {
  if (
    !verifyTierlockSignature(
      rawBody,
      incomingSignature,
      config.tierlock.paymentWebhookSecret,
    )
  ) {
    logger.warn({ eventType: payload?.type }, "Invalid webhook signature - tierlock payment");
    return;
  }

  const eventName = String(payload?.event || payload?.data?.event || payload?.type || "");
  if (eventName !== "PAYMENT_SUCCESS") {
    logger.info({ eventName }, "Ignoring unsupported Tierlock payment event");
    return;
  }

  const tx = await findTierlockTransaction({
    type: "deposit",
    orderId: payload?.data?.order_id,
    transactionId: payload?.data?.transaction_id,
  });

  if (!tx) {
    logger.warn({ orderId: payload?.data?.order_id }, "No Tierlock deposit transaction found");
    return;
  }

  if (tx.status === "completed") return;

  const dbTx = await sequelize.transaction();
  try {
    await tx.update(
      {
        status: "completed",
        api_status: payload?.data?.status || "SUCCESS",
        meta: {
          ...(tx.meta || {}),
          provider: "Tierlock",
          rawWebhook: payload,
          providerTransactionId:
            payload?.data?.transaction_id || tx?.meta?.providerTransactionId,
          orderId: payload?.data?.order_id || tx?.meta?.orderId,
          amountUsd: String(payload?.data?.total_amount || tx.amount),
          paymentCompletedAt: payload?.data?.timestamp || new Date().toISOString(),
        },
      },
      { transaction: dbTx },
    );

    await applyUsdBalanceDelta({
      walletAccountId: tx.wallet_account_id,
      direction: "credit",
      amount: payload?.data?.total_amount || tx.amount,
      transaction: dbTx,
    });

    await dbTx.commit();

    emitToUserAndAdmins(tx.user_id, "deposit:updated", {
      type: "deposit",
      action: "completed",
      transactionId: tx.id,
      userId: tx.user_id,
      status: "completed",
      api_status: payload?.data?.status || "SUCCESS",
      data: {
        id: tx.id,
        status: "completed",
        api_status: payload?.data?.status || "SUCCESS",
        amount: payload?.data?.total_amount || tx.amount,
        order_id: payload?.data?.order_id || tx?.meta?.orderId,
      },
    });

    await notificationService.createForUserAndAdmins({
      userId: tx.user_id,
      type: "deposit",
      title: "Deposit approved",
      message: `Deposit transaction ${tx.id} was approved and credited.`,
      meta: {
        transactionId: tx.id,
        status: "completed",
        api_status: payload?.data?.status || "SUCCESS",
      },
    });
  } catch (error) {
    await dbTx.rollback();
    throw error;
  }
};

const processTierlockPayoutWebhook = async ({
  payload,
  rawBody,
  incomingSignature,
}) => {
  if (
    !verifyTierlockSignature(
      rawBody,
      incomingSignature,
      config.tierlock.payoutWebhookSecret,
    )
  ) {
    logger.warn({ eventType: payload?.type }, "Invalid webhook signature - tierlock payout");
    return;
  }

  const eventType = String(payload?.type || payload?.data?.event || "");
  const tx = await findTierlockTransaction({
    type: "withdrawal",
    orderId: payload?.data?.order_id,
    transactionId: payload?.data?.transaction_id,
  });

  if (!tx) {
    logger.warn({ orderId: payload?.data?.order_id }, "No Tierlock withdrawal transaction found");
    return;
  }

  const withdrawal = tx.reference_id
    ? await WithdrawalRequest.findByPk(tx.reference_id)
    : null;

  const dbTx = await sequelize.transaction();
  try {
    if (eventType === "PAYOUT_APPROVED") {
      if (
        tx?.meta?.payoutApprovedAt ||
        ["approved", "paid"].includes(
          String(withdrawal?.status || "").toLowerCase(),
        )
      ) {
        await dbTx.rollback();
        return;
      }

      await tx.update(
        {
          status: "pending",
          api_status: payload?.data?.status || "SENT_FOR_ONCHAIN_SETTLEMENT",
          meta: {
            ...(tx.meta || {}),
            provider: "Tierlock",
            rawWebhook: payload,
            providerTransactionId:
              payload?.data?.transaction_id || tx?.meta?.providerTransactionId,
            payoutApprovedAt:
              payload?.data?.timestamp || new Date().toISOString(),
          },
        },
        { transaction: dbTx },
      );

      if (withdrawal) {
        await withdrawal.update(
          {
            status: "approved",
            api_status: payload?.data?.status || "SENT_FOR_ONCHAIN_SETTLEMENT",
          },
          { transaction: dbTx },
        );
      }

      await applyUsdBalanceDelta({
        walletAccountId: tx.wallet_account_id,
        direction: "debit",
        amount: payload?.data?.amount || tx.amount,
        transaction: dbTx,
      });
    } else if (eventType === "PAYOUT_SUCCESS") {
      if (
        tx.status === "completed" ||
        String(withdrawal?.status || "").toLowerCase() === "paid"
      ) {
        await dbTx.rollback();
        return;
      }

      await tx.update(
        {
          status: "completed",
          api_status:
            payload?.data?.status || "PAYOUT_ONCHAIN_SETTLEMENT_SUCCESS",
          meta: {
            ...(tx.meta || {}),
            provider: "Tierlock",
            rawWebhook: payload,
            providerTransactionId:
              payload?.data?.transaction_id || tx?.meta?.providerTransactionId,
          },
        },
        { transaction: dbTx },
      );

      if (withdrawal) {
        await withdrawal.update(
          {
            status: "paid",
            api_status:
              payload?.data?.status || "PAYOUT_ONCHAIN_SETTLEMENT_SUCCESS",
          },
          { transaction: dbTx },
        );
      }
    } else if (
      eventType === "PAYOUT_DECLINED" &&
      String(payload?.data?.event || "") === "PAYOUT_DECLINED_BY_USER"
    ) {
      if (
        tx.status === "canceled" ||
        String(withdrawal?.status || "").toLowerCase() === "rejected"
      ) {
        await dbTx.rollback();
        return;
      }

      await tx.update(
        {
          status: "canceled",
          api_status: payload?.data?.status || "DENIED",
          meta: {
            ...(tx.meta || {}),
            provider: "Tierlock",
            rawWebhook: payload,
            providerTransactionId:
              payload?.data?.transaction_id || tx?.meta?.providerTransactionId,
          },
        },
        { transaction: dbTx },
      );

      if (withdrawal) {
        await withdrawal.update(
          {
            status: "rejected",
            api_status: payload?.data?.status || "DENIED",
          },
          { transaction: dbTx },
        );
      }
    } else {
      await dbTx.rollback();
      logger.info({ eventType }, "Ignoring unsupported Tierlock payout event");
      return;
    }

    await dbTx.commit();

    emitToUserAndAdmins(tx.user_id, "withdrawal:updated", {
      type: "withdrawal",
      action:
        eventType === "PAYOUT_SUCCESS"
          ? "completed"
          : eventType === "PAYOUT_APPROVED"
            ? "approved"
            : "rejected",
      transactionId: tx.id,
      userId: tx.user_id,
      status:
        eventType === "PAYOUT_SUCCESS"
          ? "completed"
          : eventType === "PAYOUT_DECLINED"
            ? "canceled"
            : "pending",
      api_status: payload?.data?.status || tx.api_status,
      data: {
        id: tx.id,
        withdrawalId: tx.reference_id,
        order_id: payload?.data?.order_id || tx?.meta?.orderId,
        eventType,
      },
    });

    await notificationService.createForUserAndAdmins({
      userId: tx.user_id,
      type: "withdrawal",
      title: "Withdrawal status updated",
      message: `Withdrawal transaction ${tx.id} received ${eventType}.`,
      meta: {
        transactionId: tx.id,
        withdrawalId: tx.reference_id,
        status: eventType,
        api_status: payload?.data?.status || tx.api_status,
      },
    });
  } catch (error) {
    await dbTx.rollback();
    throw error;
  }
};

const processWebhookJob = async (jobData) => {
  const { channel, payload, incomingHash, rawBody, incomingSignature } = jobData;

  await persistWebhookEvent(payload, channel);

  if (channel === "receive") return processReceiveWebhook({ payload, incomingHash });
  if (channel === "send") return processSendWebhook({ payload, incomingHash });
  if (channel === "tierlock-payment") {
    return processTierlockPaymentWebhook({
      payload,
      rawBody,
      incomingSignature,
    });
  }
  if (channel === "tierlock-payout") {
    return processTierlockPayoutWebhook({
      payload,
      rawBody,
      incomingSignature,
    });
  }

  logger.info({ channel }, "Unhandled webhook channel");
};

export const webhookService = {
  processWebhookJob,
};
