import { Server } from "socket.io";
import config from "../config/env.js";
import User from "../models/user.model.js";

let ioInstance = null;

const buildAllowedOrigins = () => {
  const defaults = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:5000",
    "https://ucsweeps.com",
    "https://www.ucsweeps.com",
    "https://monacogameroom.com",
    "https://www.monacogameroom.com",
  ];

  if (config.frontendUrl) {
    defaults.push(config.frontendUrl);
  }

  return Array.from(new Set(defaults));
};

export const initWebSocket = (httpServer) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = buildAllowedOrigins();
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by Socket CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.handshake.query?.userId;

    if (userId) {
      socket.join(`user:${userId}`);

      User.findByPk(userId, { attributes: ["id", "role"] })
        .then((user) => {
          if (user?.role === "admin") {
            socket.join("admin");
          }
        })
        .catch(() => {
          // Ignore join-role failure and keep user room subscription alive.
        });
    }

  });

  return ioInstance;
};

export const getWebSocket = () => ioInstance;

export const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
};

export const emitToAdmins = (eventName, payload) => {
  if (!ioInstance) return;
  ioInstance.to("admin").emit(eventName, payload);
};

export const emitToUserAndAdmins = (userId, eventName, payload) => {
  if (!ioInstance) return;
  if (userId) {
    ioInstance.to(`user:${userId}`).emit(eventName, payload);
  }
  ioInstance.to("admin").emit(eventName, payload);
};
