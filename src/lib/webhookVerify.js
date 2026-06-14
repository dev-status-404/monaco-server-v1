import crypto from "crypto";

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const timestampToMs = (rawTimestamp) => {
  const numeric = Number(rawTimestamp);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 1e12) return Math.floor(numeric);
  return Math.floor(numeric * 1000);
};

export const verifyWebhookSignature = ({
  rawBody,
  signature,
  timestamp,
  webhookSecret,
  maxAgeMs = 5 * 60 * 1000,
}) => {
  if (!signature) return { valid: false, reason: "missing-signature" };
  if (!timestamp) return { valid: false, reason: "missing-timestamp" };

  const timestampMs = timestampToMs(timestamp);
  if (!timestampMs) return { valid: false, reason: "invalid-timestamp" };

  const ageMs = Math.abs(Date.now() - timestampMs);
  if (ageMs > maxAgeMs) return { valid: false, reason: "stale-timestamp" };

  const expected = crypto
    .createHmac("sha256", String(webhookSecret || ""))
    .update(rawBody)
    .digest("hex");

  if (!safeEqual(expected, signature)) {
    return { valid: false, reason: "signature-mismatch" };
  }

  return { valid: true };
};

