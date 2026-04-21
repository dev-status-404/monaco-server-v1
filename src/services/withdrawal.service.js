import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/db.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { transactionService } from "./transaction.service.js";

const requestWithdrawal = async ({ userId, address, amountSats, memo, referenceId }) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  if (!address || !String(address).trim()) {
    throw createError(400, "address-required");
  }

  const numericAmountSats = Number(amountSats);
  if (!Number.isFinite(numericAmountSats) || numericAmountSats < 1) {
    throw createError(400, "invalid-amountSats");
  }

  const balance = await pointsmateClient.getBalance({ accountId: userContext.accountId });
  const spendable = Number(balance?.totalBalance?.totalSpendableBalance || balance?.balanceSats || 0);
  if (!Number.isFinite(spendable) || numericAmountSats > spendable) {
    throw createError(400, "insufficient-balance");
  }

  const safeReferenceId = referenceId || uuidv4();
  const tx = await sequelize.transaction();

  try {
    const existing = await WalletTransaction.findOne({
      where: { idempotency_key: safeReferenceId },
      transaction: tx,
    });

    if (existing) {
      throw createError(409, "duplicate-reference-id");
    }

    const walletTx = await WalletTransaction.create(
      {
        wallet_account_id: userContext.wallet.id,
        user_id: userId,
        type: "withdrawal",
        direction: "debit",
        amount: (numericAmountSats / 100000000).toFixed(8),
        status: "pending",
        api_status: "pending",
        reference_type: "pointsmate_send",
        idempotency_key: safeReferenceId,
        meta: {
          memo,
          amountSats: String(numericAmountSats),
          address: String(address).trim(),
        },
      },
      { transaction: tx },
    );

    const provider = await pointsmateClient.sendFunds({
      accountId: userContext.accountId,
      address: String(address).trim(),
      amountSats: numericAmountSats,
      memo,
      referenceId: safeReferenceId,
    });

    await walletTx.update(
      {
        api_status: provider?.isSucceed ? "initiated" : "failed",
        meta: {
          ...(walletTx.meta || {}),
          providerTransactionId: provider.transactionId,
          providerResponse: provider,
        },
      },
      { transaction: tx },
    );

    await tx.commit();

    return {
      transactionId: walletTx.id,
      pmTransactionId: provider.transactionId,
      status: "PENDING",
      message: "Withdrawal initiated. Will complete when confirmed.",
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const withdrawalServiceV2 = {
  requestWithdrawal,
};
