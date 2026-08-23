# Verifying SubhOne P0 on your machine

## What is now actually proven

`npm run test:nodb` — **11 tests, 11 passed, 0 failed.** These ran for real, here, just now:

- `tests/config/env.test.js` — environment validation rejects a short `JWT_SECRET`, a missing
  `MONGODB_URI`, and coerces types correctly.
- `tests/middleware/errorHandler.test.js` — the error envelope emits `error` as a plain string
  alongside `code` and `details`, zod failures return 422 with per-field details, duplicate keys
  return 409, and unexpected errors return a generic 500 that does not leak `err.message`.
  `validate()` leaves `req.query` intact when only a body schema is declared.

Also verified by execution: `require("./src/app.js")` loads the whole server and mounts 10 routers,
and `loadEnv()` validates cleanly against `.env.example`. `node --check` passes on all 45 files.

That is real signal on the foundation — the error envelope and the validation middleware are the
two pieces every later task depends on.

## The bug this found

Four test suites opened with `const { describe, it, expect } = require("vitest")`. Vitest refuses to
be required from a CommonJS module and throws immediately, so **those files aborted before a single
assertion ran** — on any machine, not just this one. `vitest.config.js` already sets `globals: true`,
so the imports were redundant as well as fatal. Removed in commit `80481e4`. Had I not built a
working runner, you would have discovered this yourself on first run.

## What still cannot run here, and why

Six suites need a live MongoDB: `models/counter`, `models/user`, `services/tokenService`,
`services/otpService`, `middleware/auth`, `routes/auth`. They use `MongoMemoryReplSet`, which
downloads a `mongod` binary on first use, and this sandbox has **no network route at all** —
`fastdl.mongodb.org` 403s, `npm install` 403s, and the host's own MongoDB on port 27017 is
unreachable. No cached binary exists on disk. Nothing about that is fixable from in here.

Separately, `vitest` itself cannot start in this sandbox: `node_modules` was installed on your
Windows host, so the only bundler binding present is `@rolldown/binding-win32-x64-msvc`. That is why
`tests/_shim.cjs` exists — it maps the vitest surface this suite uses onto Node's built-in test
runner, which needs no native bindings. It is a sandbox tool, not a replacement for vitest.

## Run this

```
cd D:\Subhasis\SubhOne\Website\server
npm install
npm test
```

`npm install` is not optional even though `node_modules` exists. `server/package.json` previously
declared only 4 of its 10 runtime dependencies — a fresh clone produced a server that could not
boot. The install also moves three packages onto the majors the plan targets:

| Package | Was on disk | Now declared | Why |
|---|---|---|---|
| `mongoose` | 9.9.3 | `^8.9.0` | The plan's Global Constraint says Mongoose 8.x; 9.x's breaking changes cannot be verified here |
| `zod` | 4.4.3 | `^3.24.1` | 4.x renamed `.errors`→`.issues` and moved `z.string().email()`→`z.email()` |
| `vitest` | 4.1.11 | `^3.2.4` | 4.x's rolldown bindings are what break cross-platform; 3.x uses esbuild and ships prebuilt binaries for both |

The first `npm test` expects a ~100 MB `mongod` download before the suite starts, so it is slow once
and fast afterwards.

## What to expect

The 11 tests above should stay green. The six DB suites are running for the first time ever, so
expect some red — that is the point, and the failures are cheap information. If it fails at the
harness level rather than in a test body:

- `tests/setup.js` deliberately loads `.env.example`, so tests never depend on your real `.env`.
  If it throws on boot, a required key is missing from `.env.example`.
- `.env.example` has no `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Optional for tests, required by
  `npm run seed`.
- The harness uses `MongoMemoryReplSet`, not `MongoMemoryServer`, because the design relies on
  transactions. A standalone mongod cannot run this suite.

Paste the output back — pass or fail — and I will work through the failures and continue.
