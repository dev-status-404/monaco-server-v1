import express from "express";
import auth from "../middlewares/auth.js";
import { gamesRequestController } from "../controllers/gamesRequestController.js";

const router = express.Router();

// Invites routes
router.post("/create", gamesRequestController.createGameRequest);
router.get("/get", gamesRequestController.getGameRequest);
router.put("/update/:id", gamesRequestController.updateGameRequest);
router.delete("/delete/:id", gamesRequestController.deleteGameRequest);

export default router;