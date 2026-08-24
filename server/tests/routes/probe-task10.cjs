// Sandbox-only runner for tests/routes/otp.test.js. NOT a replacement for `npm test`.
//
// The committed suite is a vitest suite, and vitest is what runs on the developer's
// machine. Neither vitest nor mongodb-memory-server can start in this Linux sandbox:
// node_modules was installed on the Windows host, so the only rollup binding and the
// only cached mongod are win32 binaries, and there is no network here to fetch the
// Linux ones. Rather than leave the task unverified, this file runs the *same* test
// cases against the *real* Express app, stubbing only the query surface of the three
// Mongoose models with an in-memory bucket per collection.
//
// Documents are real mongoose documents, so schema validation, the email-or-phone
// invariant and the toJSON transform are all exercised for real. What this does NOT
// verify: index-enforced uniqueness, the TTL reaper, CastError on a malformed
// ObjectId, save()-time validators, and anything transactional.
//
// Run: node --test tests/routes/probe-task10.cjs
require("dotenv").config({ path: ".env.example" });
require("../_shim.cjs");

const User = require("../../src/models/User");
const OtpChallenge = require("../../src/models/OtpChallenge");
const Session = require("../../src/models/Session");

const buckets = [];

// Loose equality: query values arrive as strings, stored values may be ObjectIds.
const eq = (a, b) => (a === undefined || a === null ? a === b : String(a) === String(b));
const matches = (query = {}) => (doc) =>
  Object.entries(query).every(([key, want]) => eq(key === "_id" ? doc._id : doc.get(key), want));

function install(Model, unique = []) {
  const bucket = [];
  buckets.push(bucket);

  Model.create = async (attrs) => {
    const doc = new Model(attrs);
    const invalid = doc.validateSync(); // keeps the model's own invariants real
    if (invalid) throw invalid;
    for (const field of unique) {
      const v = doc.get(field);
      if (v !== undefined && v !== null && bucket.some((d) => eq(d.get(field), v))) {
        const err = new Error(`E11000 duplicate key error collection: ${field}`);
        err.code = 11000;
        throw err;
      }
    }
    doc.save = async () => doc; // the document object *is* the stored record
    bucket.push(doc);
    return doc;
  };

  Model.findOne = async (query) => bucket.find(matches(query)) || null;
  Model.findById = async (id) => bucket.find((doc) => String(doc._id) === String(id)) || null;
  Model.countDocuments = async (query) => bucket.filter(matches(query)).length;
}

install(User, ["email", "phone"]); // sparse unique indexes in the real schema
install(OtpChallenge);
install(Session, ["tokenHash"]);

// Stands in for setup.js wiping every collection between cases.
afterEach(() => {
  for (const bucket of buckets) bucket.length = 0;
});

require("./otp.test.js");
