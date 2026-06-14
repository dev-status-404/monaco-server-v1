import createError from "http-errors";
import Order from "../models/orders.model.js";
import PayoutRequest from "../models/payout_requests.model.js";
import PaymentWebhookLog from "../models/payment_webhook_logs.model.js";
import PayoutWebhookLog from "../models/payout_webhook_logs.model.js";
import AuditLog from "../models/audit_logs.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import { ordersService } from "../services/ordersService.js";
import { payoutsService } from "../services/payoutsService.js";
import { settingsService } from "../services/settingsService.js";
import { webhookService } from "../services/webhookService.js";
import { auditService } from "../services/auditService.js";
import config from "../config/env.js";

const allowedOrderStatuses = [
  "Pending Payment",
  "Payment Approved",
  "Failed",
  "Rejected",
  "Cancelled",
];

const allowedPayoutStatuses = [
  "Redeem Requested",
  "Under Review",
  "Approved",
  "Paid Out",
  "Rejected",
  "Failed",
  "Cancelled",
  "Expired",
];

const parseJsonBody = (req) => {
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf8");
    return text ? JSON.parse(text) : {};
  }
  return req.body || {};
};

const serializeHeaders = (headers = {}) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      key.toLowerCase() === "authorization"
        ? "[redacted]"
        : Array.isArray(value)
        ? value[0]
        : value,
    ]),
  );

const mapPaymentEventStatus = (eventType) => {
  if (eventType === "PAYMENT_SUCCESS") return "Payment Approved";
  if (eventType === "PAYMENT_FAILED") return "Failed";
  return null;
};

const createPixPayOrder = async (req, res, next) => {
  try {
    const order = await ordersService.createPixPayOrder(req.user, req.body || {});

    return res.status(201).json({
      success: true,
      orderId: order.id,
      paymentUrl: order.payment_url,
      data: {
        order,
        paymentUrl: order.payment_url,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createTierlockOrder = async (req, res, next) => {
  try {
    const order = await ordersService.createTierlockOrder(req.user, req.body || {});

    return res.status(201).json({
      success: true,
      data: {
        order,
        paymentUrl: order.payment_url,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const data = await ordersService.getUserOrders(req.user.id, {
      status: req.query.status,
      provider: req.query.provider,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const wallet = await WalletAccount.findOne({ where: { user_id: req.user.id } });
    const pixButtons = await settingsService.getPixButtons();
    const tierlockBuyNowUrl = await settingsService.getTierlockBuyNowUrl();
    const tierlockEnabled = await settingsService.getSetting("tierlock_enabled");
    const testMode = await settingsService.getSetting("test_mode");
    return res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: [req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() || req.user.display_name || req.user.email,
        display_name: req.user.display_name || null,
        credits_balance: Number(wallet?.balance ?? req.user.credits_balance ?? 0),
        tierlock_buy_now_url: tierlockBuyNowUrl,
        tierlock_enabled: Boolean(tierlockEnabled),
        test_mode: Boolean(testMode),
        pix_buttons: pixButtons,
        pix_payment_url: config.tierlock.pixPaymentUrl,
        created_at: req.user.createdAt,
        updated_at: req.user.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createPayoutRequest = async (req, res, next) => {
  try {
    const payout = await payoutsService.createPayoutRequest(req.user, req.body || {});
    return res.status(201).json({ success: true, data: payout });
  } catch (error) {
    return next(error);
  }
};

const getMyPayoutRequests = async (req, res, next) => {
  try {
    const data = await payoutsService.listPayoutRequests({
      userId: req.user.id,
      isAdmin: false,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminOrders = async (req, res, next) => {
  try {
    const data = await ordersService.getAdminOrders({
      status: req.query.status,
      provider: req.query.provider,
      customerEmail: req.query.customer_email,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const patchAdminOrderStatus = async (req, res, next) => {
  try {
    const { status, adminNotes, admin_notes } = req.body || {};
    if (!status && adminNotes === undefined && admin_notes === undefined) {
      throw createError(400, "status-or-admin-notes-required");
    }
    if (status && !allowedOrderStatuses.includes(status)) {
      throw createError(400, "invalid-order-status");
    }

    const order = await ordersService.updatePixPayOrderStatus(
      req.params.id,
      status,
      req.user.id,
      adminNotes ?? admin_notes,
    );

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

const getAdminPayoutRequests = async (req, res, next) => {
  try {
    const data = await payoutsService.listPayoutRequests({
      userId: req.user.id,
      isAdmin: true,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const patchAdminPayoutStatus = async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body || {};
    if (!allowedPayoutStatuses.includes(status)) {
      throw createError(400, "invalid-payout-status");
    }

    const payout = await payoutsService.updatePayoutStatus(req.params.id, status, req.user.id, {
      action: "admin_update_payout_status",
      admin_notes,
    });
    return res.status(200).json({ success: true, data: payout });
  } catch (error) {
    return next(error);
  }
};

const getPaymentWebhookLogs = async (_req, res, next) => {
  try {
    const rows = await PaymentWebhookLog.findAll({ order: [["createdAt", "DESC"]], limit: 200 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getPayoutWebhookLogs = async (_req, res, next) => {
  try {
    const rows = await PayoutWebhookLog.findAll({ order: [["createdAt", "DESC"]], limit: 200 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getAuditLogs = async (_req, res, next) => {
  try {
    const rows = await AuditLog.findAll({
      include: [{ association: "actor", attributes: ["id", "email", "firstName", "lastName"], required: false }],
      order: [["createdAt", "DESC"]],
      limit: 200,
    });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getSettings = async (_req, res, next) => {
  try {
    const settings = await settingsService.getAllSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return next(error);
  }
};

const patchSettings = async (req, res, next) => {
  try {
    const input = req.body || {};
    for (const key of ["tierlock_buy_now_url", "tierlock_enabled", "pix_buttons", "test_mode"]) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        await settingsService.setSetting(key, input[key]);
      }
    }
    return res.status(200).json({ success: true, data: await settingsService.getAllSettings() });
  } catch (error) {
    return next(error);
  }
};

const uploadPixButton = async (req, res, next) => {
  try {
    const slot = String(req.body?.slot || "").trim().toLowerCase();
    const allowed = ["cash_app", "venmo", "paypal", "visa_debit"];
    if (!allowed.includes(slot)) throw createError(400, "invalid-slot");

    let imageUrl = String(req.body?.imageUrl || "").trim();
    if (!imageUrl && req.file) {
      const mime = req.file.mimetype || "image/png";
      imageUrl = `data:${mime};base64,${req.file.buffer.toString("base64")}`;
    }
    if (!imageUrl) throw createError(400, "image-required");

    const current = await settingsService.getPixButtons();
    current[slot] = {
      ...(current?.[slot] || {}),
      label: current?.[slot]?.label || {
        cash_app: "Cash App",
        venmo: "Venmo",
        paypal: "PayPal",
        visa_debit: "Visa / Debit",
      }[slot],
      image_url: imageUrl,
    };
    await settingsService.setSetting("pix_buttons", current);

    return res.status(200).json({ success: true, data: current });
  } catch (error) {
    return next(error);
  }
};

const deletePixButton = async (req, res, next) => {
  try {
    const slot = String(req.params.slot || "").trim().toLowerCase();
    const current = await settingsService.getPixButtons();
    if (!Object.prototype.hasOwnProperty.call(current, slot)) throw createError(400, "invalid-slot");
    current[slot] = {
      ...(current?.[slot] || {}),
      image_url: "",
    };
    await settingsService.setSetting("pix_buttons", current);

    return res.status(200).json({ success: true, data: current });
  } catch (error) {
    return next(error);
  }
};

const handleTierlockPaymentWebhook = async (req, res, next) => {
  let payload = null;
  let parseError = null;
  let headers = {};
  let eventType = "";
  let transactionId = "";
  let orderId = "";
  let signaturePresent = false;
  let verified = false;

  const writeLog = async (processingResult, error = null) => {
    try {
      await ordersService.logPaymentWebhook({
        eventType,
        transactionId,
        orderId,
        signaturePresent,
        verified,
        processingResult,
        error,
        payload: payload || null,
        headers,
      });
    } catch (logError) {
      console.error("[tierlock-payment] failed to insert webhook log", logError);
    }
  };

  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
          "utf8",
        );
    const rawBodyText = rawBody.toString("utf8");
    headers = serializeHeaders(req.headers);

    try {
      payload = rawBodyText ? JSON.parse(rawBodyText) : null;
    } catch (error) {
      parseError = `Invalid JSON: ${error?.message || "parse-failed"}`;
    }

    eventType = String(payload?.type || payload?.data?.event || payload?.event || "").toUpperCase();
    transactionId = String(payload?.data?.transaction_id ?? payload?.transaction_id ?? "").trim();
    orderId = String(payload?.data?.order_id ?? payload?.order_id ?? "").trim();
    const totalAmountRaw = payload?.data?.total_amount ?? payload?.total_amount;
    const totalAmount = totalAmountRaw === undefined || totalAmountRaw === null ? null : Number(totalAmountRaw);

    const verification = webhookService.verifyTierlockPaymentSignature(rawBody, headers);
    signaturePresent = verification.signaturePresent;
    verified = verification.valid;

    if (!config.tierlock.webhookSecret) {
      await writeLog("config_error", "TIERLOCK_WEBHOOK_SECRET missing");
      return res.status(500).json({ success: false, message: "webhook-secret-not-configured" });
    }

    if (!verified) {
      await writeLog("invalid_signature", "Signature verification failed");
      return res.status(401).json({ success: false, message: "invalid-signature" });
    }

    if (parseError || !payload) {
      await writeLog("bad_payload", parseError || "Empty payload");
      return res.status(200).json({ ok: true });
    }

    const order = await ordersService.findMatchingOrder(payload);
    if (!order) {
      await writeLog("missing_order_or_transaction_id");
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (order.webhook_received_at) {
      await writeLog("duplicate_ignored");
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const mappedStatus = mapPaymentEventStatus(eventType);
    if (mappedStatus === "Payment Approved") {
      try {
        await Order.update(
          {
            transaction_id: transactionId || order.transaction_id || null,
            tierlock_order_id: orderId || order.tierlock_order_id || null,
            ...(Number.isFinite(totalAmount) ? { total_amount: totalAmount } : {}),
          },
          { where: { id: order.id } },
        );
        await ordersService.updatePixPayOrderStatus(order.id, "Payment Approved", null);
        const [receivedMarked] = await Order.update(
          { webhook_received_at: new Date() },
          { where: { id: order.id, webhook_received_at: null } },
        );
        if (!receivedMarked) {
          await writeLog("duplicate_ignored");
          return res.status(200).json({ ok: true, duplicate: true });
        }
      } catch (error) {
        await writeLog("order_update_failed", error?.message || "approval-failed");
        return res.status(200).json({ ok: true });
      }

      await writeLog(`credited:${Number(order.credits || 0)}`);
      return res.status(200).json({ ok: true });
    } else if (mappedStatus === "Failed") {
      try {
        await Order.update(
          {
            transaction_id: transactionId || order.transaction_id || null,
            tierlock_order_id: orderId || order.tierlock_order_id || null,
          },
          { where: { id: order.id } },
        );
        await ordersService.updatePixPayOrderStatus(order.id, "Failed", null);
        const [receivedMarked] = await Order.update(
          { webhook_received_at: new Date() },
          { where: { id: order.id, webhook_received_at: null } },
        );
        if (!receivedMarked) {
          await writeLog("duplicate_ignored");
          return res.status(200).json({ ok: true, duplicate: true });
        }
      } catch (error) {
        await writeLog("order_update_failed", error?.message || "failure-status-update-failed");
        return res.status(200).json({ ok: true });
      }

      await writeLog("order_marked_failed");
      return res.status(200).json({ ok: true });
    }

    await writeLog(`ignored_event:${eventType || "unknown"}`);
    return res.status(200).json({ ok: true, ignored: true });
  } catch (error) {
    await writeLog("processing_error", error?.message || "tierlock-webhook-processing-failed");
    return res.status(200).json({ ok: true });
  }
};

const handleTierlockPayoutWebhook = async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const payload = parseJsonBody(req);
    const result = await payoutsService.applyTierlockPayoutWebhook(payload, serializeHeaders(req.headers), rawBody);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const seedCurrentStatusAudit = async (req, res, next) => {
  try {
    const entityType = String(req.body?.entity_type || "").trim();
    const entityId = String(req.body?.entity_id || "").trim();
    const status = String(req.body?.status || "").trim();
    if (!entityType || !entityId || !status) throw createError(400, "missing-fields");
    await auditService.logStatusChange(entityType, entityId, null, status, req.user.id, { action: "seed_status" });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const paymentSystemController = {
  createPixPayOrder,
  createTierlockOrder,
  getMyOrders,
  createPayoutRequest,
  getMyPayoutRequests,
  getMyProfile,
  getAdminOrders,
  patchAdminOrderStatus,
  getAdminPayoutRequests,
  patchAdminPayoutStatus,
  getPaymentWebhookLogs,
  getPayoutWebhookLogs,
  getAuditLogs,
  getSettings,
  patchSettings,
  uploadPixButton,
  deletePixButton,
  handleTierlockPaymentWebhook,
  handleTierlockPayoutWebhook,
  seedCurrentStatusAudit,
};
