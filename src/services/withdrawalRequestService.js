import createError from "http-errors";
import { WithdrawalRequest } from "../models/associations.js";

const createWithdrawalRequest = async (data) => {
  const user = await WithdrawalRequest.create(data, {
    returning: true,
  });

  if (!user) {
    throw createError(400, "withdrawal-request-failed");
  }

  return {
    success: true,
    data: user,
    message: "withdrawal-request-created",
    code: 201,
  };
};

const updateWithdrawalRequest = async (data) => {
  const user = await WithdrawalRequest.update(data, {
    where: { id: data.id },
    returning: true,
  });

  if (!user) {
    throw createError(400, "withdrawal-request-failed");
  }

  return {
    success: true,
    data: user,
    message: "withdrawal-request-updated",
    code: 200,
  };
};

const getWithdrawalRequest = async (q) => {
  const {
    user_id,
    game_id,
    id,
    amount,
    currency,
    method,
    destination,
    status,
    reviewed_by_admin_id,
    admin_note,
  } = q;
  console.log(q);
  
  // Pagination fix: Convert strings to numbers to avoid NaN
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 10;
  const offset = (page - 1) * limit;

  let where = {};
  if (user_id) where.user_id = user_id;
  if (game_id) where.game_id = game_id;
  if (id) where.id = id;
  if (amount) where.amount = amount;
  if (currency) where.currency = currency;
  if (method) where.method = method;
  if (destination) where.destination = destination;
  if (status) where.status = status;
  if (reviewed_by_admin_id) where.reviewed_by_admin_id = reviewed_by_admin_id;
  if (admin_note) where.admin_note = admin_note;

  const { rows: withdrawalrequests, count } =
    await WithdrawalRequest.findAndCountAll({
      where,
      offset: offset,
      limit: limit,
      attributes: [
        "id",
        "user_id",
        "amount",
        "currency",
        "method",
        "status",
        "reviewed_by_admin_id",
        "admin_note",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        {
          association: "game",
          attributes: ["id", "name"],
        },
        {
          association: "reviewedByAdmin",
          attributes: ["id", "email", "firstName", "lastName"],
          required: false,
        },
      ],
    });

  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    pagination: {
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "withdrawal-requests-retrieved",
    code: 200,
  };
};

const deleteWithdrawalRequest = async (id) => {
  const withdrawalrequests = await WithdrawalRequest.destroy({ where: { id } });
  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    message: "withdrawal-request-deleted",
    code: 200,
  };
};

const bulkDeleteWithdrawalRequests = async (ids) => {
  const withdrawalrequests = await WithdrawalRequest.destroy({
    where: { id: ids },
  });
  if (!withdrawalrequests) throw createError(400, "not-found");

  return {
    success: true,
    data: withdrawalrequests,
    message: "withdrawal-requests-deleted",
    code: 200,
  };
};

export const withdrawalRequestService = {
  createWithdrawalRequest,
  updateWithdrawalRequest,
  getWithdrawalRequest,
  deleteWithdrawalRequest,
  bulkDeleteWithdrawalRequests,
};
