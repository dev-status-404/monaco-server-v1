import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Invite = sequelize.define(
  "invite",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    inviter_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    status: {
      validate: { isIn: [["created", "used", "expired"]] },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "created",
    },

    max_uses: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    uses_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    used_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "invites",
    timestamps: true,
  }
);

export default Invite;