import express from "express";
import auth from "../middlewares/auth.js";
import { userController } from "../controllers/userController.js";

const router = express.Router();

// User routes
router.post("/create", userController.updateUser);
router.put("/update", userController.updateUser);
router.get("/get",  userController.getUsers);
router.delete("/delete/:id", userController.deleteUser);
router.post("/bulk-delete", userController.bulkDeleteUsers);

export default router;
