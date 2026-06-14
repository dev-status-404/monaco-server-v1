import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const SystemSetting = sequelize.define(
  "system_setting",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "system_settings",
    timestamps: true,
  },
);

export default SystemSetting;
