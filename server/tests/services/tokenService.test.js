const mongoose = require("mongoose");
const User = require("../../src/models/User");
const Session = require("../../src/models/Session");
const { generateTokens, refreshSession } = require("../../src/services/tokenService");

describe("tokenService", () => {
  let user;

  beforeEach(async () => {
    user = await User.create({ name: "Test", email: "test@example.com" });
  });

  it("generates access and refresh tokens", async () => {
    const tokens = await generateTokens(user);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();

    const session = await Session.findOne({ userId: user._id });
    expect(session).toBeDefined();
    expect(session.isRevoked).toBe(false);
  });

  it("rotates refresh token and marks old as revoked", async () => {
    const { refreshToken: r1 } = await generateTokens(user);
    const { refreshToken: r2 } = await refreshSession(r1);

    expect(r2).not.toBe(r1);

    // Old token should be revoked
    const oldSession = await Session.findOne({ isRevoked: true });
    expect(oldSession).toBeDefined();

    // New token should be valid
    const newSession = await Session.findOne({ isRevoked: false });
    expect(newSession).toBeDefined();
  });

  it("revokes family on token reuse", async () => {
    const { refreshToken: r1 } = await generateTokens(user);
    await refreshSession(r1); // r1 is now revoked

    // Reusing r1
    await expect(refreshSession(r1)).rejects.toThrow(/reuse detected/);

    // Everything in family should be revoked
    const validSessions = await Session.find({ isRevoked: false });
    expect(validSessions).toHaveLength(0);
  });
});
