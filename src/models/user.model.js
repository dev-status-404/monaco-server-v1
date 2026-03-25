import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const User = sequelize.define(
  "user",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    avatar_url_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    role: {
      validate: { isIn: [["user", "admin"]] },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },

    referrer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
  },
);

export default User;
