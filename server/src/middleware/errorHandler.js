const { ZodError } = require("zod");
const AppError = require("../utils/AppError");

// The envelope is always { error: <string>, code: <string>, details?: <array> }.
// `error` stays a plain string because client/src/lib/api.js reads data.error
// directly; nesting it breaks every UI error message.
const fieldDetails = (issues) =>
  issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.statusCode || 500).json(body);
  }

  // A ZodError that reached here was thrown outside validate() — same shape.
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Some fields need attention.",
      code: "VALIDATION_ERROR",
      details: fieldDetails(err.issues),
    });
  }

  if (err && err.name === "ValidationError" && err.errors) {
    return res.status(422).json({
      error: "Some fields need attention.",
      code: "VALIDATION_ERROR",
      details: Object.entries(err.errors).map(([path, e]) => ({ path, message: e.message })),
    });
  }

  if (err && (err.code === 11000 || err.code === 11001)) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : null;
    const body = { error: "That value is already in use.", code: "DUPLICATE" };
    if (field) body.details = [{ path: field, message: "already in use" }];
    return res.status(409).json(body);
  }

  // Never leak err.message on a 500 — it can carry stack, query or driver detail.
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Something went wrong on our side.", code: "INTERNAL" });
}

module.exports = errorHandler;
