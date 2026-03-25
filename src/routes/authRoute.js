    import express from "express";
    import auth from "../middlewares/auth.js";
    import { authController } from "../controllers/authController.js";

    const router = express.Router();

    // Authentication routes
    router.post("/signup", authController.register);
    router.post("/signin", authController.login);
    router.post("/google-login", authController.googleLogin);
    router.post("/logout", authController.logout);
    router.post("/forgot-password" , authController.forgotPassword);
    router.post("/reset-password" , authController.resetPassword);
    router.get("/verification", auth(["user","admin"]), authController.verifyUserJWT);

    export default router;
