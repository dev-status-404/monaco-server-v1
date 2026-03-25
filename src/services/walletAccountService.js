import createError from "http-errors";
import WalletAccount from "../models/wallet_account.model.js";
import { where } from "sequelize";

const createWalletAccount = async (data) => {
  const walletAccount = await WalletAccount.create(data, {
    where: { id: data.id },
  });

  if (!walletAccount) {
    throw createError(400, "account-create-failed");
  }

  return {
    success: true,
    data: walletAccount,
    message: "account-created",
    code: 201,
  };
};
const updateWalletAccount = async (data) => {
  const walletAccount = await WalletAccount.update(data, {
    where: { id: data.id },
  });

  if (!walletAccount) {
    throw createError(400, "account-update-failed");
  }

  return {
    success: true,
    data: walletAccount,
    message: "account-updated",
    code: 200,
  };
};

const deleteWalletAccount = async (id) => {
  const walletAccount = await WalletAccount.destroy({ where: { id } });
  if (!walletAccount) throw createError(400, "not-found");

  return {
    success: true,
    data: walletAccount,
    message: "account-deleted",
    code: 200,
  };
};

const getAllWalletAccounts = async (q) => {
  const { page, limit, status, user_id } = q;

  let where = {};

  if (status) where.status = status;
  if (user_id) where.user_id = user_id;

  const [walletAccounts, count] = await WalletAccount.findAndCountAll({
    where,
    offset: (page - 1) * limit,
    limit,
    include: [
      {
        association: "walletAccount",
        attributes: ["id", "user_id", "currency", "status", "balance"],
        include: [
          {
            association: "user",
            attributes: ["id", "email", "firstName", "lastName"],
          },
        ],
      },
    ],
    attributes: ["id", "user_id", "currency", "status", "balance"],
  });

  if (!walletAccounts) throw createError(400, "not-found");

  return {
    success: true,
    data: {
      walletAccounts,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "accounts-found",
    code: 200,
  };
};

const bulkDeleteWalletAccounts = async (ids) => {
  const walletAccount = await WalletAccount.destroy({ where: { id: ids } });
  if (!walletAccount) throw createError(400, "not-found");

  return {
    success: true,
    data: walletAccount,
    message: "accounts-deleted",
    code: 200,
  };
};

export const walletAccountService = {
  createWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
  getAllWalletAccounts,
  bulkDeleteWalletAccounts,
};
