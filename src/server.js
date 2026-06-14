import http from "http";
import app from "./app.js";
import { PORT } from "./config/env.js";
import logger from "./utils/logger.js";
import { initWebSocket } from "./realtime/socket.js";

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  logger.info(`Linkr-Server listening on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (err) => {
  logger.error(`UnhandledRejection: ${err?.message || err}`);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error(`UncaughtException: ${err?.message || err}`);
  process.exit(1);
});

export default server;

