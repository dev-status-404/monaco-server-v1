import { Op } from "sequelize";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import config from "../config/env.js";
import User from "../models/user.model.js";
import WalletAccount from "../models/wallet_account.model.js";

const mapPointsmateStatus = (status = "") => {
  const normalized = String(status).toUpperCase();
  if (normalized === "COMPLETED" || normalized === "C") return "completed";
  if (normalized === "FAILED" || normalized === "D" || normalized === "DENIED") return "failed";
  if (normalized === "CANCELLED") return "canceled";
  if (normalized === "EXPIRED") return "canceled";
  return "pending";
};

const formatWalletTransaction = (tx) => {
  if (!tx) return null;

  const plain = typeof tx.toJSON === "function" ? tx.toJSON() : tx;
  const meta = plain?.meta || {};

  return {
    ...plain,
    address: meta.address || null,
    magic_link: meta.magicLink || null,
    magicLink: meta.magicLink || null,
    magic_link_expires_at: meta.magicLinkExpiresAt || null,
    magicLinkExpiresAt: meta.magicLinkExpiresAt || null,
    amount: meta.amount || plain.amount || null,
    amount_usd: meta.amountUsd || null,
    amountUsd: meta.amountUsd || null,
    provider_transaction_id:
      meta.providerTransactionId || meta.providerResponse?.transactionId || null,
    providerTransactionId:
      meta.providerTransactionId || meta.providerResponse?.transactionId || null,
  };
};

const resolveUserContext = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) return null;

  let wallet = await WalletAccount.findOne({ where: { user_id: userId } });

  if (!wallet) {
    wallet = await WalletAccount.create({
      user_id: userId,
      currency: "USD",
      status: "active",
      balance: 0,
    });
  }

  return {
    user,
    wallet,
    accountId: config.pointsMate.accountId,
  };
};

const listTransactions = async ({ userId, type, status, page = 1, limit = 20 }) => {
  const where = { user_id: userId };

  if (type) where.type = String(type).toLowerCase();
  if (status) where.status = String(status).toLowerCase();

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 20;
  const offset = (pageNumber - 1) * pageLimit;

  const { rows, count } = await WalletTransaction.findAndCountAll({
    where,
    offset,
    limit: pageLimit,
    order: [["createdAt", "DESC"]],
  });

  return {
    items: rows.map(formatWalletTransaction),
    totalCount: count,
    totalPages: Math.ceil(count / pageLimit),
    page: pageNumber,
    limit: pageLimit,
  };
};

const getTransactionDetail = async ({ userId, txId }) => {
  const tx = await WalletTransaction.findOne({ where: { id: txId, user_id: userId } });
  if (!tx) return null;

  const userContext = await resolveUserContext(userId);
  let providerTransaction = null;

  const providerId = tx?.meta?.providerTransactionId || tx?.meta?.providerResponse?.transactionId;
  if (userContext && providerId) {
    providerTransaction = await pointsmateClient.getTransaction({
      accountId: userContext.accountId,
      transactionId: providerId,
    });
  }

  return { tx: formatWalletTransaction(tx), providerTransaction };
};

const findByProviderIdentifiers = async ({ providerTransactionId, referenceId, type }) => {
  const where = {
    type,
    [Op.or]: [],
  };

  if (providerTransactionId) {
    where[Op.or].push({
      meta: {
        providerTransactionId,
      },
    });
  }

  if (referenceId) {
    where[Op.or].push({ idempotency_key: referenceId });
  }

  if (!where[Op.or].length) return null;

  return WalletTransaction.findOne({ where });
};

export const transactionService = {
  formatWalletTransaction,
  mapPointsmateStatus,
  resolveUserContext,
  listTransactions,
  getTransactionDetail,
  findByProviderIdentifiers,
};
