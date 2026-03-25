// app.js
import express from "express";
import cors from "cors";
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

const app = express();
const globalPrefix = "/public/api/v1";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
  "https://luke-client-v1.vercel.app",
  "https://www.luke-client-v1.vercel.app",
  "https://ucsweeps.com",
  "https://www.ucsweeps.com"
];

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
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
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


app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
