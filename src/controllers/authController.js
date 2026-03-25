import { authService } from "../services/authService.js";

const register = async (req, res) => {
  try {
    const response = await authService.register(req.body);

    return res.status(201).json({
      code: response.code ?? 201,
      success: response.success,
      message: response.message,
      data: response.data?.user ?? null,
      jwt: response.data?.token ?? null,
      redirect: response.data?.redirect ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      redirect: null,
      data: null,
      jwt: null,
    });
  }
};

const login = async (req, res) => {
  try {
    const response = await authService.login(req.body);

    return res.status(200).json({
      code: response.code ?? 200,
      success: true,
      message: response.message,
      data: response.data?.user ?? null,
      jwt: response.data?.user?.token ?? null,
      redirect: response.data?.redirect ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      jwt: null,
      data: null,
      redirect: null,
    });
  }
};

// const logout = async (res) => {
//   try {
//     return res.status(200).json({
//       code: 200,
//       success: true,
//       message: "Signout successful",
//       data: null,
//     });
//   } catch (error) {
//     return res.status(error?.statusCode || 400).json({
//       code: error?.statusCode || 400,
//       success: false,
//       message: error.message,
//       data: null,
//     });
//   }
// };
const logout = async (req, res) => { // Added req back as the first parameter
  try {
    // If you use sessions or JWT blacklisting, you'd handle it here
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Signout successful",
      data: null,
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

const googleLogin = async (req, res) => {
  try {
    const response = await authService.googleLogin(req.body);
    return res.status(200).json({
      code: response.code ?? 200,
      success: true,
      jwt: response.token ?? null,
      message: response.message,
      data: response.data ?? null,
      redirect: response.redirect ?? null,
    });
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      jwt: null,
      data: null,
      redirect: null,
    });
  }
};

const verifyUserJWT = async (req, res) => {
  try {
    const user = req?.user;

    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: "User not verified or token invalid",
        data: null,
      });
    }

    return res.status(200).json({
      code: 200,
      success: true,
      message: "User verified successfully",
      data: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        role: user?.role,
        plan: user?.plan,
        avatar_url: user?.avatar_url,
        blocked: user?.blocked,
        type: user?.type,
      },
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      code: error?.statusCode || 500,
      success: false,
      message: error?.message || "Internal server error during verification",
      data: null,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const response = await authService.forgotPassword(req.body.email);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
      redirect: null,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const response = await authService.resetPassword(req.body);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      code: error?.statusCode || 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const authController = {
  register,
  login,
  googleLogin,
  logout,
  verifyUserJWT,
  forgotPassword,
  resetPassword,
};
