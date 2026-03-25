import express from "express";
import auth from "../middlewares/auth.js";
import { gamesController } from "../controllers/gamesController.js";

const router = express.Router();

// User routes
router.post("/create", gamesController.createGame); //auth(["admin", "user"]),
router.post("/update", gamesController.updateGame); //auth(["admin", "user"]),
router.get("/get", gamesController.getGame); //auth(["admin", "user"]),
router.delete("/delete/:id", gamesController.deleteGame); //auth(["admin", "user"]),
router.post("/bulk-delete", gamesController.bulkDeleteGame); //auth(["admin", "user"]),

export default router;
