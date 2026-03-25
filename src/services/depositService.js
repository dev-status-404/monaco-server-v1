import createError from "http-errors";
import Deposit from "../models/deposits.model.js";

const createDeposit = async (data) => {
  const deposit = await Deposit.create(data);

  if (!deposit) {
    throw createError(400, "deposit-creation-failed");
  }

  return {
    success: true,
    data: deposit,
    message: "deposit-created",
    code: 201,
  };
};

const getDeposits = async (q) => {
  const { user_id, game_id, provider, status, page = 1, limit = 10, id } = q;

  let where = {};
  if (user_id) where.user_id = user_id;
  if (game_id) where.game_id = game_id;
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (id) where.id = id;

  const { rows: deposits, count } = await Deposit.findAndCountAll({
    where,
    offset: (parseInt(page) - 1) * parseInt(limit),
    limit: parseInt(limit),
    include: [
      {
        association: "user",
        attributes: ["id", "email", "firstName", "lastName"],
      },
      // OPTIONAL: only if you add Deposit.belongsTo(Game, { as: "game", foreignKey: "game_id" })
      {
        association: "game",
        attributes: ["id", "name", "status"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!deposits) throw createError(400, "not-found");

  return {
    success: true,
    data: {
      deposits,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "deposits-retrieved",
    code: 200,
  };
};

const updateDeposit = async (id, data) => {
  console.log(data);
  
  const updated = await Deposit.update(data, { where: { id } });

  // Note: 'updated' will be 0 if the data is same or record doesn't exist
  const deposit = await Deposit.findByPk(id);
  if (!deposit) {
    throw createError(404, "deposit-not-found");
  }

  return {
    success: true,
    data: updated,
    message: "deposit-updated",
    code: 200,
  };
};

const deleteDeposit = async (id) => {
  const deposit = await Deposit.destroy({ where: { id } });
  if (!deposit) throw createError(404, "not-found");

  return {
    success: true,
    data: deposit,
    message: "deposit-deleted",
    code: 200,
  };
};

export const depositService = {
  createDeposit,
  getDeposits,
  updateDeposit,
  deleteDeposit,
};
