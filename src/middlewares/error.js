import httpStatus from 'http-status';
import  logger  from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

const errorConverter = (err, req, res, next) => {
  let error = err;
  
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const { statusCode, message } = err;
  
  const response = {
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };
  
  if (process.env.NODE_ENV === 'development') {
    logger.error(err);
  }
  
  res.status(statusCode).json(response);
};

export { errorConverter, errorHandler };
