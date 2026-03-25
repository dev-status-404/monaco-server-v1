import express from "express";
import auth from "../middlewares/auth.js";
import { withdrawalRequestController } from "../controllers/withdrawalRequestController.js";

const router = express.Router();

// Withdrawal Request routes
router.post("/create", withdrawalRequestController.createWithdrawalRequest);
router.put("/update", withdrawalRequestController.updateWithdrawalRequest);
router.get("/get", withdrawalRequestController.getWithdrawalRequest);
router.delete("/delete/:id", withdrawalRequestController.deleteWithdrawalRequest);
router.post("/bulk-delete", withdrawalRequestController.bulkDeleteWithdrawalRequests);

export default router;
