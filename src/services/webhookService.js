import crypto from "crypto";
import config from "../config/env.js";

const SIGNATURE_HEADERS = [
  "x-tierlock-signature",
  "x-signature",
  "signature",
  "x-webhook-signature",
];

const toBuffer = (value, encoding = "utf8") => {
  try {
    return Buffer.from(String(value || ""), encoding);
  } catch {
    return Buffer.from("");
  }
};

const timingSafeCompare = (expected, received) => {
  const expectedBuffer = toBuffer(expected);
  const receivedBuffer = toBuffer(received);
  if (!expectedBuffer.length || expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getSignatureFromHeaders = (headers = {}) => {
  for (const key of SIGNATURE_HEADERS) {
    const value = headers?.[key] || headers?.[key.toLowerCase()] || headers?.[key.toUpperCase()];
    if (value) {
      return String(Array.isArray(value) ? value[0] : value).trim();
    }
  }

  return "";
};

const buildDigests = (rawBody, secret) => {
  const base = crypto.createHmac("sha256", String(secret || "")).update(rawBody);
  return {
    hex: base.digest("hex"),
    base64: crypto.createHmac("sha256", String(secret || "")).update(rawBody).digest("base64"),
  };
};

const verifyAgainstSecret = (rawBody, headers, secret) => {
  const signature = getSignatureFromHeaders(headers);
  if (!signature || !secret) {
    return { valid: false, signature, signaturePresent: Boolean(signature), matchedEncoding: null };
  }

  const normalized = signature.replace(/^sha256=/i, "").trim();
  const digests = buildDigests(rawBody, secret);
  const validHex = timingSafeCompare(digests.hex, normalized);
  const validBase64 = timingSafeCompare(digests.base64, normalized);

  return {
    valid: validHex || validBase64,
    signature,
    signaturePresent: true,
    matchedEncoding: validHex ? "hex" : validBase64 ? "base64" : null,
  };
};

const verifyTierlockPaymentSignature = (rawBody, headers) =>
  verifyAgainstSecret(rawBody, headers, config.tierlock.webhookSecret);

const verifyTierlockPayoutSignature = (rawBody, headers) =>
  verifyAgainstSecret(rawBody, headers, config.tierlock.payoutWebhookSecret);

export const webhookService = {
  verifyTierlockPaymentSignature,
  verifyTierlockPayoutSignature,
  getSignatureFromHeaders,
  timingSafeCompare,
};
