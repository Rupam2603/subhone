const mongoose = require("mongoose");
const User = require("../../src/models/User");

describe("User model", () => {
  it("allows creation with just an email", async () => {
    const user = new User({ name: "Alice", email: "alice@example.com" });
    await expect(user.validate()).resolves.toBeUndefined();
  });

  it("allows creation with just a phone", async () => {
    const user = new User({ name: "Bob", phone: "+919876543210" });
    await expect(user.validate()).resolves.toBeUndefined();
  });

  it("fails validation if both email and phone are missing", async () => {
    const user = new User({ name: "Charlie" });
    const err = await user.validate().catch((e) => e);
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.email).toBeDefined();
    expect(err.errors.phone).toBeDefined();
  });

  it("defaults role to USER", () => {
    const user = new User({ name: "Dave", email: "dave@example.com" });
    expect(user.role).toBe("USER");
  });
});
