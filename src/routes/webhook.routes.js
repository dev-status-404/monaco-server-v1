import express from "express";
import { webhookController } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/pm/receive", webhookController.handleReceiveWebhook);
router.post("/pointsmate/receive", webhookController.handleReceiveWebhook);
router.post("/pointsmate/send", webhookController.handleSendWebhook);
router.post("/pointsmate/send-link", webhookController.handleSendLinkWebhook);
router.post("/pointsmate/code-generate", webhookController.handleCodeGenerateWebhook);
router.post("/pointsmate/code-redeem", webhookController.handleCodeRedeemWebhook);

export default router;
