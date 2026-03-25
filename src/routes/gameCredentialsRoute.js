import express from "express";
import { gameCredentialsController } from "../controllers/gameCredentialsController.js";

const router = express.Router();

router.get("/get", gameCredentialsController.getCredentials);
router.post("/create", gameCredentialsController.create);
router.post("/assign", gameCredentialsController.assign);
router.patch("/:id", gameCredentialsController.update);
router.delete("/:id", gameCredentialsController.deleteCredential);
router.post("/bulk-delete", gameCredentialsController.bulkDelete);

export default router;