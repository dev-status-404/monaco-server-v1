import { Op, fn, col } from "sequelize";
import createError from "http-errors";

import User from "../models/user.model.js";
import Deposit from "../models/deposits.model.js";
import WithdrawlsRequest from "../models/withdrawls_requests.model.js";
import WalletTransaction from "../models/wallet_transactions.model.js";
import GameRequest from "../models/games_request.model.js";
import GameCredential from "../models/game_credentials.model.js";
import Game from "../models/games.model.js";
import Reward from "../models/rewards.model.js"; // only used for user dashboard

const withdrawalDashboardAttributes = [
  "id",
  "user_id",
  "game_id",
  "game_name",
  "amount",
  "currency",
  "method",
  "api_status",
  "status",
  "reviewed_by_admin_id",
  "admin_note",
  "createdAt",
  "updatedAt",
];
/* =========================
   Helpers
========================= */

const toInt = (v, fallback) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toSortDir = (v) => (String(v).toUpperCase() === "ASC" ? "ASC" : "DESC");

const normalizeUuidLike = (v) => {
  const value = String(v ?? "").trim();
  return value || null;
};

const paginate = (q, prefix) => {
  const page = toInt(q[`${prefix}_page`] ?? q.page, 1);
  const limit = toInt(q[`${prefix}_limit`] ?? q.limit, 10);
  const sortBy = q[`${prefix}_sortBy`] ?? q.sortBy ?? "createdAt";
  const sortDir = toSortDir(q[`${prefix}_sortDir`] ?? q.sortDir ?? "DESC");
  const offset = (page - 1) * limit;
  return { page, limit, offset, sortBy, sortDir };
};

const safeSum = async (Model, field, where) => {
  const v = await Model.sum(field, { where });
  return Number(v ?? 0);
};

const packPage = ({ rows, count }, page, limit) => {
  const totalItems = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    items: rows,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/* =========================
   Range + Chart Fill Helpers
========================= */

const toISODate = (d) => new Date(d).toISOString().slice(0, 10);

const getRangeWindow = (q) => {
  const range = String(q.range ?? "1w").toLowerCase();

  // END = now (current time)
  const end = new Date();

  // START = clone end
  const start = new Date(end);

  if (range === "1w") {
    start.setDate(start.getDate() - 6);
  } else if (range === "1m") {
    start.setMonth(start.getMonth() - 1);
  } else if (range === "3m") {
    start.setMonth(start.getMonth() - 3);
  } else if (range === "1y") {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setDate(start.getDate() - 6);
  }

  return { start, end, range };
};
const listDaysBetween = (start, end) => {
  const days = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  const e = new Date(end);
  e.setHours(0, 0, 0, 0);

  while (d <= e) {
    days.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

const fillCountsByLabels = (labels, counts, fullLabels) => {
  const map = new Map(
    (labels ?? []).map((l, i) => [
      String(l).slice(0, 10),
      Number(counts?.[i] ?? 0),
    ]),
  );

  return {
    labels: fullLabels,
    counts: fullLabels.map((day) => Number(map.get(day) ?? 0)),
  };
};

/* =========================
   Charts: group by day count
========================= */
const groupByDayCount = async (Model, where) => {
  const dayExpr = fn("DATE", col("createdAt")); // MySQL/SQLite
  // Postgres alternative:
  // const dayExpr = fn("date_trunc", "day", col("createdAt"));

  const rows = await Model.findAll({
    where,
    attributes: [
      [dayExpr, "day"],
      [fn("COUNT", col("id")), "count"],
    ],
    group: [dayExpr],
    order: [[dayExpr, "ASC"]],
    raw: true,
  });

  return {
    labels: rows.map((r) => String(r.day).slice(0, 10)),
    counts: rows.map((r) => Number(r.count ?? 0)),
  };
};

/* =========================
   Insights helpers
========================= */

const sumArr = (arr) => (arr ?? []).reduce((a, b) => a + Number(b ?? 0), 0);

const insightsFromCounts = (fullLabels, counts) => {
  const total = sumArr(counts);
  const last = fullLabels?.length ? fullLabels[fullLabels.length - 1] : null;

  let bestDay = null;
  let bestCount = 0;

  for (let i = 0; i < (fullLabels?.length ?? 0); i++) {
    const c = Number(counts?.[i] ?? 0);
    if (c > bestCount) {
      bestCount = c;
      bestDay = fullLabels[i];
    }
  }

  const avgPerDay = fullLabels?.length ? total / fullLabels.length : 0;

  const n = fullLabels?.length ?? 0;
  const todayCount = n ? Number(counts?.[n - 1] ?? 0) : 0;
  const prevCount = n > 1 ? Number(counts?.[n - 2] ?? 0) : 0;
  const trend =
    todayCount > prevCount ? "up" : todayCount < prevCount ? "down" : "flat";

  return {
    rangeDays: fullLabels?.length ?? 0,
    total,
    avgPerDay: Number(avgPerDay.toFixed(2)),
    bestDay,
    bestCount,
    lastDay: last,
    todayCount,
    prevCount,
    trend,
  };
};

/* =========================
   Popular Games
========================= */

const getPopularGames = async (dateWhere) => {
  const where = { status: "assigned", ...dateWhere };

  const rawCounts = await GameCredential.findAll({
    where,
    attributes: [
      "game_id",
      [fn("COUNT", col("id")), "playerCount"],
    ],
    group: ["game_id"],
    order: [[fn("COUNT", col("id")), "DESC"]],
    raw: true,
  });

  if (!rawCounts.length) return { games: [], totalPlayers: 0 };

  const gameIds = rawCounts.map((r) => r.game_id);
  const gamesData = await Game.findAll({
    where: { id: gameIds },
    attributes: ["id", "name", "image_url"],
    raw: true,
  });

  const gamesMap = new Map(gamesData.map((g) => [g.id, g]));
  const games = rawCounts.map((r) => ({
    game: gamesMap.get(r.game_id) ?? { id: r.game_id, name: "Unknown", image_url: null },
    playerCount: Number(r.playerCount),
  }));

  const totalPlayers = games.reduce((sum, g) => sum + g.playerCount, 0);

  return { games, totalPlayers };
};

/* =========================
   Admin Dashboard
========================= */

const AdminDashboard = async (q) => {
  // range window + full label axis
  const { start, end, range } = getRangeWindow(q);
  const fullLabels = listDaysBetween(start, end);

  // date filter
  const dateWhere = { createdAt: { [Op.gte]: start } };

  // where clauses
  const usersWhere = { role: "user", ...dateWhere };
  const depositsWhere = { ...dateWhere };
  const withdrawsWhere = { ...dateWhere };
  const transactionsWhere = { ...dateWhere };
  const gameRequestsWhere = { ...dateWhere };

  // optional game filter
  const gameId = normalizeUuidLike(q.game_id ?? q.gameId);
  if (gameId) {
    depositsWhere.game_id = gameId;
    withdrawsWhere.game_id = gameId;
    gameRequestsWhere.game_id = gameId;
  }

  // pagination
  const usrPg = paginate(q, "users");
  const depPg = paginate(q, "deposits");
  const wdrPg = paginate(q, "withdraws");
  const txPg = paginate(q, "transactions");
  const grPg = paginate(q, "gameRequests");

  const [
    // totals
    totalUsers,
    totalDeposits,
    totalWithdraws,
    totalTransactions,
    totalGameRequests,

    // pages
    usersPage,
    depositsPage,
    withdrawsPage,
    transactionsPage,
    gameRequestsPage,

    // charts raw
    usersChartRaw,
    depositsChartRaw,
    withdrawsChartRaw,
    transactionsChartRaw,
    gameRequestsChartRaw,

    // popular games
    popularGames,
  ] = await Promise.all([
    // totals
    User.count({ where: { role: "user" } }),
    safeSum(Deposit, "amount", depositsWhere),
    safeSum(WithdrawlsRequest, "amount", withdrawsWhere),
    WalletTransaction.count({ where: transactionsWhere }),
    GameRequest.count({ where: gameRequestsWhere }),

    // pages
    User.findAndCountAll({
      where: usersWhere,
      limit: usrPg.limit,
      offset: usrPg.offset,
      order: [[usrPg.sortBy, usrPg.sortDir]],
      attributes: [
        "id",
        "email",
        "firstName",
        "lastName",
        "role",
        "createdAt",
        "blocked",
        "active",
      ],
    }),

    Deposit.findAndCountAll({
      where: depositsWhere,
      limit: depPg.limit,
      offset: depPg.offset,
      order: [[depPg.sortBy, depPg.sortDir]],
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        { association: "game", attributes: ["id", "name"], required: false },
      ],
    }),

    WithdrawlsRequest.findAndCountAll({
      where: withdrawsWhere,
      limit: wdrPg.limit,
      offset: wdrPg.offset,
      order: [[wdrPg.sortBy, wdrPg.sortDir]],
      attributes: withdrawalDashboardAttributes,
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        { association: "game", attributes: ["id", "name"], required: false },
      ],
    }),

    WalletTransaction.findAndCountAll({
      where: transactionsWhere,
      limit: txPg.limit,
      offset: txPg.offset,
      order: [[txPg.sortBy, txPg.sortDir]],
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
      ],
    }),

    GameRequest.findAndCountAll({
      where: gameRequestsWhere,
      limit: grPg.limit,
      offset: grPg.offset,
      order: [[grPg.sortBy, grPg.sortDir]],
      include: [
        { association: "user", attributes: ["id", "email"] },
        { association: "game", attributes: ["id", "name"], required: false },
      ],
    }),

    

    // charts
    groupByDayCount(User, usersWhere),
    groupByDayCount(Deposit, depositsWhere),
    groupByDayCount(WithdrawlsRequest, withdrawsWhere),
    groupByDayCount(WalletTransaction, transactionsWhere),
    groupByDayCount(GameRequest, gameRequestsWhere),

    // popular games
    getPopularGames(dateWhere),
  ]);

  // fill missing days with zeros
  const usersChart = fillCountsByLabels(
    usersChartRaw.labels,
    usersChartRaw.counts,
    fullLabels,
  );
  const depositsChart = fillCountsByLabels(
    depositsChartRaw.labels,
    depositsChartRaw.counts,
    fullLabels,
  );
  const withdrawsChart = fillCountsByLabels(
    withdrawsChartRaw.labels,
    withdrawsChartRaw.counts,
    fullLabels,
  );
  const transactionsChart = fillCountsByLabels(
    transactionsChartRaw.labels,
    transactionsChartRaw.counts,
    fullLabels,
  );
  const gameRequestsChart = fillCountsByLabels(
    gameRequestsChartRaw.labels,
    gameRequestsChartRaw.counts,
    fullLabels,
  );

  const charts = {
    users: usersChart,
    deposits: depositsChart,
    withdraws: withdrawsChart,
    transactions: transactionsChart,
    gameRequests: gameRequestsChart,
  };

  // insights per section
  const insights = {
    users: insightsFromCounts(usersChart.labels, usersChart.counts),
    deposits: insightsFromCounts(depositsChart.labels, depositsChart.counts),
    withdraws: insightsFromCounts(withdrawsChart.labels, withdrawsChart.counts),
    transactions: insightsFromCounts(
      transactionsChart.labels,
      transactionsChart.counts,
    ),
    gameRequests: insightsFromCounts(
      gameRequestsChart.labels,
      gameRequestsChart.counts,
    ),
  };

  return {
    scope: "admin",
    filter: { range: String(q.range ?? "1w"), game_id: gameId ?? null },

    totals: {
      totalUsers,
      totalDeposits,
      totalWithdraws,
      totalTransactions,
      totalGameRequests,
    },

    charts,
    insights,
    popularGames,

    pages: {
      users: {
        ...packPage(usersPage, usrPg.page, usrPg.limit),
        meta: {
          ...packPage(usersPage, usrPg.page, usrPg.limit).meta,
          insights: insights.users,
        },
      },

      deposits: {
        ...packPage(depositsPage, depPg.page, depPg.limit),
        meta: {
          ...packPage(depositsPage, depPg.page, depPg.limit).meta,
          insights: insights.deposits,
        },
      },

      withdraws: {
        ...packPage(withdrawsPage, wdrPg.page, wdrPg.limit),
        meta: {
          ...packPage(withdrawsPage, wdrPg.page, wdrPg.limit).meta,
          insights: insights.withdraws,
        },
      },

      transactions: {
        ...packPage(transactionsPage, txPg.page, txPg.limit),
        meta: {
          ...packPage(transactionsPage, txPg.page, txPg.limit).meta,
          insights: insights.transactions,
        },
      },

      gameRequests: {
        ...packPage(gameRequestsPage, grPg.page, grPg.limit),
        meta: {
          ...packPage(gameRequestsPage, grPg.page, grPg.limit).meta,
          insights: insights.gameRequests,
        },
      },
    },

    message: "dashboard-found",
    code: 200,
    success: true,
  };
};

const UserDashboard = async (q) => {
  const user_id = normalizeUuidLike(q.user_id);
  const game_id = normalizeUuidLike(q.game_id);
  if (!user_id) throw createError(400, "user_id-is-required-for-user-dashboard");

  const depositsWhere = { user_id };
  const withdrawsWhere = { user_id };
  const rewardsWhere = { user_id };

  // optional game filter for user dashboard
  if (game_id) {
    depositsWhere.game_id = game_id;
    withdrawsWhere.game_id = game_id;
  }

  const depPg = paginate(q, "deposits");
  const wdrPg = paginate(q, "withdraws");
  const rwdPg = paginate(q, "rewards");

  const [
    totalDeposits,
    totalWithdraws,
    totalRewards,
    depositsPage,
    withdrawsPage,
    rewardsPage,
  ] = await Promise.all([
    safeSum(Deposit, "amount", depositsWhere),
    safeSum(WithdrawlsRequest, "amount", withdrawsWhere),
    safeSum(Reward, "amount", rewardsWhere),

    Deposit.findAndCountAll({
      where: depositsWhere,
      limit: depPg.limit,
      offset: depPg.offset,
      order: [[depPg.sortBy, depPg.sortDir]],
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        { association: "game", attributes: ["id", "name"], required: false },
      ],
    }),

    WithdrawlsRequest.findAndCountAll({
      where: withdrawsWhere,
      limit: wdrPg.limit,
      offset: wdrPg.offset,
      order: [[wdrPg.sortBy, wdrPg.sortDir]],
      attributes: withdrawalDashboardAttributes,
      include: [
        {
          association: "user",
          attributes: ["id", "email", "firstName", "lastName"],
        },
        { association: "game", attributes: ["id", "name"], required: false },
      ],
    }),

    Reward.findAndCountAll({
      where: rewardsWhere,
      limit: rwdPg.limit,
      offset: rwdPg.offset,
      order: [[rwdPg.sortBy, rwdPg.sortDir]],
    }),
  ]);

  return {
    scope: "user",
    totals: { totalDeposits, totalWithdraws, totalRewards },
    filter: { game_id: game_id ?? null },
    pages: {
      deposits: packPage(depositsPage, depPg.page, depPg.limit),
      withdraws: packPage(withdrawsPage, wdrPg.page, wdrPg.limit),
      rewards: packPage(rewardsPage, rwdPg.page, rwdPg.limit),
    },
    message: "dashboard-found",
    code: 200,
    success: true,
  };
};

/* =========================
   Entry
========================= */

const getDashboard = async (q) => {
  const user_id = normalizeUuidLike(q.user_id);
  const requestedScope = String(q.scope ?? "").trim().toLowerCase();

  if (requestedScope === "admin") {
    return AdminDashboard(q);
  }

  if (!user_id) {
    return AdminDashboard(q);
  }

  const user = await User.findByPk(user_id);

  if (user?.role === "admin") return AdminDashboard(q);
  if (user?.role === "user") return UserDashboard({ ...q, user_id });

  if (requestedScope === "user") {
    return UserDashboard({ ...q, user_id });
  }

  // Frontend can issue dashboard calls before the user profile is hydrated.
  // In that case, fall back to the user-scope aggregates keyed by the provided id.
  return UserDashboard({ ...q, user_id });
};

export const dashboardService = { getDashboard };
