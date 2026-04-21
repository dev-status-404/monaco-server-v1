import { notificationService } from "../services/notificationService.js";

const getNotifications = async (req, res) => {
  try {
    const response = await notificationService.getNotifications(req.query);

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

const getSummary = async (req, res) => {
  try {
    const response = await notificationService.getSummary(req.query);

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

const markAllRead = async (req, res) => {
  try {
    const response = await notificationService.markAllRead(req.body);

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

const deleteAll = async (req, res) => {
  try {
    const response = await notificationService.deleteAll(req.body);

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

const markOneRead = async (req, res) => {
  try {
    const response = await notificationService.markOneRead({
      ...req.body,
      id: req.params.id,
    });

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

const deleteOne = async (req, res) => {
  try {
    const response = await notificationService.deleteOne({
      ...req.body,
      id: req.params.id,
    });

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data: response.data,
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

export const notificationController = {
  getNotifications,
  getSummary,
  markAllRead,
  deleteAll,
  markOneRead,
  deleteOne,
};
