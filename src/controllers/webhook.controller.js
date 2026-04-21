import { enqueueWebhook } from "../services/webhookQueue.service.js";
import logger from "../utils/logger.js";

const ack = (res) => res.status(200).json({ received: true });

const handleReceiveWebhook = async (req, res) => {
  ack(res);
  try {
    await enqueueWebhook({
      channel: "receive",
      payload: req.body,
      incomingHash: req.headers["x-webhook-hash"],
    });
  } catch (error) {
    logger.error({ error: error?.message }, "receive webhook enqueue failed");
  }
};

const handleSendWebhook = async (req, res) => {
  ack(res);
  try {
    await enqueueWebhook({
      channel: "send",
      payload: req.body,
      incomingHash: req.headers["x-webhook-hash"],
    });
  } catch (error) {
    logger.error({ error: error?.message }, "send webhook enqueue failed");
  }
};

const handleSendLinkWebhook = async (req, res) => {
  ack(res);
  try {
    await enqueueWebhook({
      channel: "send-link",
      payload: req.body,
      incomingHash: req.headers["x-webhook-hash"],
    });
  } catch (error) {
    logger.error({ error: error?.message }, "send-link webhook enqueue failed");
  }
};

const handleCodeGenerateWebhook = async (req, res) => {
  ack(res);
  try {
    await enqueueWebhook({
      channel: "code-generate",
      payload: req.body,
      incomingHash: req.headers["x-webhook-hash"],
    });
  } catch (error) {
    logger.error({ error: error?.message }, "code-generate webhook enqueue failed");
  }
};

const handleCodeRedeemWebhook = async (req, res) => {
  ack(res);
  try {
    await enqueueWebhook({
      channel: "code-redeem",
      payload: req.body,
      incomingHash: req.headers["x-webhook-hash"],
    });
  } catch (error) {
    logger.error({ error: error?.message }, "code-redeem webhook enqueue failed");
  }
};

export const webhookController = {
  handleReceiveWebhook,
  handleSendWebhook,
  handleSendLinkWebhook,
  handleCodeGenerateWebhook,
  handleCodeRedeemWebhook,
};
