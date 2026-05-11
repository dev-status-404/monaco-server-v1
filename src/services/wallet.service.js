import createError from "http-errors";
import { transactionService } from "./transaction.service.js";
import WalletAccount from "../models/wallet_account.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";

const getBalanceByUser = async (userId) => {
  // Sum all completed credit deposit transactions for this user — this is the
  // authoritative view of how much the user has actually deposited and had
  // credited to their account. No PointsMate call needed.
  const txRows = await WalletTransaction.findAll({
    where: {
      user_id: userId,
      type: "deposit",
      direction: "credit",
      status: "completed",
    },
    attributes: ["amount"],
  });

  const totalDeposited = txRows.reduce(
    (sum, tx) => sum + Number(tx.amount ?? 0),
    0,
  );

  // wallet_account.balance is kept in sync by the deposit confirmation flow
  // but we prefer the transaction sum as it is always accurate even if the
  // account row hasn't been updated yet.
  const walletAccount = await WalletAccount.findOne({ where: { user_id: userId } });
  const accountBalance = Number(walletAccount?.balance ?? 0);

  const spendable = totalDeposited > 0 ? totalDeposited : accountBalance;

  return {
    spendable,
    totalDeposited,
    balance: spendable,
    currency: walletAccount?.currency ?? "USD",
    walletStatus: walletAccount?.status ?? "active",
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
