import { body, param, query } from "express-validator";
import validate from "../middlewares/validate.js";
import { depositService } from "../services/depositService.js";
import { withdrawalRequestService } from "../services/withdrawalRequestService.js";
import { walletServiceV2 } from "../services/wallet.service.js";

const depositValidation = validate([
  body("userId").isUUID(),
  body("amount").optional().isInt({ min: 1 }),
  body("amountSats").optional().isInt({ min: 1 }),
  body("type").isIn(["lightning", "onchain", "on-chain"]),
  body("memo").optional().isString().isLength({ max: 100 }),
  body("referenceId").optional().isString().isLength({ max: 128 }),
  body("gameId").optional().isUUID(),
  body("gameName").optional().isString().isLength({ max: 120 }),
]);

const withdrawValidation = validate([
  body("userId").optional().customSanitizer((v) => String(v)).isLength({ min: 1, max: 128 }),
  body("user_id").optional().customSanitizer((v) => String(v)).isLength({ min: 1, max: 128 }),
  body("address")
    .optional()
    .customSanitizer((v) => String(v))
    .isLength({ min: 3, max: 1024 }),
  body("destination")
    .optional()
    .customSanitizer((v) => String(v))
    .isLength({ min: 3, max: 1024 }),
  body("amountSats").optional().isInt({ min: 1 }),
  body("amount").optional().isFloat({ min: 0.01 }),
  body("method").optional().isString().isLength({ max: 50 }),
  body("currency").optional().isString().isLength({ max: 20 }),
  body("gameId").optional().customSanitizer((v) => String(v)).isLength({ min: 1, max: 128 }),
  body("game_id").optional().customSanitizer((v) => String(v)).isLength({ min: 1, max: 128 }),
  body("gameName").optional().isString().isLength({ max: 120 }),
  body("game_name").optional().isString().isLength({ max: 120 }),
  body("memo").optional().isString().isLength({ max: 100 }),
  body("referenceId").optional().isString().isLength({ max: 128 }),
  body().custom((payload) => {
    const userId = String(payload?.userId || payload?.user_id || "").trim();
    const destination = String(payload?.address || payload?.destination || "").trim();
    const amount = payload?.amountSats ?? payload?.amount;

    if (!userId) throw new Error("userId-or-user_id-required");
    if (!destination) throw new Error("address-or-destination-required");
    if (destination.length > 1024) throw new Error("destination-too-long");
    if (amount === undefined || amount === null || amount === "") {
      throw new Error("amount-or-amountSats-required");
    }

    return true;
  }),
]);

const approveWithdrawalValidation = validate([
  body("withdrawalId").optional().isUUID(),
  body("id").optional().isUUID(),
  body("reviewedByAdminId").optional().isUUID(),
  body("reviewed_by_admin_id").optional().isUUID(),
  body("adminNote").optional().isString().isLength({ max: 255 }),
  body("admin_note").optional().isString().isLength({ max: 255 }),
  body().custom((payload) => {
    if (!payload?.withdrawalId && !payload?.id) {
      throw new Error("withdrawalId-or-id-required");
    }

    return true;
  }),
]);

const balanceValidation = validate([param("userId").isUUID()]);

const transactionDetailValidation = validate([
  param("userId").isUUID(),
  param("txId").isUUID(),
]);

const listValidation = validate([
  param("userId").isUUID(),
  query("type").optional().isIn(["deposit", "withdrawal"]),
  query("status").optional().isIn(["pending", "completed", "failed", "canceled"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
]);

const depositFunds = async (req, res) => {
  try {
    const data = await depositService.depositFunds(req.body);
    return res.status(202).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "deposit-failed",
      },
    });
  }
};

const requestWithdrawal = async (req, res) => {
  try {
    const data = await withdrawalRequestService.requestWithdrawal({
      userId: req.body.userId || req.body.user_id,
      address: req.body.address || req.body.destination,
      amountSats: req.body.amountSats,
      amount: req.body.amount,
      memo: req.body.memo,
      referenceId: req.body.referenceId,
      method: req.body.method,
      currency: req.body.currency,
      gameId: req.body.gameId || req.body.game_id,
      gameName: req.body.gameName || req.body.game_name,
    });
    return res.status(202).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "withdrawal-failed",
      },
    });
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const data = await withdrawalRequestService.approveWithdrawalRequest({
      id: req.body.withdrawalId || req.body.id,
      reviewedByAdminId: req.body.reviewedByAdminId || req.body.reviewed_by_admin_id,
      adminNote: req.body.adminNote || req.body.admin_note,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "withdrawal-approval-failed",
      },
    });
  }
};

const getBalance = async (req, res) => {
  try {
    const data = await walletServiceV2.getBalanceByUser(req.params.userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "balance-fetch-failed",
      },
    });
  }
};

const listTransactions = async (req, res) => {
  try {
    const data = await walletServiceV2.listTransactionsByUser({
      userId: req.params.userId,
      type: req.query.type,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "transactions-fetch-failed",
      },
    });
  }
};

const getTransactionDetail = async (req, res) => {
  try {
    const data = await walletServiceV2.getTransactionDetailByUser({
      userId: req.params.userId,
      txId: req.params.txId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      success: false,
      error: {
        code: error?.statusCode || 400,
        message: error?.message || "transaction-fetch-failed",
      },
    });
  }
};

export const walletController = {
  depositValidation,
  withdrawValidation,
  approveWithdrawalValidation,
  balanceValidation,
  transactionDetailValidation,
  listValidation,
  depositFunds,
  requestWithdrawal,
  approveWithdrawal,
  getBalance,
  listTransactions,
  getTransactionDetail,
};
