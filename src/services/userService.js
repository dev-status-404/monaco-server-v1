import createError from "http-errors";
import User from "../models/user.model.js";
import { where } from "sequelize";


const updateUser = async (data) => {
  const user = await User.update(data, {
    where: { id: data.id },
  });

  if (!user) {
    throw createError(400, "update-failed");
  }

  return {
    success: true,
    data: user,
    message: "user-updated",
    code: 200,
  };
};

const getUsers = async (q) => {
  const {
    email,
    id,
    firstName,
    lastName,
    role,
    blocked,
    active,
    type,
    page,
    limit,
  } = q;
  let where = {};

  if (type) where.type = type;
  if (email) where.email = email;
  if (id) where.id = id;
  if (firstName) where.firstName = firstName;
  if (lastName) where.lastName = lastName;
  if (role) where.role = role;
  if (blocked) where.blocked = blocked;
  if (active) where.active = active;

  const offset = (page - 1) * limit;

  const { count, rows: users } = await User.findAndCountAll({
    where,
    offset,
    limit,
    attributes: [
      "id",
      "email",
      "firstName",
      "lastName",
      "blocked",
      "active",
      "role",
      "avatar_url",
      "createdAt",
      "updatedAt",
    ],
  });

  if (!users) throw createError(400, "not-found");

  return {
    success: true,
    data: {
      users,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "users-retrieved",
    code: 200,
  };
};

const deleteUser = async (id) => {
  const user = await User.destroy({ where: { id } });
  if (!user) throw createError(400, "not-found");

  return {
    success: true,
    data: user,
    message: "user-deleted",
    code: 200,
  };
};

const bulkDeleteUsers = async (ids) => {
  const user = await User.destroy({ where: { id: ids } });
  if (!user) throw createError(400, "not-found");

  return {
    success: true,
    data: user,
    message: "users-deleted",
    code: 200,
  };
};

export const userService = {
  updateUser,
  getUsers,
  deleteUser,
  bulkDeleteUsers,
};
