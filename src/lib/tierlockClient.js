import axios from "axios";
import createError from "http-errors";
import config from "../config/env.js";
import { createHMACSignature } from "./hmac.js";

const tierlockApi = axios.create({
  baseURL: String(config.tierlock.apiBase || "").replace(/\/+$/, ""),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const tierlockStagingApi = axios.create({
  baseURL: String(config.tierlock.stagingApiBase || "").replace(/\/+$/, ""),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const ensureRequired = (value, label) => {
  if (String(value || "").trim()) return;
  throw createError(500, `tierlock-config-missing:${label}`);
};

const merchantAuthBody = () => {
  ensureRequired(config.tierlock.merchantId, "TIERLOCK_MERCHANT_ID");
  ensureRequired(config.tierlock.merchantSecret, "TIERLOCK_MERCHANT_SECRET");

  return {
    merchant_id: String(config.tierlock.merchantId).trim(),
    merchant_secret: String(config.tierlock.merchantSecret).trim(),
  };
};

const clientSecretHeader = () => {
  ensureRequired(
    config.tierlock.clientSecretBasic,
    "TIERLOCK_CLIENT_SECRET_BASIC",
  );
  const raw = String(config.tierlock.clientSecretBasic).trim();
  return /^Basic\s+/i.test(raw) ? raw : `Basic ${raw}`;
};

const signedHeaders = (body) => {
  ensureRequired(config.tierlock.hmacSecret, "TIERLOCK_HMAC_SECRET");

  const { signature, timestamp } = createHMACSignature(
    body,
    String(config.tierlock.hmacSecret).trim(),
  );

  return {
    "X-Internal-Signature": signature,
    "X-Internal-Timestamp": timestamp,
    "X-Client-Secret": clientSecretHeader(),
  };
};

const signedWhitelistHeaders = (body) => {
  const headers = signedHeaders(body);
  return {
    "x-internal-signature": headers["X-Internal-Signature"],
    "x-internal-timestamp": headers["X-Internal-Timestamp"],
    "x-client-secret": headers["X-Client-Secret"],
  };
};

const mapProviderError = (error, fallback) => {
  const status = Number(error?.response?.status || 502);
  const providerMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  throw createError(status, `tierlock-request-failed:${providerMessage}`);
};

const request = async (client, { method, url, data, headers }) => {
  try {
    const response = await client.request({ method, url, data, headers });
    return response.data;
  } catch (error) {
    mapProviderError(error, "tierlock-request-failed");
  }
};

const createPaymentLink = async ({ display_name, total, order_id }) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/generateLinkToken",
    data: {
      ...merchantAuthBody(),
      display_name,
      total,
      order_id,
    },
  });

const listTransactions = async (filters = {}) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/transactions",
    data: {
      ...merchantAuthBody(),
      ...filters,
    },
  });

const getTransactionById = async (transactionId) =>
  request(tierlockApi, {
    method: "POST",
    url: `/api/transactions/${encodeURIComponent(transactionId)}`,
    data: merchantAuthBody(),
  });

const getTransactionByOrderId = async (orderId) =>
  request(tierlockApi, {
    method: "POST",
    url: `/api/transactions/order/${encodeURIComponent(orderId)}`,
    data: merchantAuthBody(),
  });

const sendPayoutLink = async (body) =>
  request(tierlockStagingApi, {
    method: "POST",
    url: "/api/auth/payout/sendpaymentlinkpayoutforexternal",
    data: body,
    headers: signedHeaders(body),
  });

const getPayoutStatus = async (body) =>
  request(tierlockStagingApi, {
    method: "POST",
    url: "/api/user/payout/payout_status_by_transaction_id",
    data: body,
    headers: {
      "X-Client-Secret": clientSecretHeader(),
    },
  });

const sendPhoneOtp = async (body) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/phone/verification/send-otp",
    data: body,
    headers: signedHeaders(body),
  });

const verifyPhoneOtp = async (body) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/phone/verification/verify-otp",
    data: body,
    headers: signedHeaders(body),
  });

const whitelistSendOtp = async (body) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/whitelist/verification/send-otp",
    data: body,
    headers: signedWhitelistHeaders(body),
  });

const whitelistVerifyOtp = async (body) =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/whitelist/verification/verify-otp",
    data: body,
    headers: signedWhitelistHeaders(body),
  });

const getMerchantWhitelist = async () =>
  request(tierlockApi, {
    method: "POST",
    url: "/api/whitelist/get_merchant_whitelist",
    data: {},
    headers: signedWhitelistHeaders({}),
  });

const removeWhitelistEntry = async (whitelistId) => {
  const body = { whitelist_id: whitelistId };
  return request(tierlockApi, {
    method: "POST",
    url: "/api/whitelist/remove",
    data: body,
    headers: signedWhitelistHeaders(body),
  });
};

export const tierlockClient = {
  createPaymentLink,
  listTransactions,
  getTransactionById,
  getTransactionByOrderId,
  sendPayoutLink,
  getPayoutStatus,
  sendPhoneOtp,
  verifyPhoneOtp,
  whitelistSendOtp,
  whitelistVerifyOtp,
  getMerchantWhitelist,
  removeWhitelistEntry,
};
