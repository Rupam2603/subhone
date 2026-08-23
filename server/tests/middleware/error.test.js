const errorHandler = require("../../src/middleware/error");
const { z } = require("zod");

describe("errorHandler", () => {
  it("formats generic errors as { error: string }", () => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
      },
    };

    errorHandler(new Error("Test error"), {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.data).toEqual({ error: "Test error" });
  });

  it("formats zod errors flatly", () => {
    const schema = z.object({ age: z.number().min(18) });
    const result = schema.safeParse({ age: 10 });
    
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
      },
    };

    errorHandler(result.error, {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.data.error).toContain("age");
  });
});
