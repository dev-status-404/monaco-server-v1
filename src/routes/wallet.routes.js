import express from "express";
import auth from "../middlewares/auth.js";
import { walletController } from "../controllers/wallet.controller.js";

const router = express.Router();

router.post(
  "/deposit",
  // auth(["admin", "user"]),
  walletController.depositValidation,
  walletController.depositFunds,
);

router.post(
  "/withdraw",
  // auth(["admin", "user"]),
  walletController.withdrawValidation,
  walletController.requestWithdrawal,
);

router.post(
  "/withdraw/approve",
  // auth(["admin"]),
  walletController.approveWithdrawalValidation,
  walletController.approveWithdrawal,
);

router.get(
  "/balance/:userId",
  // auth(["admin", "user"]),
  walletController.balanceValidation,
  walletController.getBalance,
);

router.get(
  "/transactions/:userId",
  // auth(["admin", "user"]),
  walletController.listValidation,
  walletController.listTransactions,
);

router.get(
  "/transaction/:userId/:txId",
  // auth(["admin", "user"]),
  walletController.transactionDetailValidation,
  walletController.getTransactionDetail,
);

export default router;
