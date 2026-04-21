import express from "express";
import { notificationController } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/get", notificationController.getNotifications);
router.get("/summary", notificationController.getSummary);
router.patch("/read-all", notificationController.markAllRead);
router.patch("/read/:id", notificationController.markOneRead);
router.delete("/delete-all", notificationController.deleteAll);
router.delete("/delete/:id", notificationController.deleteOne);

export default router;
