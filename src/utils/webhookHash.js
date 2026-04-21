import crypto from "crypto";

const md5 = (value) => crypto.createHash("md5").update(value).digest("hex");

const verifyWebhookHash = (payload = {}, incomingHash, webhookSecret) => {
  if (!incomingHash || !payload?.hashCode) return false;
  if (incomingHash !== payload.hashCode) return false;

  const transactionOrCodeId = payload.transactionId || payload.pointsCodeId;
  if (!transactionOrCodeId || !payload.amountSats || !payload.timestamp || !webhookSecret) {
    // For payloads without enough fields, fallback to header/body hash equality only.
    return true;
  }

  const raw = `${transactionOrCodeId}|${payload.amountSats}|${payload.timestamp}|${webhookSecret}`;
  return md5(raw) === incomingHash;
};

export { verifyWebhookHash };
