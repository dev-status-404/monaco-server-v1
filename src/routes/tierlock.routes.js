import express from "express";
import { rateLimit } from "express-rate-limit";
import { tierlockController } from "../controllers/tierlock.controller.js";

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});

router.use(publicLimiter);

router.post("/payment-link", tierlockController.createPaymentLink);

router.get("/transactions", tierlockController.listTransactions);
router.get("/transactions/:transaction_id", tierlockController.getTransactionById);
router.get(
  "/transactions/order/:order_id",
  tierlockController.getTransactionByOrderId,
);

router.post("/payout/send-link", tierlockController.sendPayoutLink);
router.post("/payout/status", tierlockController.getPayoutStatus);

router.post("/phone/send-otp", tierlockController.sendPhoneOtp);
router.post("/phone/verify-otp", tierlockController.verifyPhoneOtp);

router.post("/whitelist/send-otp", tierlockController.sendWhitelistOtp);
router.post("/whitelist/verify-otp", tierlockController.verifyWhitelistOtp);
router.get("/whitelist", tierlockController.getWhitelist);
router.delete("/whitelist/:whitelist_id", tierlockController.removeWhitelist);

export default router;
