import createError from "http-errors";
import Invite from "../models/invites.model.js";


const createInvite = async (data) => {
  const invite = await Invite.create(data);

  if (!invite) {
    throw createError(400, "invite-creation-failed");
  }

  return {
    success: true,
    data: invite,
    message: "invite-created",
    code: 201,
  };
};

const getInvites = async (q) => {
  const {
    inviter_user_id,
    status,
    token,
    page = 1,
    limit = 10,
  } = q;
  let where = {};

  if (inviter_user_id) where.inviter_user_id = inviter_user_id;
  if (status) where.status = status;
  if (token) where.token = token;

  const {rows: invites, count} = await Invite.findAndCountAll({
    where,
    offset: (page - 1) * limit,
    limit,
    include: [
      {
        association: "inviter",
        attributes: ["id", "email", "firstName", "lastName"],
      },
      {
        association: "usedBy",
        attributes: ["id", "email", "firstName", "lastName"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!invites) throw createError(400, "not-found");

  return {
    success: true,
    data: {
      invites,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
    },
    message: "invites-retrieved",
    code: 200,
  };
};

const useInvite = async (token, user_id) => {
  const invite = await Invite.findOne({ where: { token } });

  if (!invite) {
    throw createError(400, "invite-not-found");
  }

  if (invite.status !== "created") {
    throw createError(400, "invite-already-used");
  }

  if (invite.expires_at && new Date() > invite.expires_at) {
    await invite.update({ status: "expired" });
    throw createError(400, "invite-expired");
  }

  if (invite.uses_count >= invite.max_uses) {
    throw createError(400, "invite-max-uses-reached");
  }

  await invite.update({
    status: invite.uses_count + 1 >= invite.max_uses ? "used" : "created",
    uses_count: invite.uses_count + 1,
    used_by_user_id: user_id,
  });

  return {
    success: true,
    data: invite,
    message: "invite-used",
    code: 200,
  };
};

const updateInvite = async (id, data) => {
  const [updated] = await Invite.update(data, { where: { id } });

  if (!updated) {
    throw createError(400, "invite-update-failed");
  }

  const invite = await Invite.findByPk(id);
  if (!invite) {
    throw createError(400, "invite-not-found");
  }

  return {
    success: true,
    data: invite,
    message: "invite-updated",
    code: 200,
  };
};

const deleteInvite = async (id) => {
  const invite = await Invite.destroy({ where: { id } });
  if (!invite) throw createError(400, "not-found");

  return {
    success: true,
    data: invite,
    message: "invite-deleted",
    code: 200,
  };
};

export const invitesService = {
  createInvite,
  getInvites,
  useInvite,
  updateInvite,
  deleteInvite,
};