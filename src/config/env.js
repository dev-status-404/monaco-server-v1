import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid("production", "development", "test")
      .required(),
    PORT: Joi.number().default(3000),

    // Database - either DB_URL or individual connection parameters are required
    DB_URL: Joi.string().description(
      "Database connection URL (used for CockroachDB)",
    ),
    DB_HOST: Joi.string().description("Database host"),
    DB_PORT: Joi.number()
      .default(26257)
      .description("Database port (CockroachDB default is 26257)"),
    DB_NAME: Joi.string().description("Database name"),
    DB_USER: Joi.string().description("Database user"),
    DB_PASSWORD: Joi.string().description("Database password"),

    // JWT
    JWT_SECRET: Joi.string().required().description("JWT secret key"),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description("minutes after which access tokens expire"),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number()
      .default(30)
      .description("days after which refresh tokens expire"),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which reset password token expires"),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which verify email token expires"),
    JWT_RESET_LINK_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which verify resetlink token expires"),

    // SMTP
    SMTP_HOST: Joi.string().description("server that will send the emails"),
    SMTP_PORT: Joi.number().description("port to connect to the email server"),
    SMTP_USERNAME: Joi.string().description("username for email server"),
    SMTP_PASSWORD: Joi.string().description("password for email server"),
    SMTP_PASSWORD: Joi.string().description(
      "the from field in the emails sent by the app",
    ),

    // Frontend
    FRONTEND_URL: Joi.string().description(
      "Frontend URL for CORS and email templates",
    ),

    // PointsMate
    POINTSMATE_ENABLED: Joi.boolean()
      .default(true)
      .description("Enable PointsMate wallet integration"),
    POINTSMATE_BASE_URL: Joi.string().description("PointsMate API base URL"),
    POINTSMATE_API_KEY: Joi.string().description("PointsMate API key"),
    POINTSMATE_ACCOUNT_ID: Joi.string().description(
      "Default PointsMate account ID",
    ),
    POINTSMATE_WEBHOOK_SECRET: Joi.string().description(
      "PointsMate webhook signature secret",
    ),
    POINTSMATE_TIMEOUT_MS: Joi.number()
      .default(15000)
      .description("PointsMate API request timeout in milliseconds"),

    // Redis / Queue
    REDIS_URL: Joi.string().description("Redis connection URL"),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Custom validation for database connection
if (
  !envVars.DB_URL &&
  !(envVars.DB_HOST && envVars.DB_NAME && envVars.DB_USER)
) {
  throw new Error(
    "Either DB_URL or all of DB_HOST, DB_NAME, and DB_USER must be provided",
  );
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  frontendUrl: envVars.FRONTEND_URL,

  db: {
    url: envVars.DB_URL,
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
  },

  crypto: {
    secretKey: envVars.CRYPTO_SECRET_KEY,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes:
      envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    verifyResetLinkExpirationMinutes:
      envVars.VERIFY_RESET_LINK_EXPIRATION_MINUTES,
    resetLinkExpirationMinutes: envVars.JWT_RESET_LINK_EXPIRATION_MINUTES,
  },

  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },

  recaptcha: {
    siteKey: envVars.RECAPTCHA_SITE_KEY,
    secretKey: envVars.RECAPTCHA_SECRET_KEY,
  },

  google: {
    clientId: envVars.GOOGLE_CLIENT_ID,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET,
  },

  pointsMate: {
    enabled: envVars.POINTSMATE_ENABLED,
    baseUrl: envVars.POINTSMATE_BASE_URL,
    apiKey: envVars.POINTSMATE_API_KEY,
    accountId: envVars.POINTSMATE_ACCOUNT_ID,
    webhookSecret: envVars.POINTSMATE_WEBHOOK_SECRET,
    timeoutMs: envVars.POINTSMATE_TIMEOUT_MS,
  },

  redis: {
    url: envVars.REDIS_URL,
  },
};

export default config;

export const {
  env,
  port,
  frontendUrl,
  jwt: {
    secret,
    accessExpirationMinutes,
    refreshExpirationDays,
    resetPasswordExpirationMinutes,
    verifyEmailExpirationMinutes,
  },
} = config;

export const NODE_ENV = env;
export const PORT = port;
export const FRONTEND_URL = frontendUrl;
export const JWT_SECRET = secret;
export const JWT_ACCESS_EXPIRATION_MINUTES = accessExpirationMinutes;
export const JWT_REFRESH_EXPIRATION_DAYS = refreshExpirationDays;
export const JWT_RESET_PASSWORD_EXPIRATION_MINUTES =
  resetPasswordExpirationMinutes;
export const JWT_VERIFY_EMAIL_EXPIRATION_MINUTES = verifyEmailExpirationMinutes;
