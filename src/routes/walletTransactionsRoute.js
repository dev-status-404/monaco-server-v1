import express from "express";
import auth from "../middlewares/auth.js";
import { walletTransactionsController } from "../controllers/walletTransactionsController.js";

const router = express.Router();

// User routes
router.post("/create", walletTransactionsController.createWalletTransaction); //auth(["admin", "user"]),
router.post("/update", walletTransactionsController.updateWalletTransaction); //auth(["admin", "user"]),
router.get("/get", walletTransactionsController.getWalletTransaction); //auth(["admin", "user"]),
router.delete("/delete/:id", walletTransactionsController.deleteWalletTransaction); //auth(["admin", "user"]),
router.post("/bulk-delete", walletTransactionsController.bulkDeleteWalletTransaction); //auth(["admin", "user"]),

export default router;
