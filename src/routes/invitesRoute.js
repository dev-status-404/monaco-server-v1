import express from "express";
import auth from "../middlewares/auth.js";
import { invitesController } from "../controllers/invitesController.js";

const router = express.Router();

// Invites routes
router.post("/create", invitesController.createInvite);
router.get("/get", invitesController.getInvites);
router.post("/use/:token", invitesController.useInvite);
router.put("/update/:id", invitesController.updateInvite);
router.delete("/delete/:id", invitesController.deleteInvite);

export default router;