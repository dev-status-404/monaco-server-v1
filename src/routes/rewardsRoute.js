import express from "express";
import auth from "../middlewares/auth.js";
import { rewardsController } from "../controllers/rewardsController.js";

const router = express.Router();

// Rewards routes
router.post("/create", rewardsController.createReward);
router.post("/update", rewardsController.updateReward);
router.get("/get", rewardsController.getAllRewards);
router.delete("/delete/:id", rewardsController.deleteReward);

export default router;
