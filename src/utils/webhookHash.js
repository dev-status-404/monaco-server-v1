import crypto from "crypto";

const md5 = (value) => crypto.createHash("md5").update(value).digest("hex");

const hasOwn = (payload, key) => Object.prototype.hasOwnProperty.call(payload, key);

const normalizeHeader = (value) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return String(rawValue || "").trim().toLowerCase();
};

const hashPart = (value) => (value === null ? "null" : String(value));

const getSignatureId = (payload = {}) => {
  if (hasOwn(payload, "transactionId")) return payload.transactionId;
  if (hasOwn(payload, "pointsCodeId")) return payload.pointsCodeId;
  if (hasOwn(payload, "magicLinkId")) return payload.magicLinkId;
  return undefined;
};

const safeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const verifyWebhookHash = (payload = {}, incomingHash, webhookSecret) => {
  const headerHash = normalizeHeader(incomingHash);
  const payloadHash = normalizeHeader(payload?.hashCode);

  if (!headerHash || !payloadHash || !safeEquals(headerHash, payloadHash)) {
    return false;
  }

  const signatureId = getSignatureId(payload);
  if (
    signatureId === undefined ||
    payload.amountSats === undefined ||
    payload.amountSats === null ||
    !payload.timestamp ||
    !webhookSecret
  ) {
    return false;
  }

  const raw = `${hashPart(signatureId)}|${hashPart(payload.amountSats)}|${payload.timestamp}|${webhookSecret}`;
  return safeEquals(md5(raw), headerHash);
};

export { verifyWebhookHash };
