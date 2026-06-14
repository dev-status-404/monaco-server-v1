import express from "express";
import auth from "../middlewares/auth.js";
import { paymentSystemController } from "../controllers/paymentSystem.controller.js";
import { upload } from "../utils/upload.js";

const router = express.Router();

router.post("/orders/pix-pay", auth(["user", "admin"]), paymentSystemController.createPixPayOrder);
router.post("/orders/tierlock", auth(["user", "admin"]), paymentSystemController.createTierlockOrder);
router.get("/me/orders", auth(["user", "admin"]), paymentSystemController.getMyOrders);
router.post("/payout-requests", auth(["user", "admin"]), paymentSystemController.createPayoutRequest);
router.get("/me/payout-requests", auth(["user", "admin"]), paymentSystemController.getMyPayoutRequests);
router.get("/me/profile", auth(["user", "admin"]), paymentSystemController.getMyProfile);

router.get("/admin/orders", auth(["admin"]), paymentSystemController.getAdminOrders);
router.patch("/admin/orders/:id/status", auth(["admin"]), paymentSystemController.patchAdminOrderStatus);
router.get("/admin/payout-requests", auth(["admin"]), paymentSystemController.getAdminPayoutRequests);
router.patch("/admin/payout-requests/:id/status", auth(["admin"]), paymentSystemController.patchAdminPayoutStatus);
router.get("/admin/payment-webhook-logs", auth(["admin"]), paymentSystemController.getPaymentWebhookLogs);
router.get("/admin/payout-webhook-logs", auth(["admin"]), paymentSystemController.getPayoutWebhookLogs);
router.get("/admin/audit-logs", auth(["admin"]), paymentSystemController.getAuditLogs);
router.get("/admin/settings", auth(["admin"]), paymentSystemController.getSettings);
router.patch("/admin/settings", auth(["admin"]), paymentSystemController.patchSettings);
router.post("/admin/pix-buttons/upload", auth(["admin"]), upload.single("file"), paymentSystemController.uploadPixButton);
router.delete("/admin/pix-buttons/:slot", auth(["admin"]), paymentSystemController.deletePixButton);

export default router;
