import  createError from "http-errors";
import GameRequest from "../models/games_request.model.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const createGameRequest = async (data) => {
  const gamesrequest = await GameRequest.create(data, {
    returning: true,
  });

  if (!gamesrequest) {
    throw createError(400, "creating-failed");
  }

  emitToUserAndAdmins(gamesrequest.user_id, "game_request:created", {
    type: "game_request",
    action: "created",
    requestId: gamesrequest.id,
    userId: gamesrequest.user_id,
    status: gamesrequest.status,
    data: gamesrequest,
  });

  await notificationService.createForUserAndAdmins({
    userId: gamesrequest.user_id,
    type: "game_request",
    title: "Game request created",
    message: `Game request ${gamesrequest.id} has been created.`,
    meta: {
      requestId: gamesrequest.id,
      status: gamesrequest.status,
    },
  });

  return {
    success: true,
    data: gamesrequest,
    message: "Game-Request-created",
    code: 201,
  };
};

const updateGameRequest = async (data) => {
  const existing = await GameRequest.findByPk(data.id);
  if (!existing) {
    throw createError(404, "not-found");
  }

  const gamesrequest = await GameRequest.update(
    { ...data },
    {
      where: { id: data.id },
    },
  );

  if (!gamesrequest) {
    throw createError(400, "Update-failed");
  }

  const updated = await GameRequest.findByPk(data.id);
  if (updated) {
    const normalizedStatus = String(updated.status || "").toLowerCase();
    emitToUserAndAdmins(updated.user_id, "game_request:updated", {
      type: "game_request",
      action: normalizedStatus === "approved" ? "approved" : "updated",
      requestId: updated.id,
      userId: updated.user_id,
      status: updated.status,
      data: updated,
    });

    await notificationService.createForUserAndAdmins({
      userId: updated.user_id,
      type: "game_request",
      title: "Game request updated",
      message: `Game request ${updated.id} is now ${updated.status}.`,
      meta: {
        requestId: updated.id,
        status: updated.status,
      },
    });

    if (normalizedStatus === "approved") {
      emitToUserAndAdmins(updated.user_id, "game_request:approved", {
        type: "game_request",
        action: "approved",
        requestId: updated.id,
        userId: updated.user_id,
        status: updated.status,
      });

      await notificationService.createForUserAndAdmins({
        userId: updated.user_id,
        type: "game_request",
        title: "Game request approved",
        message: `Game request ${updated.id} has been approved.`,
        meta: {
          requestId: updated.id,
          status: updated.status,
        },
      });
    }
  }

  return {
    success: true,
    data: updated || gamesrequest,
    message: "Game-Request-updated",
    code: 201,
  };
};

const getGame = async (q) => {
  const {
    id,
    user_id,
    game_id,
    admin_note,
    credential_id,
    status,
    page,
    limit,
  } = q;

  const where = {};

  if (id) where.id = id;
  if (user_id) where.user_id = user_id;
  if (admin_note) where.admin_note = admin_note;
  if (game_id) where.game_id = game_id;
  if (status) where.status = status;
  if (credential_id) where.credential_id = credential_id;

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 10;
  const offset = (pageNumber - 1) * pageLimit;

  const { rows: gamesrequest, count } = await GameRequest.findAndCountAll({
    where,
    offset,
    include: [
      {
        association: "user",
        attributes: ["id", "email", "firstName", "lastName"],
      },
      {
        association: "game",
        attributes: ["id", "name", "status"],
      },
      {
        association: "credential",
        attributes: ["id", "login_username","login_password_enc", "status"],
        required: false,
      },
      {
        association: "reviewedByAdmin",
        attributes: ["id", "email", "firstName", "lastName"],
        required: false,
      },
    ],
    limit: pageLimit,
  });

  return {
    success: true,
    data: gamesrequest || null,
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      totalCount: count,
      totalPages: Math.ceil(count / pageLimit),
    },
    message: "games-request-retrieved",
    code: 200,
  };
};

const deleteGameRequest = async (id) => {
  const gamesrequest = await GameRequest.destroy({ where: { id } });
  if (!gamesrequest) throw createError(400, "not-found");

  return {
    success: true,
    data: gamesrequest,
    message: "Game-request-deleted",
    code: 200,
  };
};

const bulkDeleteGameRequest = async (ids) => {
  const gamesrequest = await GameRequest.destroy({
    where: { id: ids },
  });
  if (!gamesrequest) throw createError(400, "not-found");

  return {
    success: true,
    data: gamesrequest,
    message: "Bulk-Game-deleted",
    code: 200,
  };
};

export const gamesRequestService = {
  createGameRequest,
  updateGameRequest,
  getGame,
  deleteGameRequest,
  bulkDeleteGameRequest,
};
