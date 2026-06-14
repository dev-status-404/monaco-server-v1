import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const AuditLog = sequelize.define(
  "audit_log",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actor_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    entity_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["order", "payout_request"]],
      },
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    from_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    to_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "audit_logs",
    timestamps: true,
    updatedAt: false,
  },
);

export default AuditLog;
