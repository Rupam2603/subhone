require("dotenv").config({ path: ".env.example" });
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let replSet;

beforeAll(async () => {
  // Replica set (not MongoMemoryServer) because the design relies on transactions.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = replSet.getUri();

  // afterEach below empties every collection. A real Atlas cluster is configured in
  // .env now, so a mis-wired harness would not fail loudly — it would quietly delete
  // production data. Refuse anything that is not the ephemeral local server.
  const host = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Test harness refused to connect to "${host}". Tests destroy all data after ` +
        `every case and may only run against an in-memory MongoDB on localhost.`
    );
  }

  await mongoose.connect(uri);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) await collections[key].deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
