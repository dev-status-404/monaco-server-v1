import express from "express";
import auth from "../middlewares/auth.js";
import { walletAccountController } from "../controllers/walletAccountController.js";

const router = express.Router();

// Wallet Account routes
router.post("/create", walletAccountController.createWalletAccount);
router.put("/update", walletAccountController.updateWalletAccount);
router.get("/get", walletAccountController.getAllWalletAccounts);
router.delete("/delete/:id", walletAccountController.deleteWalletAccount);
router.post("/bulk-delete", walletAccountController.bulkDeleteWalletAccounts);

export default router;
