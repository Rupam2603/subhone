const mongoose = require("mongoose");
const Counter = require("../../src/models/Counter");

describe("Counter model", () => {
  it("initializes a sequence at 1", async () => {
    const seq = await Counter.getNextSequence("order");
    expect(seq).toBe(1);
  });

  it("increments atomically", async () => {
    // Run 50 increments concurrently. Mongo guarantees atomic $inc.
    const promises = Array.from({ length: 50 }).map(() => Counter.getNextSequence("test"));
    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);
    expect(new Set(results).size).toBe(50); // No duplicates
    expect(Math.max(...results)).toBe(50);
  });

  it("respects transactions", async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    await Counter.getNextSequence("tx", session);
    await Counter.getNextSequence("tx", session);

    // Should not be visible outside transaction yet
    const docOutside = await Counter.findById("tx");
    expect(docOutside).toBeNull();

    await session.commitTransaction();
    session.endSession();

    const docAfter = await Counter.findById("tx");
    expect(docAfter.seq).toBe(2);
  });
});
