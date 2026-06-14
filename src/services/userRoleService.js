import UserRole from "../models/user_roles.model.js";

const syncUserRole = async (user) => {
  if (!user?.id || !user?.role) return null;

  const existing = await UserRole.findOne({
    where: {
      user_id: user.id,
      role: user.role,
    },
  });

  if (existing) return existing;

  return UserRole.create({
    user_id: user.id,
    role: user.role,
  });
};

export const userRoleService = {
  syncUserRole,
};
