# Verifying SubhOne P0 on your machine

Everything on the `feat/p0-data-identity-foundation` branch was written but **not executed**. This
sandbox cannot run the suite, for three reasons I confirmed by probe rather than assumption:

- `node_modules` was installed on Windows, so the only bundler binding present is
  `@rolldown/binding-win32-x64-msvc`. On Linux, `vitest` cannot start at all.
- `mongodb-memory-server` downloads a `mongod` binary on first use, and `fastdl.mongodb.org`
  returns 403 from here. No cached binary exists anywhere on disk.
- `npm install` returns 403 for every package, so none of the above can be repaired in place.
- Even `require("mongoose")` exceeds 20 seconds over the mounted filesystem, so import smoke
  tests are not meaningful here either.

What I *could* verify: `node --check` on all 40 files under `server/src` and `server/tests` passes
with zero syntax errors, `loadEnv()` validates cleanly against `.env.example`, and `bcrypt`,
`jsonwebtoken`, `express-rate-limit`, `zod` and `cookie-parser` all import cleanly.

**No test in this project has ever been executed.** Treat every claim below as unproven until the
commands here go green on your machine.

## Run this

```
cd D:\Subhasis\SubhOne\Website\server
npm install
npm test
```

`npm install` is not optional even though `node_modules` already exists. I corrected
`server/package.json`, which previously declared only 4 of its 10 runtime dependencies — a fresh
clone would have produced a server that could not boot. The install also moves three packages onto
the majors the plan targets:

| Package | Was on disk | Now declared | Why |
|---|---|---|---|
| `mongoose` | 9.9.3 | `^8.9.0` | The plan's Global Constraint says Mongoose 8.x; 9.x's breaking changes cannot be verified here |
| `zod` | 4.4.3 | `^3.24.1` | 4.x renamed `.errors`→`.issues` and moved `z.string().email()`→`z.email()` |
| `vitest` | 4.1.11 | `^3.2.4` | 4.x's rolldown bindings are what break cross-platform; 3.x uses esbuild and has prebuilt binaries for both |

The first `npm test` run downloads a `mongod` binary (~100 MB) before the suite starts, so expect a
slow first run and a fast second one.

## What to expect

The suite covers `config/env`, `models/counter`, `models/user`, `services/tokenService`,
`middleware/errorHandler`, `middleware/auth` and `routes/auth`. Because none of it has run, the
realistic outcome is that some of it fails on first contact. That is the point of running it — the
failures are cheap to fix and they are real information, whereas a green claim from me would have
been fiction.

If `npm test` fails at the harness level rather than in a test body, check these first:

- `tests/setup.js` loads `.env.example` deliberately, so tests never depend on your real `.env`.
  If it throws on boot, a required key is missing from `.env.example`.
- `.env.example` currently has no `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. They are optional for
  tests but `npm run seed` needs them.
- The harness uses `MongoMemoryReplSet`, not `MongoMemoryServer`, because the design relies on
  transactions. A standalone mongod cannot run this suite.

## Then

Paste the output back to me — pass or fail — and I will work through the failures and continue with
the remaining tasks against a harness that actually runs.
