import crypto from "crypto";

export const createHMACSignature = (body, secret) => {
  const timestamp = Date.now().toString();
  const payload = `${timestamp}:${JSON.stringify(body || {})}`;
  const signature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(payload)
    .digest("hex");

  return { signature, timestamp };
};

