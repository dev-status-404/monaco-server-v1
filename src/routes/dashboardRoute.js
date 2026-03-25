import express from "express";
import auth from "../middlewares/auth.js";
import { dashboardController } from "../controllers/dashboardController.js";

const router = express.Router();

// Dashboard routes
router.get("/get", dashboardController.getDashboard);

export default router;
