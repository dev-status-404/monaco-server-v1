import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/db.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import { pointsmateClient } from "../config/pointsmateClient.js";
import { transactionService } from "./transaction.service.js";

const depositFunds = async ({ userId, amountSats, type, memo, referenceId }) => {
  const userContext = await transactionService.resolveUserContext(userId);
  if (!userContext) {
    throw createError(404, "user-or-wallet-not-found");
  }

  const normalizedType = String(type || "").toLowerCase();
  if (!["lightning", "onchain", "on-chain"].includes(normalizedType)) {
    throw createError(400, "invalid-receive-type");
  }

  const numericAmountSats = Number(amountSats);
  if (!Number.isFinite(numericAmountSats) || numericAmountSats < 1) {
    throw createError(400, "invalid-amountSats");
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
        type: "deposit",
        direction: "credit",
        amount: (numericAmountSats / 100000000).toFixed(8),
        status: "pending",
        api_status: "pending",
        reference_type: "pointsmate_receive",
        idempotency_key: safeReferenceId,
        meta: {
          memo,
          amountSats: String(numericAmountSats),
        },
      },
      { transaction: tx },
    );

    const provider = await pointsmateClient.createReceive({
      accountId: userContext.accountId,
      type: normalizedType.includes("on") ? "onchain" : "lightning",
      amountSats: numericAmountSats,
      memo,
      referenceId: safeReferenceId,
    });

    await walletTx.update(
      {
        api_status: "created",
        meta: {
          ...(walletTx.meta || {}),
          providerTransactionId: provider.transactionId,
          providerResponse: provider,
          address: provider.address,
          magicLink: provider.magicLink,
          magicLinkExpiresAt: provider.magicLinkExpiresAt,
          amountUsd: provider.amountUsd,
          amountSats: provider.amountSats,
        },
      },
      { transaction: tx },
    );

    await tx.commit();

    return {
      transactionId: walletTx.id,
      pmTransactionId: provider.transactionId,
      address: provider.address,
      magicLink: provider.magicLink,
      magicLinkExpiresAt: provider.magicLinkExpiresAt,
      amountSats: provider.amountSats || String(numericAmountSats),
      amountUsd: provider.amountUsd,
      status: "PENDING",
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

export const depositServiceV2 = {
  depositFunds,
};
