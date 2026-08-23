const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = result.body;
    req.query = result.query;
    req.params = result.params;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = validate;
