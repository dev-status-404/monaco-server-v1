import { depositService } from "../services/depositService.js";

const createDeposit = async (req, res) => {
  try {
    const response = await depositService.createDeposit(req.body);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getDeposits = async (req, res) => {
  try {
    const response = await depositService.getDeposits(req.query);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const updateDeposit = async (req, res) => {
  try {
    const response = await depositService.updateDeposit(req.params.id, req.body);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const deleteDeposit = async (req, res) => {
  try {
    const response = await depositService.deleteDeposit(req.params.id);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getDepositedGames = async (req, res) => {
  try {
    // Prefer the authenticated user's own ID for security; allow explicit override only for admins
    const userId = req.user?.role === "admin"
      ? (req.query.user_id ?? req.user?.id)
      : req.user?.id;

    const response = await depositService.getDepositedGames(userId);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const depositsController = {
  createDeposit,
  getDeposits,
  updateDeposit,
  deleteDeposit,
  getDepositedGames,
};
