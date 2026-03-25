import { walletAccountService } from "../services/walletAccountService.js";

const createWalletAccount = async (req, res) => {
  try {
    const response = await walletAccountService.createWalletAccount(req.body);

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

const updateWalletAccount = async (req, res) => {
  try {
    const response = await walletAccountService.updateWalletAccount(req.body);

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

const deleteWalletAccount = async (req, res) => {
  try {
    const response = await walletAccountService.deleteWalletAccount(req.params.id);

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

const getAllWalletAccounts = async (req, res) => {
  try {
    const response = await walletAccountService.getAllWalletAccounts(req.query);

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

const bulkDeleteWalletAccounts = async (req, res) => {
  try {
    const response = await walletAccountService.bulkDeleteWalletAccounts(req.body.ids);

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

export const walletAccountController = {
  createWalletAccount,
  updateWalletAccount,
  deleteWalletAccount,
  getAllWalletAccounts,
  bulkDeleteWalletAccounts,
};
