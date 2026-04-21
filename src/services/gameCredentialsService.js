import createError from "http-errors";
import GameCredential from "../models/game_credentials.model.js";
import { emitToUserAndAdmins } from "../realtime/socket.js";
import { notificationService } from "./notificationService.js";

const create = async (data) => {
  const credential = await GameCredential.create(data);
  if (!credential) throw createError(400, "creation-failed");

  return {
    success: true,
    data: credential,
    message: "credential-created",
    code: 201,
  };
};

const update = async (id, data) => {
  const [updated] = await GameCredential.update(data, { where: { id } });
  if (!updated) throw createError(404, "credential-not-found");

  return {
    success: true,
    message: "credential-updated",
    code: 200,
  };
};

const getCredentials = async (q) => {
  const { game_id, status, assigned_to_user_id, page = 1, limit = 10 } = q;
  let where = {};

  if (game_id) where.game_id = game_id;
  if (status) where.status = status;
  if (assigned_to_user_id) where.assigned_to_user_id = assigned_to_user_id;

  const { rows: credentials, count } = await GameCredential.findAndCountAll({
    where,
    offset: (page - 1) * limit,
    limit: parseInt(limit),
    include: [
      {
        association: "game",
        attributes: ["id", "name", "status"],
      },
      {
        association: "assignedTo",
        attributes: ["id", "email", "firstName", "lastName"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return {
    success: true,
    data: {
      credentials,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "credentials-retrieved",
    code: 200,
  };
};

const assign = async (game_id, user_id) => {
  const credential = await GameCredential.findOne({
    where: { game_id, status: "available" },
  });

  if (!credential) throw createError(404, "no-available-accounts");

  await credential.update({
    assigned_to_user_id: user_id,
    status: "assigned",
  });

  const payload = {
    type: "game_credential",
    action: "assigned",
    credentialId: credential.id,
    userId: user_id,
    gameId: game_id,
    status: credential.status,
  };

  emitToUserAndAdmins(user_id, "game_credential:assigned", payload);

  await notificationService.createForUserAndAdmins({
    userId: user_id,
    type: "game_credential",
    title: "Game credential assigned",
    message: `A game credential has been assigned for game ${game_id}.`,
    meta: {
      credentialId: credential.id,
      gameId: game_id,
      status: credential.status,
    },
  });

  return {
    success: true,
    data: credential,
    message: "assigned-successfully",
    code: 200,
  };
};

const deleteCredential = async (id) => {
  const deleted = await GameCredential.destroy({ where: { id } });
  if (!deleted) throw createError(404, "not-found");

  return { success: true, message: "deleted", code: 200 };
};

const bulkDelete = async (ids) => {
  const count = await GameCredential.destroy({ where: { id: ids } });
  if (!count) throw createError(404, "none-found-to-delete");

  return { success: true, data: { count }, message: "bulk-deleted", code: 200 };
};

export const gameCredentialsService = {
  create,
  update,
  getCredentials,
  assign,
  deleteCredential,
  bulkDelete,
};
