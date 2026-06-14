import express from "express";
import { rateLimit } from "express-rate-limit";
import { tierlockController } from "../controllers/tierlock.controller.js";

const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many webhook requests, please try again later.",
});

router.post("/", webhookLimiter, tierlockController.handleWebhook);

export default router;

