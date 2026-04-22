import axios from "axios";
import createError from "http-errors";
import config from "./env.js";

const getAccountId = (accountId) => accountId || config.pointsMate.accountId;
const getAuthorizationHeader = () => {
  const apiKey = String(config.pointsMate.apiKey || "").trim();

  if (!apiKey) return "";
  if (/^Bearer\s+/i.test(apiKey)) return apiKey;

  return `Bearer ${apiKey}`;
};

const client = axios.create({
  baseURL: (config.pointsMate.baseUrl || "").replace(/\/+$/, ""),
  timeout: config.pointsMate.timeoutMs,
  headers: {
    Authorization: getAuthorizationHeader(),
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const request = async ({ method, url, data, params }) => {
  if (!config.pointsMate.enabled) {
    throw createError(503, "pointsmate-disabled");
  }

  if (!config.pointsMate.baseUrl || !config.pointsMate.apiKey) {
    throw createError(500, "pointsmate-config-missing");
  }

  try {
    const response = await client.request({ method, url, data, params });
    return response.data;
  } catch (error) {
    const providerMessage =
      error?.response?.data?.message || error?.message || "pointsmate-request-failed";
    throw createError(502, `pointsmate-request-failed: ${providerMessage}`);
  }
};

const createReceive = async ({ accountId, type, amountSats, memo, referenceId }) =>
  request({
    method: "POST",
    url: "/pmext/api/v1/wallet/receive",
    data: {
      accountId: getAccountId(accountId),
      type,
      amountSats,
      memo,
      referenceId,
    },
  });

const sendFunds = async ({ accountId, address, amountSats, memo, referenceId }) =>
  request({
    method: "POST",
    url: "/pmext/api/v1/wallet/send",
    data: {
      accountId: getAccountId(accountId),
      address,
      amountSats,
      memo,
      referenceId,
    },
  });

const createSendLink = async ({ accountId }) =>
  request({
    method: "POST",
    url: "/pmext/api/v1/wallet/send-link",
    data: { accountId: getAccountId(accountId) },
  });

const generatePointsCode = async ({ accountId, amountSats, referenceId, memo }) =>
  request({
    method: "POST",
    url: "/pmext/api/v1/wallet/points-code/generate",
    data: {
      accountId: getAccountId(accountId),
      amountSats,
      referenceId,
      memo,
    },
  });

const redeemPointsCode = async ({ accountId, pointsCode, memo, referenceId }) =>
  request({
    method: "POST",
    url: "/pmext/api/v1/wallet/points-code/redeem",
    data: {
      accountId: getAccountId(accountId),
      pointsCode,
      memo,
      referenceId,
    },
  });

const getTransaction = async ({ accountId, transactionId }) =>
  request({
    method: "GET",
    url: `/pmext/api/v1/wallet/transaction/${getAccountId(accountId)}/${transactionId}`,
  });

const getBalance = async ({ accountId }) =>
  request({
    method: "GET",
    url: "/pmext/api/v1/wallet/balance",
    params: { accountId: getAccountId(accountId) },
  });

export const pointsmateClient = {
  createReceive,
  sendFunds,
  createSendLink,
  generatePointsCode,
  redeemPointsCode,
  getTransaction,
  getBalance,
};
