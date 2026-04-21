import axios from "axios";
import createError from "http-errors";
import config from "../config/env.js";

const terminalDepositStatuses = new Set(["confirmed", "approved"]);

const normalizeReceiveType = (rawType = "") => {
  const value = String(rawType || "").trim().toLowerCase();

  if (!value) return "Lightning";
  if (value.includes("on-chain") || value.includes("onchain")) return "onchain";

  return "Lightning";
};

const buildIdempotencyKey = ({ entityType, entityId, status }) => {
  return `pointsmate:${entityType}:${entityId}:${status}`;
};

const shouldTriggerDepositReceive = (previousStatus, nextStatus) => {
  const wasTerminal = terminalDepositStatuses.has(String(previousStatus || "").toLowerCase());
  const isTerminal = terminalDepositStatuses.has(String(nextStatus || "").toLowerCase());

  return !wasTerminal && isTerminal;
};

const buildReceiveUrl = () => {
  const baseUrl = (config.pointsMate.baseUrl || "").replace(/\/+$/, "");
  return `${baseUrl}/pmext/api/v1/wallet/receive`;
};

const buildSendUrl = () => {
  const baseUrl = (config.pointsMate.baseUrl || "").replace(/\/+$/, "");
  return `${baseUrl}/pmext/api/v1/wallet/send`;
};

const createReceiveRequest = async ({
  accountId,
  type,
  amount,
  memo,
  referenceId,
  idempotencyKey,
}) => {
  if (!config.pointsMate.enabled) {
    throw createError(503, "pointsmate-disabled");
  }

  if (!config.pointsMate.baseUrl || !config.pointsMate.apiKey) {
    throw createError(500, "pointsmate-config-missing");
  }

  if (!accountId) {
    throw createError(400, "pointsmate-account-id-required");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
    throw createError(400, "pointsmate-invalid-amount");
  }

  const payload = {
    accountId,
    type: normalizeReceiveType(type),
    amount: numericAmount,
    referenceId,
  };

  if (memo) payload.memo = String(memo).slice(0, 100);

  try {
    const response = await axios.post(buildReceiveUrl(), payload, {
      timeout: config.pointsMate.timeoutMs,
      headers: {
        Authorization: config.pointsMate.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
    });

    const responseData = response.data;

    if (!responseData || responseData.isSucceed === false) {
      throw createError(502, responseData?.message || "pointsmate-request-failed");
    }

    return responseData;
  } catch (error) {
    const providerMessage =
      error?.response?.data?.message || error?.message || "pointsmate-request-failed";

    throw createError(502, `pointsmate-receive-failed: ${providerMessage}`);
  }
};

const createSendRequest = async ({
  accountId,
  address,
  amount,
  memo,
  referenceId,
  idempotencyKey,
}) => {
  if (!config.pointsMate.enabled) {
    throw createError(503, "pointsmate-disabled");
  }

  if (!config.pointsMate.baseUrl || !config.pointsMate.apiKey) {
    throw createError(500, "pointsmate-config-missing");
  }

  if (!accountId) {
    throw createError(400, "pointsmate-account-id-required");
  }

  if (!address || !String(address).trim()) {
    throw createError(400, "withdrawal-destination-required");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
    throw createError(400, "pointsmate-invalid-amount");
  }

  const payload = {
    accountId,
    address: String(address).trim(),
    amount: numericAmount,
    referenceId,
  };

  if (memo) payload.memo = String(memo).slice(0, 100);

  try {
    const response = await axios.post(buildSendUrl(), payload, {
      timeout: config.pointsMate.timeoutMs,
      headers: {
        Authorization: config.pointsMate.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
    });

    const responseData = response.data;

    if (!responseData || responseData.isSucceed === false) {
      throw createError(502, responseData?.message || "pointsmate-request-failed");
    }

    return responseData;
  } catch (error) {
    const providerMessage =
      error?.response?.data?.message || error?.message || "pointsmate-request-failed";

    throw createError(502, `pointsmate-send-failed: ${providerMessage}`);
  }
};

export const walletIntegrationService = {
  buildIdempotencyKey,
  createReceiveRequest,
  createSendRequest,
  normalizeReceiveType,
  shouldTriggerDepositReceive,
};
