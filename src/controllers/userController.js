import { userService } from "../services/userService.js";

const updateUser = async (req, res) => {
  try {
    const response = await userService.updateUser(req.body);

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

const getUsers = async (req, res) => {
  try {
    const response = await userService.getUsers(req.query);
    return res.status(response.code).json({
      code: response.code,
      success: response.success,
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

const deleteUser = async (req, res) => {
  try {
    const response = await userService.deleteUser(req.params.id);

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

const bulkDeleteUsers = async (req, res) => {
  try {
    const response = await userService.bulkDeleteUsers(req.body.ids);

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

export const userController = {
  updateUser,
  getUsers,
  deleteUser,
  bulkDeleteUsers,
};
