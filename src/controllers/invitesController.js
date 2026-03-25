import { invitesService } from "../services/invitesService.js";

const createInvite = async (req, res) => {
  try {
    const response = await invitesService.createInvite(req.body);

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

const getInvites = async (req, res) => {
  try {
    const response = await invitesService.getInvites(req.query);

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

const useInvite = async (req, res) => {
  try {
    const response = await invitesService.useInvite(req.params.token, req.body.user_id);

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

const updateInvite = async (req, res) => {
  try {
    const response = await invitesService.updateInvite(req.params.id, req.body);

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

const deleteInvite = async (req, res) => {
  try {
    const response = await invitesService.deleteInvite(req.params.id);

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

export const invitesController = {
  createInvite,
  getInvites,
  useInvite,
  updateInvite,
  deleteInvite,
};