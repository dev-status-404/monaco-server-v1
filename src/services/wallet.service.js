import createError from "http-errors";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { transactionService } from "./transaction.service.js";

const getBalanceByUser = async (userId) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) throw createError(404, "user-or-wallet-not-found");

  const providerBalance = await pointsmateClient.getBalance({ accountId: userContext.accountId });

  return {
    walletId: providerBalance.walletId,
    balanceUsd: providerBalance.balanceUsd,
    balanceSats: providerBalance.balanceSats,
    spendable: providerBalance?.totalBalance?.totalSpendableBalance,
    locked: providerBalance?.totalBalance?.totalLockedBalance,
  };
};

const getTransactionDetailByUser = async ({ userId, txId }) => {
  const result = await transactionService.getTransactionDetail({ userId, txId });
  if (!result) throw createError(404, "transaction-not-found");

  return {
    local: result.tx,
    provider: result.providerTransaction,
  };
};

const listTransactionsByUser = async ({ userId, type, status, page, limit }) => {
  return transactionService.listTransactions({ userId, type, status, page, limit });
};

export const walletServiceV2 = {
  getBalanceByUser,
  getTransactionDetailByUser,
  listTransactionsByUser,
};
