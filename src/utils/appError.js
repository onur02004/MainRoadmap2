class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Yazılımsal hatalar ile operasyonel hataları ayırır

    Error.captureStackTrace(this, this.constructor);
  }
}
export default AppError;