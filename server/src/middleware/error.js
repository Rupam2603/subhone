const { ZodError } = require("zod");

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
  }

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
  }

  // Handle Mongo Unique Constraint Errors
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  if (statusCode === 500) {
    console.error("Unhandled Error:", err);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
