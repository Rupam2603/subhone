// Status + machine code + message. Thrown by services and routes; rendered by
// middleware/errorHandler.js into the `{ error, code, details? }` envelope.
class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    // Alias: Express's finalhandler and several plan snippets read `err.status`.
    this.status = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
