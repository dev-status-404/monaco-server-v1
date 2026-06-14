import createError from "http-errors";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import PayoutRequest from "../models/payout_requests.model.js";
import PayoutWebhookLog from "../models/payout_webhook_logs.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import { webhookService } from "./webhookService.js";
import { auditService } from "./auditService.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import config from "../config/env.js";

const OPEN_STATUSES = ["Redeem Requested", "Under Review", "Approved"];
const EVENT_TO_STATUS = {
  PAYOUT_APPROVED: "Approved",
  PAYOUT_SUCCESS: "Paid Out",
  PAYOUT_DECLINED: "Rejected",
  PAYOUT_DECLINED_BY_USER: "Rejected",
  PAYOUT_CANCELLED_BY_MERCHANT: "Cancelled",
  PAYOUT_FAILED: "Failed",
  PAYOUT_EXPIRED: "Expired",
  PAYOUT_REJECTED: "Rejected",
};

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw createError(400, "invalid-amount");
  }
  return Number(value.toFixed(2));
};

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (digits.length < 10) {
    throw createError(400, "invalid-phone-number");
  }
  return digits;
};

const appendStatusHistory = (existing, entry) => {
  const history = Array.isArray(existing) ? [...existing] : [];
  history.push(entry);
  return history;
};

const createPayoutRequest = async (user, input) => {
  if (!user?.id) throw createError(401, "auth-required");
  if (!String(input?.game || "").trim()) throw createError(400, "game-required");
  if (!String(input?.game_username || "").trim()) throw createError(400, "game-username-required");
  if (!String(input?.payout_method || "").trim()) throw createError(400, "payout-method-required");
  if (!String(input?.payout_account || "").trim()) throw createError(400, "payout-account-required");

  const amount = normalizeAmount(input.amount);
  const phone = normalizePhone(input.customer_phone);

  const wallet = await WalletAccount.findOne({ where: { user_id: user.id } });
  const balance = Number(wallet?.balance || 0);
  if (balance < amount) {
    throw createError(400, "insufficient-credits");
  }

  return PayoutRequest.create({
    user_id: user.id,
    customer_email: user.email,
    game: String(input.game).trim(),
    game_username: String(input.game_username).trim(),
    amount,
    payout_method: String(input.payout_method).trim(),
    payout_account: String(input.payout_account).trim(),
    customer_phone: phone,
    note: String(input.note || "").trim() || null,
    status: "Redeem Requested",
    status_history: [
      {
        from_status: null,
        to_status: "Redeem Requested",
        event: "CREATED",
        timestamp: new Date().toISOString(),
        verified: false,
      },
    ],
  });
};

const updatePayoutStatus = async (payoutId, newStatus, actorUserId, metadata = {}) => {
  const transaction = await sequelize.transaction();

  try {
    const payout = await PayoutRequest.findByPk(payoutId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!payout) throw createError(404, "payout-request-not-found");

    const fromStatus = payout.status;
    await payout.update(
      {
        status: newStatus,
        admin_notes: metadata?.admin_notes ?? payout.admin_notes ?? null,
        status_history: appendStatusHistory(payout.status_history, {
          from_status: fromStatus,
          to_status: newStatus,
          event: metadata?.event || "MANUAL_UPDATE",
          timestamp: new Date().toISOString(),
          verified: Boolean(metadata?.verified),
          payload_summary: metadata?.payload_summary || null,
        }),
      },
      { transaction },
    );

    await auditService.logStatusChange(
      "payout_request",
      payout.id,
      fromStatus,
      newStatus,
      actorUserId,
      { action: metadata?.action || "update_payout_status", ...metadata },
      transaction,
    );

    await transaction.commit();
    emitToUserAndAdmins(payout.user_id, "payout:updated", { payoutId: payout.id, status: newStatus });
    return PayoutRequest.findByPk(payout.id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const matchTierlockPayoutWebhook = async (payload) => {
  const orderId = String(payload?.order_id || payload?.data?.order_id || "").trim();
  const transactionId = String(payload?.transaction_id || payload?.data?.transaction_id || "").trim();
  const amount = Number(payload?.amount || payload?.data?.amount || 0);
  const userId = String(payload?.user_id || payload?.data?.user_id || "").trim();
  const phoneDigits = String(
    payload?.phone ||
      payload?.data?.phone ||
      payload?.data?.customer?.phone_number ||
      "",
  ).replace(/\D+/g, "");

  if (orderId) {
    const byOrder = await PayoutRequest.findOne({ where: { tierlock_order_id: orderId } });
    if (byOrder) return byOrder;
  }

  if (transactionId) {
    const byTx = await PayoutRequest.findOne({ where: { tierlock_transaction_id: transactionId } });
    if (byTx) return byTx;
  }

  if (userId && amount > 0) {
    const byUser = await PayoutRequest.findOne({
      where: {
        user_id: userId,
        amount,
        status: { [Op.in]: OPEN_STATUSES },
        createdAt: { [Op.gte]: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      order: [["createdAt", "ASC"]],
    });
    if (byUser) return byUser;
  }

  if (phoneDigits.length >= 10 && amount > 0) {
    const last10 = phoneDigits.slice(-10);
    const rows = await PayoutRequest.findAll({
      where: {
        amount,
        status: { [Op.in]: OPEN_STATUSES },
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      order: [["createdAt", "ASC"]],
    });

    return rows.find((row) => String(row.customer_phone || "").replace(/\D+/g, "").slice(-10) === last10) || null;
  }

  return null;
};

const logPayoutWebhook = async ({
  event,
  status,
  signaturePresent,
  verified,
  processingResult,
  payoutRequestId,
  payload,
  headers,
  signatureHeader,
}) => {
  return PayoutWebhookLog.create({
    event: event || null,
    status: status || null,
    signature_present: signaturePresent,
    verified,
    processing_result: processingResult,
    payout_request_id: payoutRequestId || null,
    payload,
    headers,
    signature_header: signatureHeader || null,
  });
};

const applyTierlockPayoutWebhook = async (payload, headers, rawBody) => {
  const event = String(payload?.event || payload?.type || payload?.data?.event || "").toUpperCase();
  const mappedStatus = EVENT_TO_STATUS[event];
  const transactionId = String(payload?.transaction_id || payload?.data?.transaction_id || "").trim();
  const verification = webhookService.verifyTierlockPayoutSignature(rawBody, headers);
  const merchantId = String(payload?.merchant_id || payload?.data?.merchant_id || "").trim();
  const softVerified = !verification.valid && merchantId && merchantId === String(config.tierlock.payoutMerchantId || "").trim();
  const verified = verification.valid;
  const signaturePresent = verification.signaturePresent;
  const signatureHeader = webhookService.getSignatureFromHeaders(headers);

  if (!verified && !softVerified) {
    await logPayoutWebhook({
      event,
      status: mappedStatus,
      signaturePresent,
      verified: false,
      processingResult: "signature_failed",
      payload,
      headers,
      signatureHeader,
    });
    const error = createError(401, "signature-failed");
    error.expose = true;
    throw error;
  }

  if (transactionId && event) {
    const priorLogs = await PayoutWebhookLog.findAll({
      where: {
        event,
        processing_result: { [Op.in]: ["processed", "duplicate_ignored"] },
      },
      limit: 50,
      order: [["createdAt", "DESC"]],
    });
    const duplicate = priorLogs.find((log) => {
      const priorTx = String(
        log?.payload?.transaction_id || log?.payload?.data?.transaction_id || "",
      ).trim();
      return priorTx === transactionId;
    });

    if (duplicate) {
      await logPayoutWebhook({
        event,
        status: mappedStatus,
        signaturePresent,
        verified,
        processingResult: "duplicate_ignored",
        payload,
        headers,
        signatureHeader,
      });
      return { duplicate: true };
    }
  }

  const payout = await matchTierlockPayoutWebhook(payload);
  if (!payout) {
    await logPayoutWebhook({
      event,
      status: mappedStatus,
      signaturePresent,
      verified,
      processingResult: "no_match",
      payload,
      headers,
      signatureHeader,
    });
    return { matched: false };
  }

  const transaction = await sequelize.transaction();
  try {
    const locked = await PayoutRequest.findByPk(payout.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const fromStatus = locked.status;
    const toStatus = mappedStatus || fromStatus;
    await locked.update(
      {
        status: toStatus,
        tierlock_order_id: payload?.order_id || payload?.data?.order_id || locked.tierlock_order_id,
        tierlock_transaction_id:
          payload?.transaction_id || payload?.data?.transaction_id || locked.tierlock_transaction_id,
        webhook_event: event || null,
        webhook_status: toStatus,
        webhook_verified: verified,
        webhook_received_at: new Date(),
        raw_webhook_payload: payload,
        status_history: appendStatusHistory(locked.status_history, {
          from_status: fromStatus,
          to_status: toStatus,
          event,
          timestamp: new Date().toISOString(),
          verified,
          payload_summary: {
            order_id: payload?.order_id || payload?.data?.order_id || null,
            transaction_id: payload?.transaction_id || payload?.data?.transaction_id || null,
            amount: payload?.amount || payload?.data?.amount || null,
          },
        }),
      },
      { transaction },
    );

    await auditService.logStatusChange(
      "payout_request",
      locked.id,
      fromStatus,
      toStatus,
      null,
      { action: "tierlock_payout_webhook", event, verified, soft_verified: softVerified },
      transaction,
    );

    await logPayoutWebhook({
      event,
      status: toStatus,
      signaturePresent,
      verified,
      processingResult: "processed",
      payoutRequestId: locked.id,
      payload,
      headers,
      signatureHeader,
    });

    await transaction.commit();
    emitToUserAndAdmins(locked.user_id, "payout:updated", { payoutId: locked.id, status: toStatus });
    return { matched: true, payoutRequestId: locked.id, status: toStatus };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const listPayoutRequests = async ({ userId, isAdmin, status, page = 1, limit = 20 }) => {
  const where = {};
  if (!isAdmin) where.user_id = userId;
  if (status) where.status = status;

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 20;

  const { rows, count } = await PayoutRequest.findAndCountAll({
    where,
    include: [{ association: "user", attributes: ["id", "email", "firstName", "lastName"] }],
    order: [["createdAt", "DESC"]],
    offset: (pageNumber - 1) * pageLimit,
    limit: pageLimit,
  });

  return {
    items: rows,
    totalCount: count,
    totalPages: Math.ceil(count / pageLimit),
    page: pageNumber,
    limit: pageLimit,
  };
};

export const payoutsService = {
  createPayoutRequest,
  updatePayoutStatus,
  matchTierlockPayoutWebhook,
  applyTierlockPayoutWebhook,
  listPayoutRequests,
  normalizePhone,
};
