const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let replSet;

beforeAll(async () => {
  // Replica set (not MongoMemoryServer) because the design relies on transactions.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) await collections[key].deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
