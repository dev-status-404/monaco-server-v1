

import express from "express";
import auth from "../middlewares/auth.js";
import { depositsController } from "../controllers/depositsController.js";

const router = express.Router();

// Deposits routes
router.post("/create", depositsController.createDeposit);
router.get("/get", depositsController.getDeposits);
router.put("/update/:id", depositsController.updateDeposit);
router.delete("/delete/:id", depositsController.deleteDeposit);

export default router;