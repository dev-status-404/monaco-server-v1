import createError from "http-errors";
import { Op } from "sequelize";
import config from "../config/env.js";
import { sequelize } from "../config/db.js";
import Order from "../models/orders.model.js";
import User from "../models/user.model.js";
import WalletAccount from "../models/wallet_account.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import PaymentWebhookLog from "../models/payment_webhook_logs.model.js";
import { auditService } from "./auditService.js";
import { settingsService } from "./settingsService.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";

const PIX_METHODS = ["Cash App", "Venmo", "PayPal", "Visa / Debit"];
const ORDER_STATUSES = [
  "Pending Payment",
  "Payment Approved",
  "Failed",
  "Rejected",
  "Cancelled",
];

const PIX_STATUS_ACTIONS = {
  "Payment Approved": "pix_pay_order_approved",
  Rejected: "pix_pay_order_rejected",
  Failed: "pix_pay_order_failed",
  Cancelled: "pix_pay_order_cancelled",
};
const PIX_NOTES_ACTION = "pix_pay_order_notes_updated";

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw createError(400, "invalid-amount");
  }
  return Number(value.toFixed(2));
};

const normalizeAdminNotes = (notes) => {
  if (notes === undefined || notes === null) return null;
  const value = String(notes).trim();
  return value ? value : null;
};

const normalizePixMethod = (method) => {
  const value = String(method || "").trim();
  if (!PIX_METHODS.includes(value)) {
    throw createError(400, "invalid-method");
  }
  return value;
};

const normalizeGameUsername = (gameUsername) => {
  const value = String(gameUsername || "").trim();
  if (!value) {
    throw createError(400, "game-username-required");
  }
  return value;
};

const buildOrderFilters = ({ userId, isAdmin, status, paymentProvider, customerEmail }) => {
  const where = {};

  if (!isAdmin) {
    where.user_id = userId;
  }

  if (status) {
    where.status = status;
  }

  if (paymentProvider) {
    where.payment_provider = paymentProvider;
  }

  if (isAdmin && customerEmail) {
    where.customer_email = {
      [Op.iLike]: `%${String(customerEmail).trim()}%`,
    };
  }

  return where;
};

const ensureWalletAccount = async (userId, transaction) => {
  let wallet = await WalletAccount.findOne({
    where: { user_id: userId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (!wallet) {
    wallet = await WalletAccount.create(
      {
        user_id: userId,
        balance: 0,
        currency: "USD",
        status: "active",
      },
      transaction ? { transaction } : undefined,
    );
  }

  return wallet;
};

const syncUserBalance = async (userId, transaction) => {
  const wallet = await ensureWalletAccount(userId, transaction);
  const balance = Number(wallet.balance || 0);

  await User.update(
    { credits_balance: balance },
    {
      where: { id: userId },
      transaction,
    },
  );
};

const creditUserForOrder = async (order, transaction) => {
  const lockedOrder = await Order.findByPk(order.id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!lockedOrder) {
    throw createError(404, "order-not-found");
  }

  if (lockedOrder.credits_sent_at) {
    return lockedOrder;
  }

  const wallet = await ensureWalletAccount(lockedOrder.user_id, transaction);
  const amount = Number(lockedOrder.credits || 0);

  await wallet.increment("balance", {
    by: amount,
    transaction,
  });

  await WalletTransaction.create(
    {
      wallet_account_id: wallet.id,
      user_id: lockedOrder.user_id,
      type: "deposit",
      direction: "credit",
      amount,
      status: "completed",
      api_status: "completed",
      reference_type: "order",
      reference_id: lockedOrder.id,
      idempotency_key: `order-credit:${lockedOrder.id}`,
      game_name: lockedOrder.game,
      meta: {
        provider: lockedOrder.payment_provider,
        payment_method: lockedOrder.payment_method,
        order_id: lockedOrder.id,
        transaction_id: lockedOrder.transaction_id,
      },
    },
    { transaction },
  );

  await lockedOrder.update(
    {
      credits_sent_at: new Date(),
    },
    { transaction },
  );

  await syncUserBalance(lockedOrder.user_id, transaction);

  return lockedOrder;
};

const createPixPayOrder = async (user, input) => {
  if (!user?.id) throw createError(401, "auth-required");

  const method = normalizePixMethod(input?.method);
  const gameUsername = normalizeGameUsername(input?.gameUsername);
  const numericAmount = normalizeAmount(input?.amount);
  const selectedGameName = String(input?.gameName || "").trim();

  const pixUrl = config.tierlock.pixPaymentUrl;

  return Order.create({
    user_id: user.id,
    customer_email: user.email,
    game: selectedGameName ? `${selectedGameName} - Pix - ${method}` : `Pix - ${method}`,
    game_username: String(gameUsername).trim(),
    payment_method: method,
    payment_provider: "pix_pay",
    amount: numericAmount,
    total_amount: numericAmount,
    credits: numericAmount,
    payment_url: pixUrl,
    status: "Pending Payment",
    payment_opened_at: new Date(),
  });
};

const createTierlockOrder = async (user, gameUsername, amount) => {
  if (!user?.id) throw createError(401, "auth-required");
  const payload =
    typeof gameUsername === "object" && gameUsername !== null
      ? gameUsername
      : { gameUsername, amount };

  if (!String(payload?.gameUsername || "").trim()) throw createError(400, "game-username-required");

  const numericAmount = normalizeAmount(payload?.amount);
  const paymentUrl = await settingsService.getTierlockBuyNowUrl();
  const selectedGameName = String(payload?.gameName || "").trim();

  return Order.create({
    user_id: user.id,
    customer_email: user.email,
    game: selectedGameName ? `${selectedGameName} - Tierlock Buy Now` : "Tierlock Buy Now",
    game_username: String(payload?.gameUsername).trim(),
    payment_method: "Buy Now",
    payment_provider: "tierlock",
    amount: numericAmount,
    total_amount: numericAmount,
    credits: numericAmount,
    payment_url: paymentUrl,
    status: "Pending Payment",
    payment_opened_at: new Date(),
  });
};

const updatePixPayOrderStatus = async (orderId, nextStatus, actorUserId, notes) => {
  if (nextStatus && (!ORDER_STATUSES.includes(nextStatus) || nextStatus === "Pending Payment")) {
    throw createError(400, "invalid-order-status");
  }

  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw createError(404, "order-not-found");
    }

    if (order.credits_sent_at && nextStatus && nextStatus !== "Payment Approved") {
      throw createError(409, "approved-order-cannot-change-status");
    }

    if (order.status === "Payment Approved" && nextStatus === "Payment Approved" && order.credits_sent_at) {
      await transaction.commit();
      return order;
    }

    const fromStatus = order.status;
    const adminNotes = normalizeAdminNotes(notes) ?? order.admin_notes ?? null;
    const resolvedStatus = nextStatus || order.status;
    const updatePayload = {
      status: resolvedStatus,
      admin_notes: adminNotes,
      approved_at:
        nextStatus && resolvedStatus === "Payment Approved"
          ? order.approved_at || new Date()
          : order.approved_at,
      rejected_at:
        nextStatus && resolvedStatus === "Rejected" ? new Date() : order.rejected_at,
    };

    await order.update(updatePayload, { transaction });

    if (resolvedStatus === "Payment Approved" && nextStatus) {
      await creditUserForOrder(order, transaction);
    }

    const action =
      !nextStatus
        ? order.payment_provider === "pix_pay"
          ? PIX_NOTES_ACTION
          : "update_order_notes"
        : order.payment_provider === "pix_pay"
        ? PIX_STATUS_ACTIONS[resolvedStatus] || "pix_pay_order_updated"
        : resolvedStatus === "Payment Approved"
        ? "approve_order"
        : "reject_order";

    await auditService.logStatusChange(
      "order",
      order.id,
      fromStatus,
      resolvedStatus,
      actorUserId,
      {
        action,
        payment_provider: order.payment_provider,
        admin_notes: adminNotes,
      },
      transaction,
    );

    await transaction.commit();
    emitToUserAndAdmins(order.user_id, "order:updated", { orderId: order.id, status: resolvedStatus });
    return Order.findByPk(order.id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const listOrders = async ({
  userId,
  isAdmin,
  status,
  provider,
  paymentProvider,
  customerEmail,
  page = 1,
  limit = 20,
}) => {
  const where = buildOrderFilters({
    userId,
    isAdmin,
    status,
    paymentProvider: paymentProvider || provider,
    customerEmail,
  });

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 20;
  const offset = (pageNumber - 1) * pageLimit;

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [{ association: "user", attributes: ["id", "email", "firstName", "lastName"] }],
    order: [["createdAt", "DESC"]],
    offset,
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

const getUserOrders = async (userId, filters = {}) => {
  return listOrders({
    userId,
    isAdmin: false,
    ...filters,
  });
};

const getAdminOrders = async (filters = {}) => {
  return listOrders({
    isAdmin: true,
    ...filters,
  });
};

const findMatchingOrder = async (payload) => {
  const orderId = String(payload?.order_id || payload?.data?.order_id || "").trim();
  const transactionId = String(payload?.transaction_id || payload?.data?.transaction_id || "").trim();

  if (transactionId) {
    const byTransaction = await Order.findOne({
      where: { transaction_id: transactionId },
    });
    if (byTransaction) return byTransaction;
  }

  if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
    const byUuid = await Order.findOne({ where: { id: orderId } });
    if (byUuid) return byUuid;
  }

  if (orderId) {
    const byProviderOrder = await Order.findOne({
      where: { tierlock_order_id: orderId },
    });
    if (byProviderOrder) return byProviderOrder;
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return Order.findOne({
    where: {
      payment_provider: "tierlock",
      status: "Pending Payment",
      createdAt: { [Op.gte]: twoHoursAgo },
    },
    order: [["createdAt", "DESC"]],
  });
};

const logPaymentWebhook = async ({
  eventType,
  transactionId,
  orderId,
  signaturePresent,
  verified,
  processingResult,
  error,
  payload,
  headers,
}) => {
  return PaymentWebhookLog.create({
    event_type: eventType || null,
    transaction_id: transactionId || null,
    order_id: orderId || null,
    signature_present: signaturePresent,
    verified,
    processing_result: processingResult,
    error: error || null,
    payload,
    headers,
  });
};

export const ordersService = {
  PIX_METHODS,
  ORDER_STATUSES,
  createPixPayOrder,
  createTierlockOrder,
  getUserOrders,
  getAdminOrders,
  updatePixPayOrderStatus,
  creditUserForOrder,
  listOrders,
  findMatchingOrder,
  logPaymentWebhook,
  syncUserBalance,
  ensureWalletAccount,
};
