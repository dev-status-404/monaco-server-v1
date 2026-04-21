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
  body("userId").isUUID(),
  body("address").isString().isLength({ min: 3, max: 300 }),
  body("amountSats").isInt({ min: 1 }),
  body("memo").optional().isString().isLength({ max: 100 }),
  body("referenceId").optional().isString().isLength({ max: 128 }),
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
    const data = await withdrawalRequestService.requestWithdrawal(req.body);
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
  balanceValidation,
  transactionDetailValidation,
  listValidation,
  depositFunds,
  requestWithdrawal,
  getBalance,
  listTransactions,
  getTransactionDetail,
};
