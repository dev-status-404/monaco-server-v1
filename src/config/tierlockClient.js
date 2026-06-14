import axios from "axios";
import createError from "http-errors";
import config from "./env.js";

const buildUrl = (path) => {
  const baseUrl = String(config.tierlock.baseUrl || "").replace(/\/+$/, "");
  const suffix = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${suffix}`;
};

const assertTierlockConfig = () => {
  if (!config.tierlock.enabled) {
    throw createError(503, "tierlock-disabled");
  }

  if (!config.tierlock.merchantId || !config.tierlock.merchantSecret) {
    throw createError(500, "tierlock-config-missing");
  }
};

const generateCheckoutLink = async ({ displayName, total, orderId }) => {
  assertTierlockConfig();

  const numericTotal = Number(total);
  if (!Number.isFinite(numericTotal) || numericTotal < 0.01) {
    throw createError(400, "tierlock-invalid-total");
  }

  try {
    const response = await axios.post(
      buildUrl("/api/generateLinkToken"),
      {
        merchant_id: config.tierlock.merchantId,
        merchant_secret: config.tierlock.merchantSecret,
        display_name: displayName || config.tierlock.displayName,
        total: numericTotal,
        order_id: orderId,
      },
      {
        timeout: config.tierlock.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    const responseData = response.data || {};
    const paymentUrl = responseData.payment_url || responseData.paymentUrl;

    if (!responseData.success || !paymentUrl) {
      throw createError(502, "tierlock-checkout-link-failed");
    }

    return {
      ...responseData,
      payment_url: paymentUrl,
      paymentUrl,
      order_id: orderId,
    };
  } catch (error) {
    const providerMessage =
      error?.response?.data?.message ||
      error?.message ||
      "tierlock-checkout-link-failed";

    throw createError(502, `tierlock-checkout-link-failed: ${providerMessage}`);
  }
};

const createPayoutLink = async ({ orderId, amount, phoneNumber, memo }) => {
  assertTierlockConfig();

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0.01) {
    throw createError(400, "tierlock-invalid-amount");
  }

  if (!phoneNumber || !String(phoneNumber).trim()) {
    throw createError(400, "tierlock-phone-number-required");
  }

  const normalizedPhone = String(phoneNumber).trim();

  try {
    const response = await axios.post(
      buildUrl(config.tierlock.payoutPath),
      {
        merchant_id: config.tierlock.merchantId,
        merchant_secret: config.tierlock.merchantSecret,
        order_id: orderId,
        amount: numericAmount.toFixed(2),
        phone_number: normalizedPhone,
        customer: {
          phone_number: normalizedPhone,
        },
        ...(memo ? { note: String(memo).slice(0, 255) } : {}),
        ...(config.tierlock.payoutWebhookUrl
          ? { webhook_url: config.tierlock.payoutWebhookUrl }
          : {}),
      },
      {
        timeout: config.tierlock.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    return response.data || {};
  } catch (error) {
    const providerMessage =
      error?.response?.data?.message ||
      error?.message ||
      "tierlock-payout-link-failed";

    throw createError(502, `tierlock-payout-link-failed: ${providerMessage}`);
  }
};

export const tierlockClient = {
  generateCheckoutLink,
  createPayoutLink,
};
