// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import { rateLimit } from "express-rate-limit";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import ApiError from "./utils/ApiError.js";
import config from "./config/env.js";
import dbConnection from "./config/db.js";

import { applyAssociations } from "./models/associations.js";

import authRoutes from "./routes/authRoute.js";
import userRoutes from "./routes/userRoute.js";
import rewardsRoutes from "./routes/rewardsRoute.js";
import walletAccountRoutes from "./routes/walletAccountRoute.js";
import depositsRoutes from "./routes/depositsRoute.js";
import invitesRoutes from "./routes/invitesRoute.js";
import walletTransactionsRoutes from "./routes/walletTransactionsRoute.js";
import gameRoutes from "./routes/gameRoute.js";
import withdrawalRequestRoutes from "./routes/withdrawalRequestRoute.js";
import gameCredentialsRoutes from "./routes/gameCredentialsRoute.js";
import DashboardRoutes from "./routes/dashboardRoute.js";
import gameRequestRoutes from "./routes/gameRequestRoute.js";
import walletRoutes from "./routes/wallet.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import notificationRoutes from "./routes/notificationRoute.js";
import tierlockRoutes from "./routes/tierlock.routes.js";
import tierlockWebhookRoutes from "./routes/tierlock.webhook.routes.js";
import paymentSystemRoutes from "./routes/paymentSystem.routes.js";
import paymentWebhooksRoutes from "./routes/paymentWebhooks.routes.js";
import { startWebhookQueueWorker } from "./services/webhookQueue.service.js";

const app = express();
const globalPrefix = "/public/api/v1";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
  "https://luke-client-v1.vercel.app",
  "https://www.luke-client-v1.vercel.app",
  "https://ucsweeps.com",
  "https://www.ucsweeps.com",
  "https://www.monacogameroom.com",
  "https://monacogameroom.com"
];
const allowedOrigins =
  config.cors.allowedOrigins.length > 0
    ? config.cors.allowedOrigins
    : defaultAllowedOrigins;

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-recaptcha-token",
    "x-recaptcha-token",
    "X-Webhook-Hash",
    "x-webhook-hash",
    "x-webhook-signature",
    "x-webhook-timestamp",
    "x-webhook-version",
  ],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const webhookJsonParser = express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString("utf8");
  },
});

// Webhooks are mounted before global JSON middleware so they can be processed independently.
app.use("/webhook", express.json({ limit: "2mb" }), webhookRoutes);
app.use(`${globalPrefix}/webhooks`, express.json({ limit: "2mb" }), webhookRoutes);
app.use(
  "/api/tierlock/webhook",
  express.raw({ type: "*/*", limit: "2mb" }),
  tierlockWebhookRoutes,
);
app.use(
  `${globalPrefix}/tierlock/webhook`,
  express.raw({ type: "*/*", limit: "2mb" }),
  tierlockWebhookRoutes,
);
app.use(
  "/api/public/webhooks",
  express.raw({ type: "*/*", limit: "2mb" }),
  paymentWebhooksRoutes,
);
app.use(
  "/api/webhooks",
  express.raw({ type: "*/*", limit: "2mb" }),
  paymentWebhooksRoutes,
);
app.use(
  `${globalPrefix}/public/webhooks`,
  express.raw({ type: "*/*", limit: "2mb" }),
  paymentWebhooksRoutes,
);
app.use(
  `${globalPrefix}/webhooks`,
  express.raw({ type: "*/*", limit: "2mb" }),
  paymentWebhooksRoutes,
);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

await dbConnection();

if (config.env === "production") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  });
  app.use(`${globalPrefix}/auth`, limiter);
}
applyAssociations();
startWebhookQueueWorker();

app.use(`${globalPrefix}/auth`, authRoutes);
app.use(`${globalPrefix}/dashboard`, DashboardRoutes);
app.use(`${globalPrefix}/users`, userRoutes);
app.use(`${globalPrefix}/rewards`, rewardsRoutes);
app.use(`${globalPrefix}/wallet-accounts`, walletAccountRoutes);
app.use(`${globalPrefix}/deposits`, depositsRoutes);
app.use(`${globalPrefix}/invites`, invitesRoutes);
app.use(`${globalPrefix}/transactions`, walletTransactionsRoutes);
app.use(`${globalPrefix}/games`, gameRoutes);
app.use(`${globalPrefix}/withdrawal-requests`, withdrawalRequestRoutes);
app.use(`${globalPrefix}/game-requests`, gameRequestRoutes);
app.use(`${globalPrefix}/game-creds`, gameCredentialsRoutes);
app.use(`${globalPrefix}/wallet`, walletRoutes);
app.use(`${globalPrefix}/notifications`, notificationRoutes);
app.use(`${globalPrefix}/tierlock`, tierlockRoutes);
app.use("/api/tierlock", tierlockRoutes);
app.use(`${globalPrefix}`, paymentSystemRoutes);
app.use("/api", paymentSystemRoutes);


app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
