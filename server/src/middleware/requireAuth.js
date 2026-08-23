const AppError = require("../utils/AppError");

module.exports = function requireAuth(req, res, next) {
  if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
  return next();
};
