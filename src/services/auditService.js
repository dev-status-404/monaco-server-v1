import AuditLog from "../models/audit_logs.model.js";

const logStatusChange = async (
  entityType,
  entityId,
  fromStatus,
  toStatus,
  actorUserId,
  metadata = {},
  transaction,
) => {
  return AuditLog.create(
    {
      actor_user_id: actorUserId || null,
      entity_type: entityType,
      entity_id: entityId,
      action: metadata?.action || "status_changed",
      from_status: fromStatus || null,
      to_status: toStatus || null,
      metadata,
    },
    transaction ? { transaction } : undefined,
  );
};

export const auditService = {
  logStatusChange,
};
