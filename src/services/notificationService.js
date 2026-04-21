import { Op } from "sequelize";
import createError from "http-errors";
import Notification from "../models/notifications.model.js";
import User from "../models/user.model.js";
import { emitToAdmins, emitToUser } from "../realtime/socket.js";

const normalizePagination = (page, limit) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));

  return {
    pageNumber,
    pageLimit,
    offset: (pageNumber - 1) * pageLimit,
  };
};

const getUserId = (payload = {}) => payload.userId || payload.user_id;

const createForUser = async ({ userId, type, title, message, meta = null }) => {
  if (!userId) return null;

  const notification = await Notification.create({
    user_id: userId,
    type: type || "system",
    title,
    message,
    meta,
  });

  emitToUser(userId, "notification:new", {
    type: "notification",
    action: "created",
    data: notification,
  });

  return notification;
};

const createForAdmins = async ({ type, title, message, meta = null }) => {
  const admins = await User.findAll({
    where: { role: "admin" },
    attributes: ["id"],
  });

  if (!admins.length) return [];

  const payload = admins.map((admin) => ({
    user_id: admin.id,
    type: type || "system",
    title,
    message,
    meta,
  }));

  const notifications = await Notification.bulkCreate(payload, { returning: true });

  emitToAdmins("notification:new", {
    type: "notification",
    action: "created",
  });

  return notifications;
};

const createForUserAndAdmins = async ({ userId, type, title, message, meta = null }) => {
  const records = [];

  const userNotification = await createForUser({
    userId,
    type,
    title,
    message,
    meta,
  });
  if (userNotification) records.push(userNotification);

  const adminNotifications = await createForAdmins({
    type,
    title,
    message,
    meta,
  });
  if (adminNotifications.length) records.push(...adminNotifications);

  return records;
};

const getNotifications = async ({ userId, user_id, page, limit, is_read }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");

  const { pageNumber, pageLimit, offset } = normalizePagination(page, limit);
  const where = { user_id: userId };

  if (typeof is_read !== "undefined") {
    where.is_read = String(is_read).toLowerCase() === "true";
  }

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: pageLimit,
    offset,
  });

  return {
    success: true,
    data: rows,
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      totalCount: count,
      totalPages: Math.ceil(count / pageLimit),
    },
    message: "notifications-retrieved",
    code: 200,
  };
};

const getSummary = async ({ userId, user_id }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");

  const unreadCount = await Notification.count({
    where: {
      user_id: userId,
      is_read: false,
    },
  });

  return {
    success: true,
    data: { unreadCount },
    message: "notifications-summary-retrieved",
    code: 200,
  };
};

const markAllRead = async ({ userId, user_id }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");

  await Notification.update(
    { is_read: true },
    {
      where: {
        user_id: userId,
        is_read: false,
      },
    },
  );

  emitToUser(userId, "notification:read-all", {
    type: "notification",
    action: "read_all",
  });

  return {
    success: true,
    data: null,
    message: "notifications-marked-read",
    code: 200,
  };
};

const deleteAll = async ({ userId, user_id }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");

  await Notification.destroy({ where: { user_id: userId } });

  emitToUser(userId, "notification:deleted-all", {
    type: "notification",
    action: "deleted_all",
  });

  return {
    success: true,
    data: null,
    message: "notifications-deleted",
    code: 200,
  };
};

const markOneRead = async ({ userId, user_id, id }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");
  if (!id) throw createError(400, "id is required");

  const [count] = await Notification.update(
    { is_read: true },
    {
      where: {
        id,
        user_id: userId,
        is_read: false,
      },
    },
  );

  if (!count) throw createError(404, "notification-not-found");

  emitToUser(userId, "notification:read", {
    type: "notification",
    action: "read",
    id,
  });

  return {
    success: true,
    data: null,
    message: "notification-marked-read",
    code: 200,
  };
};

const deleteOne = async ({ userId, user_id, id }) => {
  userId = getUserId({ userId, user_id });
  if (!userId) throw createError(400, "user_id is required");
  if (!id) throw createError(400, "id is required");

  const count = await Notification.destroy({
    where: {
      id,
      user_id: userId,
    },
  });

  if (!count) throw createError(404, "notification-not-found");

  emitToUser(userId, "notification:deleted", {
    type: "notification",
    action: "deleted",
    id,
  });

  return {
    success: true,
    data: null,
    message: "notification-deleted",
    code: 200,
  };
};

const deleteBeforeDate = async ({ userId, beforeDate }) => {
  if (!userId || !beforeDate) return;

  await Notification.destroy({
    where: {
      user_id: userId,
      createdAt: { [Op.lt]: beforeDate },
    },
  });
};

export const notificationService = {
  createForUser,
  createForAdmins,
  createForUserAndAdmins,
  getNotifications,
  getSummary,
  markAllRead,
  deleteAll,
  markOneRead,
  deleteOne,
  deleteBeforeDate,
};
