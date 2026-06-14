import express from "express";
import { webhookController } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/", webhookController.handleTierlockPaymentWebhook);
router.post("/payout", webhookController.handleTierlockPayoutWebhook);
router.post("/pm/receive", webhookController.handleReceiveWebhook);
router.post("/pointsmate/receive", webhookController.handleReceiveWebhook);
router.post("/pointsmate/send", webhookController.handleSendWebhook);
router.post("/pointsmate/send-link", webhookController.handleSendLinkWebhook);
router.post("/pointsmate/code-generate", webhookController.handleCodeGenerateWebhook);
router.post("/pointsmate/code-redeem", webhookController.handleCodeRedeemWebhook);
router.post("/tierlock/payment", webhookController.handleTierlockPaymentWebhook);
router.post("/tierlock/payout", webhookController.handleTierlockPayoutWebhook);
router.post(
  "/tierlock/standard-payment",
  webhookController.handleTierlockPaymentWebhook,
);
router.post("/tierlock/public-payout", webhookController.handleTierlockPayoutWebhook);

export default router;
