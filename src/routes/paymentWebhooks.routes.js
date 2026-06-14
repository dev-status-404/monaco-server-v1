import express from "express";
import { paymentSystemController } from "../controllers/paymentSystem.controller.js";

const router = express.Router();

router.post("/tierlock-payment", paymentSystemController.handleTierlockPaymentWebhook);
router.post("/tierlock-payout", paymentSystemController.handleTierlockPayoutWebhook);

export default router;
