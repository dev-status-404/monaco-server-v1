// middlewares/recaptcha-v2.js
import axios from "axios";
import config from "../config/env.js";

/**
 * reCAPTCHA v2 verify (checkbox or invisible)
 * Client should send token either:
 *  - body:   "g-recaptcha-response"
 *  - header: "X-Recaptcha-Token"
 */
export function recaptchaV2() {
  const SECRET = config.recaptcha.secretKey;
  if (!SECRET) {
    return res.status(400).json({ message: "Missing reCAPTCHA secret key" });
  }

  return async function verifyRecaptcha(req, res, next) {
    try {
      const token =
        req.body?.["g-recaptcha-response"] || req.get("x-recaptcha-token");

      if (!token) {
        return res.status(400).json({ message: "Missing reCAPTCHA token" });
      }

      // call Google's siteverify
      const params = new URLSearchParams();
      params.append("secret", SECRET);
      params.append("response", token);

      const { data } = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        params.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 5000,
        }
      );

      // v2 response: { success, challenge_ts, hostname, 'error-codes'? }
      if (!data?.success) {
        return res.status(403).json({
          message: "reCAPTCHA failed",
          errorCodes: data?.["error-codes"] || null,
        });
      }

      return next();
    } catch (err) {
      return res
        .status(502)
        .json({ message: "reCAPTCHA verify error", detail: err.message });
    }
  };
}
