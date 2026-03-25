import { dashboardService } from "../services/dashboardService.js";

const getDashboard = async (req, res) => {
  try {
    const response = await dashboardService.getDashboard(req.query);

    return res.status(response.code).json({
      code: response.code,
      success: response.success,
      message: response.message,
      data:
        {
          totals: response?.totals,
          pages: response?.pages,
          insights: response?.insights || null,
          charts: response?.charts || null,
        } ?? null,
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
export const dashboardController = { getDashboard };
