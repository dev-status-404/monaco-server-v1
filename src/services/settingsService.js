import SystemSetting from "../models/system_settings.model.js";
import config from "../config/env.js";

const DEFAULT_PIX_BUTTONS = {
  cash_app: {
    label: "Cash App",
    image_url: "",
  },
  venmo: {
    label: "Venmo",
    image_url: "",
  },
  paypal: {
    label: "PayPal",
    image_url: "",
  },
  visa_debit: {
    label: "Visa / Debit",
    image_url: "",
  },
};

const DEFAULT_SETTINGS = {
  tierlock_buy_now_url: "https://app.tierlock.com/dkYcMHTw",
  tierlock_enabled: true,
  pix_buttons: DEFAULT_PIX_BUTTONS,
  test_mode: false,
};

const normalizeSettingValue = (key, value) => {
  if (key === "pix_buttons") {
    const incoming = value && typeof value === "object" ? value : {};

    const normalizeButton = (slot, fallback) => {
      const slotValue = incoming?.[slot];

      if (typeof slotValue === "string") {
        return {
          label: fallback.label,
          image_url: slotValue,
        };
      }

      if (slotValue && typeof slotValue === "object") {
        return {
          label: String(slotValue.label || fallback.label),
          image_url: String(slotValue.image_url || ""),
        };
      }

      return { ...fallback };
    };

    return {
      cash_app: normalizeButton("cash_app", DEFAULT_PIX_BUTTONS.cash_app),
      venmo: normalizeButton("venmo", DEFAULT_PIX_BUTTONS.venmo),
      paypal: normalizeButton("paypal", DEFAULT_PIX_BUTTONS.paypal),
      visa_debit: normalizeButton("visa_debit", DEFAULT_PIX_BUTTONS.visa_debit),
    };
  }

  if (value === undefined && key === "tierlock_buy_now_url") {
    return DEFAULT_SETTINGS.tierlock_buy_now_url;
  }

  return value;
};

const ensureSetting = async (key) => {
  const existing = await SystemSetting.findOne({ where: { key } });
  if (existing) return existing;

  return SystemSetting.create({
    key,
    value: normalizeSettingValue(key, DEFAULT_SETTINGS[key]),
  });
};

const getSetting = async (key) => {
  const row = await ensureSetting(key);
  return normalizeSettingValue(key, row?.value);
};

const setSetting = async (key, value) => {
  const normalized = normalizeSettingValue(key, value);
  const row = await ensureSetting(key);
  await row.update({ value: normalized });
  return normalized;
};

const getAllSettings = async () => {
  const entries = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    entries[key] = await getSetting(key);
  }

  entries.pix_payment_url = config.tierlock.pixPaymentUrl;

  return entries;
};

const getTierlockBuyNowUrl = async () => {
  if (config.tierlock.buyNowUrl) {
    return String(config.tierlock.buyNowUrl);
  }
  return String(await getSetting("tierlock_buy_now_url"));
};

const getPixButtons = async () => {
  return normalizeSettingValue("pix_buttons", await getSetting("pix_buttons"));
};

export const settingsService = {
  getSetting,
  setSetting,
  getAllSettings,
  getTierlockBuyNowUrl,
  getPixButtons,
};
