// index.js
import http from "http";
import app from "./app.js";
import { PORT } from "./config/env.js";
import logger from "./utils/logger.js";


// Create the HTTP server from Express
const server = http.createServer(app);

// Attach Socket.IO to this same HTTP server
// initWebSocket(server);

// Start listening
server.listen(PORT, () => {
  logger.info(`🚀 Linkr-Server listening on http://localhost:${PORT}`);
});

// Error handling
process.on("unhandledRejection", (err) => {
  logger.error(`UnhandledRejection: ${err?.message || err}`);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error(`UncaughtException: ${err?.message || err}`);
  process.exit(1);
});

export default server;
