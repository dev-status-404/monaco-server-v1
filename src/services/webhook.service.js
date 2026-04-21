import { sequelize } from "../config/db.js";
import { verifyWebhookHash } from "../utils/webhookHash.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import WebhookEvent from "../models/webhook_events.model.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const mapWebhookStatus = (transactionStatus = "") => {
  const normalized = String(transactionStatus).toUpperCase();
  if (normalized === "COMPLETED") return "completed";
  if (normalized === "FAILED" || normalized === "DENIED") return "failed";
  if (normalized === "CANCELLED" || normalized === "EXPIRED") return "canceled";
  return "pending";
};

const isTerminal = (status = "") => ["completed", "failed", "canceled"].includes(status);

const findTransactionByProvider = async ({ type, transactionId, referenceId }) => {
  const candidates = await WalletTransaction.findAll({ where: { type } });

  return (
    candidates.find((tx) => tx?.meta?.providerTransactionId === transactionId) ||
    candidates.find((tx) => tx.idempotency_key === referenceId) ||
    null
  );
};

const persistWebhookEvent = async (payload, channel) => {
  const eventId =
    payload?.eventId ||
    payload?.transactionId ||
    payload?.magicLinkId ||
    payload?.pointsCodeId ||
    payload?.referenceId ||
    `${channel}:${payload?.timestamp || Date.now()}`;

  const existing = await WebhookEvent.findOne({ where: { event_id: eventId } });
  if (existing) return existing;

  return WebhookEvent.create({
    provider: "pointsmate",
    event_type: payload?.eventType || channel,
    event_id: eventId,
    status: "received",
    payload,
  });
};

const applyBalanceDelta = async ({ walletAccountId, direction, amountSats, transaction }) => {
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

const processWebhookJob = async (jobData) => {
  const { channel, payload, incomingHash } = jobData;

  await persistWebhookEvent(payload, channel);

  if (channel === "receive") return processReceiveWebhook({ payload, incomingHash });
  if (channel === "send") return processSendWebhook({ payload, incomingHash });

  logger.info({ channel }, "Unhandled webhook channel");
};

export const webhookService = {
  processWebhookJob,
};
