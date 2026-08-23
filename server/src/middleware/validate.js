const AppError = require("../utils/AppError");

// validate({ body?, params?, query? }) — one zod schema per request part.
// Only the parts a schema declares are re-assigned; the others are left exactly
// as Express built them. Assigning all three unconditionally wiped req.query and
// req.params for body-only schemas.
module.exports = (schemas = {}) => (req, res, next) => {
  for (const key of ["body", "params", "query"]) {
    if (!schemas[key]) continue;
    const parsed = schemas[key].safeParse(req[key]);
    if (!parsed.success) {
      return next(new AppError(
        422,
        "VALIDATION_ERROR",
        "Some fields need attention.",
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }))
      ));
    }
    req[key] = parsed.data;
  }
  return next();
};
