import  {walletTransactionService} from "../services/walletTransactionsService.js";


const createWalletTransaction = async (req, res) => {
  try {
    const response = await walletTransactionService.createWalletTransaction(req.body);

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

const updateWalletTransaction = async (req, res) => {
  try {
    const response = await walletTransactionService.updateWalletTransaction(req.body);

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

const getWalletTransaction = async (req, res) => {
  try {
    const response = await walletTransactionService.getWalletTransaction(req.query);

    return res.status(response.code).json({
      code: response.code,
      success: true,
      message: response.message,
      data: response.data ?? null,
      pagination: response.pagination,
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

const deleteWalletTransaction = async (req, res) => {
  try {
    const response = await walletTransactionService.deleteWalletTransaction(req.params.id);

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

const bulkDeleteWalletTransaction = async (req, res) => {
  try {
    const response = await walletTransactionService.bulkDeleteWalletTransaction(req.body.ids);

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

export const walletTransactionsController = {
  createWalletTransaction,
  updateWalletTransaction,
  getWalletTransaction,
  deleteWalletTransaction,
  bulkDeleteWalletTransaction,
};