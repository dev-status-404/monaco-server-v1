import { where } from "sequelize";
import Reward from "../models/rewards.model.js";


const createReward = async (data) => {
  const reward = await Reward.create(data);

  if (!reward) {
    throw createError(400, "reward-creation-failed");
  }

  return {
    success: true,
    data: reward,
    message: "reward-created",
    code: 201,
  };
};
const updateReward = async (data) => {
  const reward = await Reward.update(data, {
    where : { id: data.id },
  });

  if (!reward) {
    throw createError(400, "reward-update-failed");
  }

  return {
    success: true,
    data: reward,
    message: "reward-updated",
    code: 200,
  };
};

const deleteReward = async (id) => {
  const reward = await Reward.destroy({ where: { id } });
  if (!reward) throw createError(400, "not-found");

  return {
    success: true,
    data: reward,
    message: "reward-deleted",
    code: 200,
  };
};

const getAllRewards = async (q) => {
  const { page, limit, source, status, related_invite_id, user_id } = q;
  let where = {};

  if (source) where.source = source;
  if (status) where.status = status;
  if (related_invite_id) where.related_invite_id = related_invite_id;
  if (user_id) where.user_id = user_id;

  const {rows: rewards, count} = await Reward.findAndCountAll({
    where,
    offset: (page - 1) * limit,
    limit,
  });
  if (!rewards) throw createError(400, "not-found");

  return {
    success: true,
    data: { rewards, totalCount: count, totalPages: Math.ceil(count / limit) },
    message: "rewards-found",
    code: 200,
  };
};

export const rewardService = { 
  createReward, updateReward, deleteReward, getAllRewards };
