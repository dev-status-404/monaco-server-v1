import createError from "http-errors";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { where } from "sequelize";

const createWalletTransaction = async (data) => {
  const wallettransaction = await WalletTransaction.create(data, {
    returning: true,
  });

  if (!wallettransaction) {
    throw createError(400, "creating-failed");
  }

  return {
    success: true,
    data: wallettransaction,
    message: "Transaction-created",
    code: 201,
  };
};

const updateWalletTransaction = async (data) => {
  const wallettransaction = await WalletTransaction.update(
    { ...data },
    {
      where: { id: data.id },
    },
  );

  if (!wallettransaction) {
    throw createError(400, "update-failed");
  }

  return {
    success: true,
    data: wallettransaction,
    message: "Transaction-updated",
    code: 201,
  };
};

const getWalletTransaction = async (q) => {
  const {
    id,
    wallet_account_id,
    type,
    direction,
    amount,
    status,
    reference_type,
    reference_id,
    idempotency_key,
    page,
    limit,
  } = q;

  const where = {};

  if (id) where.id = id;
  if (wallet_account_id) where.wallet_account_id = wallet_account_id;
  if (type) where.type = type;
  if (direction) where.direction = direction;
  if (amount) where.amount = amount;
  if (status) where.status = status;
  if (reference_type) where.reference_type = reference_type;
  if (reference_id) where.reference_id = reference_id;
  if (idempotency_key) where.idempotency_key = idempotency_key;

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 10;
  const offset = (pageNumber - 1) * pageLimit;

  const { rows: wallettransactions, count } =
    await WalletTransaction.findAndCountAll({
      where,
      offset,
      limit: pageLimit,
      include: [
        {
          association: "walletAccount", // correct alias
          attributes: ["id", "user_id", "currency", "status", "balance"],
          include: [
            {
              association: "user", // WalletAccount.belongsTo(User, as: "user")
              attributes: ["id", "email", "firstName", "lastName"],
            },
          ],
        },
        {
          association: "user", // WalletTransaction.belongsTo(User, as: "user")
          attributes: ["id", "email", "firstName", "lastName"],
          required: false,
        },
        {
          association: "game", // WalletTransaction.belongsTo(Game, as: "game")
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  return {
    success: true,
    data: wallettransactions || null,
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      totalCount: count,
      totalPages: Math.ceil(count / pageLimit),
    },
    message: "wallettransactions-retrieved",
    code: 200,
  };
};

const deleteWalletTransaction = async (id) => {
  const wallettransactions = await WalletTransaction.destroy({ where: { id } });
  if (!wallettransactions) throw createError(400, "not-found");

  return {
    success: true,
    data: wallettransactions,
    message: "Transaction-deleted",
    code: 200,
  };
};

const bulkDeleteWalletTransaction = async (ids) => {
  const wallettransaction = await WalletTransaction.destroy({
    where: { id: ids },
  });
  if (!wallettransaction) throw createError(400, "not-found");

  return {
    success: true,
    data: wallettransaction,
    message: "WalletTransactions-deleted",
    code: 200,
  };
};

export const walletTransactionService = {
  createWalletTransaction,
  updateWalletTransaction,
  getWalletTransaction,
  deleteWalletTransaction,
  bulkDeleteWalletTransaction,
};
