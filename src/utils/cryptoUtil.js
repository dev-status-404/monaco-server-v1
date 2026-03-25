// utils/crypto.util.js
import crypto from "crypto";
import config from "../config/env.js";

const rawSecret = config.crypto.secretKey || "default_secret_key_32bytes";

const ENCRYPTION_KEY = Buffer.from(rawSecret, "hex");

function encrypt(text) {
  const IV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, IV);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return `${IV.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export { encrypt, decrypt };
