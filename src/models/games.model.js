import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Game = sequelize.define(
  "game",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      validate: {
        isIn: [["active", "disabled"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "games",
    timestamps: true,
  },
);

export default Game;
