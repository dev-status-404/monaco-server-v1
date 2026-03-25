// src/models/associations.js
// Import all models here and wire relations in ONE place.
// Call this once on app startup (after models are imported).

import User from "./user.model.js";
import Invite from "./invites.model.js";
import WalletAccount from "./wallet_account.model.js";
import WalletTransaction from "./wallet_transactions.model.js";
import Deposit from "./deposits.model.js";
import WithdrawalRequest from "./withdrawls_requests.model.js";
import Reward from "./rewards.model.js";
import Game from "./games.model.js";
import GameRequest from "./games_request.model.js";
import GameCredential from "./game_credentials.model.js";

// (Optional) These two are redundant because you define them again inside applyAssociations,
// but keeping them doesn't break anything. If you want, you can remove these top-level ones.

export const applyAssociations = () => {
  /**
   * USER <-> USER (referrals)
   */
  User.belongsTo(User, {
    as: "referrer",
    foreignKey: "referrer_user_id",
    constraints: false,
  });

  User.hasMany(User, {
    as: "referrals",
    foreignKey: "referrer_user_id",
    constraints: false,
  });

  /**
   * INVITES
   */
  Invite.belongsTo(User, {
    as: "inviter",
    foreignKey: "inviter_user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  User.hasMany(Invite, {
    as: "invites",
    foreignKey: "inviter_user_id",
  });

  Invite.belongsTo(User, {
    as: "usedBy",
    foreignKey: "used_by_user_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  User.hasMany(Invite, {
    as: "usedInvites",
    foreignKey: "used_by_user_id",
  });

  /**
   * WALLET
   */
  User.hasOne(WalletAccount, {
    as: "wallet",
    foreignKey: "user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  WalletAccount.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
  });

  WalletAccount.hasMany(WalletTransaction, {
    as: "transactions",
    foreignKey: "wallet_account_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  WalletTransaction.belongsTo(WalletAccount, {
    as: "walletAccount",
    foreignKey: "wallet_account_id",
  });

  // ✅ Added: WalletTransaction -> User (for includes like association: "user")
  User.hasMany(WalletTransaction, {
    as: "walletTransactions",
    foreignKey: "user_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  WalletTransaction.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  // ✅ Added: WalletTransaction -> Game (for includes like association: "game")
  Game.hasMany(WalletTransaction, {
    as: "walletTransactions",
    foreignKey: "game_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  WalletTransaction.belongsTo(Game, {
    as: "game",
    foreignKey: "game_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  /**
   * DEPOSITS
   */
  User.hasMany(Deposit, {
    as: "deposits",
    foreignKey: "user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Deposit.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
  });

  // ✅ Added: Deposit -> Game (so you can include association: "game")
  Game.hasMany(Deposit, {
    as: "deposits",
    foreignKey: "game_id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  Deposit.belongsTo(Game, {
    as: "game",
    foreignKey: "game_id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  /**
   * WITHDRAWALS (cashout / redeem)
   */
  User.hasMany(WithdrawalRequest, {
    as: "withdrawals",
    foreignKey: "user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  WithdrawalRequest.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
  });

  // ✅ Added: WithdrawalRequest -> Game (optional but matches your model having game_id)
  Game.hasMany(WithdrawalRequest, {
    as: "withdrawalRequests",
    foreignKey: "game_id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  WithdrawalRequest.belongsTo(Game, {
    as: "game",
    foreignKey: "game_id",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  // reviewed_by_admin_id -> users.id
  WithdrawalRequest.belongsTo(User, {
    as: "reviewedByAdmin",
    foreignKey: "reviewed_by_admin_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  User.hasMany(WithdrawalRequest, {
    as: "withdrawalsReviewed",
    foreignKey: "reviewed_by_admin_id",
    constraints: false,
  });

  /**
   * REWARDS
   */
  User.hasMany(Reward, {
    as: "rewards",
    foreignKey: "user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Reward.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
  });

  Reward.belongsTo(Invite, {
    as: "relatedInvite",
    foreignKey: "related_invite_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  Invite.hasMany(Reward, {
    as: "rewards",
    foreignKey: "related_invite_id",
  });

  /**
   * GAMES
   */
  Game.hasMany(GameRequest, {
    as: "requests",
    foreignKey: "game_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  GameRequest.belongsTo(Game, {
    as: "game",
    foreignKey: "game_id",
  });

  User.hasMany(GameRequest, {
    as: "gameRequests",
    foreignKey: "user_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  GameRequest.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
  });

  // reviewedBy (admin)
  GameRequest.belongsTo(User, {
    as: "reviewedByAdmin",
    foreignKey: "reviewed_by_admin_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  User.hasMany(GameRequest, {
    as: "gameRequestsReviewed",
    foreignKey: "reviewed_by_admin_id",
    constraints: false,
  });

  /**
   * GAME CREDENTIALS
   */
  Game.hasMany(GameCredential, {
    as: "credentials",
    foreignKey: "game_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  GameCredential.belongsTo(Game, {
    as: "game",
    foreignKey: "game_id",
  });

  // who it's assigned to
  GameCredential.belongsTo(User, {
    as: "assignedTo",
    foreignKey: "assigned_to_user_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    constraints: false,
  });

  User.hasMany(GameCredential, {
    as: "assignedCredentials",
    foreignKey: "assigned_to_user_id",
    constraints: false,
  });

  // request -> credential (set when approved)
  GameRequest.belongsTo(GameCredential, {
    as: "credential",
    foreignKey: "credential_id",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  GameCredential.hasOne(GameRequest, {
    as: "request",
    foreignKey: "credential_id",
  });

  return {
    User,
    Invite,
    WalletAccount,
    WalletTransaction,
    Deposit,
    WithdrawalRequest,
    Reward,
    Game,
    GameRequest,
    GameCredential,
  };
};

export {
  User,
  Invite,
  WalletAccount,
  WalletTransaction,
  Deposit,
  WithdrawalRequest,
  Reward,
  Game,
  GameRequest,
  GameCredential,
};