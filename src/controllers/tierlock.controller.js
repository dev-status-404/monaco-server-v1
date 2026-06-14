import crypto from "crypto";
import createError from "http-errors";
import { z } from "zod";
import { tierlockClient } from "../lib/tierlockClient.js";
import { verifyWebhookSignature } from "../lib/webhookVerify.js";
import WebhookEvent from "../models/webhook_events.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";

const ALLOWED_WEBHOOK_EVENTS = new Set([
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_PENDING",
  "PAYOUT_APPROVED",
  "PAYOUT_SUCCESS",
  "PAYOUT_DECLINED",
  "PAYOUT_CANCELLED_BY_MERCHANT",
  "PAYOUT_FAILED",
  "PAYOUT_EXPIRED",
  "TEU_REQUESTED",
  "TEU_ISSUED",
  "TEU_ALLOCATED",
  "TEU_RELEASED",
  "TEU_REVOKED",
  "TEU_EXPIRED",
]);

const paymentLinkSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  total: z.coerce.number().positive(),
  order_id: z.string().trim().min(1).max(128),
});

const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sort_by: z.string().trim().optional(),
  sort_order: z.enum(["ASC", "DESC", "asc", "desc"]).optional(),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
});

const payoutSendLinkSchema = z.object({
  amount: z.coerce.number().positive(),
  phone: z.string().trim().min(8).max(20),
  customerName: z.string().trim().min(1).max(120),
  orderId: z.string().trim().min(1).max(128),
});

const payoutStatusSchema = z
  .object({
    transactionId: z.coerce.number().int().positive().optional(),
    orderId: z.string().trim().min(1).max(128).optional(),
  })
  .refine(
    (value) => Boolean(value.transactionId) || Boolean(value.orderId),
    "transactionId-or-orderId-required",
  );

const phoneOtpSchema = z.object({
  phone: z.string().trim().min(8).max(20),
});

const phoneVerifySchema = z.object({
  phone: z.string().trim().min(8).max(20),
  otp: z.string().trim().min(4).max(12),
});

const whitelistIdSchema = z.object({
  whitelist_id: z.coerce.number().int().positive(),
});

const normalizeEventType = (payload = {}) =>
  String(payload?.type || payload?.event || payload?.data?.event || "").toUpperCase();

const resolveIdempotencyKey = (payload = {}) => {
  const data = payload?.data || {};
  const eventType = normalizeEventType(payload) || "UNKNOWN";

  if (data?.transaction_id || payload?.transaction_id) {
    return `tierlock:${eventType}:transaction:${data?.transaction_id || payload?.transaction_id}`;
  }
  if (data?.order_id || payload?.order_id) {
    return `tierlock:${eventType}:order:${data?.order_id || payload?.order_id}`;
  }
  if (data?.teu_id || payload?.teu_id) {
    return `tierlock:${eventType}:teu:${data?.teu_id || payload?.teu_id}`;
  }

  const fallbackRaw = `${eventType}:${JSON.stringify(payload)}`;
  const hash = crypto.createHash("sha256").update(fallbackRaw).digest("hex");
  return `tierlock:${eventType}:hash:${hash}`;
};

const mapWebhookStatus = (eventType = "") => {
  const type = String(eventType).toUpperCase();
  if (["PAYMENT_SUCCESS", "PAYOUT_SUCCESS"].includes(type)) return "completed";
  if (["PAYMENT_PENDING", "PAYOUT_APPROVED"].includes(type)) return "pending";
  if (
    [
      "PAYMENT_FAILED",
      "PAYOUT_DECLINED",
      "PAYOUT_FAILED",
      "TEU_REVOKED",
    ].includes(type)
  ) {
    return "failed";
  }
  if (
    ["PAYOUT_CANCELLED_BY_MERCHANT", "PAYOUT_EXPIRED", "TEU_EXPIRED"].includes(
      type,
    )
  ) {
    return "canceled";
  }
  return "pending";
};

const processWebhookEventAsync = async (eventRecord, payload) => {
  const eventType = normalizeEventType(payload);
  const data = payload?.data || {};

  try {
    if (ALLOWED_WEBHOOK_EVENTS.has(eventType)) {
      const orderId = data?.order_id || payload?.order_id;
      const transactionId = data?.transaction_id || payload?.transaction_id;

      if (orderId) {
        const tx = await WalletTransaction.findOne({
          where: { idempotency_key: String(orderId) },
        });

        if (tx && tx.type === "deposit") {
          await tx.update({
            status: mapWebhookStatus(eventType),
            api_status: eventType,
            meta: {
              ...(tx.meta || {}),
              provider: "tierlock",
              orderId: String(orderId),
              providerTransactionId: transactionId ?? tx?.meta?.providerTransactionId,
              lastWebhookEvent: eventType,
              webhookData: data,
            },
          });
        }
      }
    }

    await eventRecord.update({ status: "handled" });
  } catch (error) {
    await eventRecord.update({
      status: "failed",
      payload: {
        ...(eventRecord.payload || {}),
        processing_error: error?.message || "webhook-processing-failed",
      },
    });

    logger.error(
      { error: error?.message, eventType },
      "tierlock webhook processing failed",
    );
  }
};

const parse = (schema, input) => {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issueMessage = result.error.issues.map((issue) => issue.message).join(", ");
  throw createError(400, issueMessage || "validation-error");
};

const createPaymentLink = async (req, res, next) => {
  try {
    const body = parse(paymentLinkSchema, req.body);
    const data = await tierlockClient.createPaymentLink(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const listTransactions = async (req, res, next) => {
  try {
    const filters = parse(transactionsQuerySchema, req.query);
    const data = await tierlockClient.listTransactions(filters);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transactionId = String(req.params.transaction_id || "").trim();
    if (!transactionId) throw createError(400, "transaction_id-required");

    const data = await tierlockClient.getTransactionById(transactionId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getTransactionByOrderId = async (req, res, next) => {
  try {
    const orderId = String(req.params.order_id || "").trim();
    if (!orderId) throw createError(400, "order_id-required");

    const data = await tierlockClient.getTransactionByOrderId(orderId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const sendPayoutLink = async (req, res, next) => {
  try {
    const body = parse(payoutSendLinkSchema, req.body);
    const data = await tierlockClient.sendPayoutLink(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getPayoutStatus = async (req, res, next) => {
  try {
    const body = parse(payoutStatusSchema, req.body);
    const data = await tierlockClient.getPayoutStatus(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    const rawBodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(String(req.body || ""), "utf8");
    const rawBodyText = rawBodyBuffer.toString("utf8");

    const check = verifyWebhookSignature({
      rawBody: rawBodyBuffer,
      signature,
      timestamp,
      webhookSecret: config.tierlock.webhookSecret,
    });

    if (!check.valid) {
      throw createError(401, `webhook-rejected:${check.reason}`);
    }

    let payload;
    try {
      payload = JSON.parse(rawBodyText || "{}");
    } catch {
      throw createError(400, "invalid-json-body");
    }

    const eventType = normalizeEventType(payload);
    const eventKey = resolveIdempotencyKey(payload);

    const existing = await WebhookEvent.findOne({
      where: { event_id: eventKey },
    });
    if (existing) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const eventRecord = await WebhookEvent.create({
      provider: "tierlock",
      event_type: eventType || "UNKNOWN",
      event_id: eventKey,
      status: "received",
      payload: {
        headers: {
          signature: String(signature || ""),
          timestamp: String(timestamp || ""),
        },
        raw: rawBodyText,
        parsed: payload,
      },
    });

    res.status(200).json({ received: true });

    setImmediate(() => {
      processWebhookEventAsync(eventRecord, payload);
    });
  } catch (error) {
    return next(error);
  }
};

const sendPhoneOtp = async (req, res, next) => {
  try {
    const body = parse(phoneOtpSchema, req.body);
    const data = await tierlockClient.sendPhoneOtp(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const verifyPhoneOtp = async (req, res, next) => {
  try {
    const body = parse(phoneVerifySchema, req.body);
    const data = await tierlockClient.verifyPhoneOtp(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const sendWhitelistOtp = async (req, res, next) => {
  try {
    const body = parse(phoneOtpSchema, req.body);
    const data = await tierlockClient.whitelistSendOtp(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const verifyWhitelistOtp = async (req, res, next) => {
  try {
    const body = parse(phoneVerifySchema, req.body);
    const data = await tierlockClient.whitelistVerifyOtp(body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getWhitelist = async (_req, res, next) => {
  try {
    const data = await tierlockClient.getMerchantWhitelist();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const removeWhitelist = async (req, res, next) => {
  try {
    const { whitelist_id } = parse(whitelistIdSchema, {
      whitelist_id: req.params.whitelist_id,
    });
    const data = await tierlockClient.removeWhitelistEntry(whitelist_id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const tierlockController = {
  createPaymentLink,
  listTransactions,
  getTransactionById,
  getTransactionByOrderId,
  sendPayoutLink,
  getPayoutStatus,
  handleWebhook,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendWhitelistOtp,
  verifyWhitelistOtp,
  getWhitelist,
  removeWhitelist,
};
