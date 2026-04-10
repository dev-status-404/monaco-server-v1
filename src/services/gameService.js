import Game from "../models/games.model.js";
import createError from "http-errors";

const createGame = async (data) => {
  const game = await Game.create(data, {
    returning: true,
  });

  if (!game) {
    throw createError(400, "game-failed");
  }

  return {
    success: true,
    data: game,
    message: "Game-created",
    code: 201,
  };
};

const updateGame = async (data) => {
  const game = await Game.update(data, {
    where: { id: data.id },
  });

  if (!game) {
    throw createError(400, "update-failed");
  }

  return {
    success: true,
    data: game,
    message: "Updated",
    code: 201,
  };
};

const getGame = async (q) => {
  const { id, name, status, page, limit } = q;

  const where = {};

  if (id) where.id = id;
  if (name) where.name = name;
  if (status) where.status = status;
  if (!status) where.status = "active";

  const pageNumber = Number(page) || 1;
  const pageLimit = Number(limit) || 10;
  const offset = (pageNumber - 1) * pageLimit;

  const { rows: game, count } = await Game.findAndCountAll({
    where,
    offset,
    limit: pageLimit,
  });

  return {
    success: true,
    data: game || null,
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      totalCount: count,
      totalPages: Math.ceil(count / pageLimit),
    },
    message: "game-retrieved",
    code: 200,
  };
};

const deleteGame = async (id) => {
  const game = await Game.destroy({ where: { id } });
  if (!game) throw createError(400, "not-found");

  return {
    success: true,
    data: game,
    message: "Game-deleted",
    code: 200,
  };
};

const bulkDeleteGame = async (ids) => {
  const game = await Game.destroy({
    where: { id: ids },
  });
  if (!game) throw createError(400, "not-found");

  return {
    success: true,
    data: game,
    message: "Bulk-Game-deleted",
    code: 200,
  };
};

export const gameService = {
  createGame,
  updateGame,
  getGame,
  deleteGame,
  bulkDeleteGame,
};
