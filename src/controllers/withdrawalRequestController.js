import { withdrawalRequestService } from "../services/withdrawalRequestService.js";

const createWithdrawalRequest = async (req, res) => {
  try {
    const response = await withdrawalRequestService.createWithdrawalRequest(
      req.body,
    );

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

const updateWithdrawalRequest = async (req, res) => {
  try {
    const response = await withdrawalRequestService.updateWithdrawalRequest(
      req.body,
    );

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

const getWithdrawalRequest = async (req, res) => {
  try {
    const response = await withdrawalRequestService.getWithdrawalRequest(
      req.body,
    );

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

const deleteWithdrawalRequest = async (req, res) => {
  try {
    const response = await withdrawalRequestService.deleteWithdrawalRequest(
      req.params.id,
    );

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

const bulkDeleteWithdrawalRequests = async (req, res) => {
  try {
    const response =
      await withdrawalRequestService.bulkDeleteWithdrawalRequests(req.body.ids);

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

const approveWithdrawalRequest = async (req, res) => {
  try {
    const response = await withdrawalRequestService.approveWithdrawalRequest({
      id: req.body?.withdrawalId || req.body?.id,
      reviewedByAdminId:
        req.body?.reviewedByAdminId || req.body?.reviewed_by_admin_id,
      adminNote: req.body?.adminNote || req.body?.admin_note,
      destination: req.body?.destination || req.body?.address,
      address: req.body?.address || req.body?.destination,
    });

    return res.status(200).json({
      code: 200,
      success: true,
      message: "withdrawal-request-approved",
      data: response ?? null,
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

export const withdrawalRequestController = {
  createWithdrawalRequest,
  updateWithdrawalRequest,
  getWithdrawalRequest,
  deleteWithdrawalRequest,
  bulkDeleteWithdrawalRequests,
  approveWithdrawalRequest,
};
