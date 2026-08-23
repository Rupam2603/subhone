# SubhOne Order System — Design Spec

**Date:** 2026-08-23
**Status:** Approved for implementation (P0 detailed; P1–P3 roadmap)
**Scope:** Making the SubhOne order system fully functional, production-grade

---

## 1. Purpose

This document specifies the work required to take SubhOne's order system from its current
prototype state to a production-ready implementation with real persistence, real identity,
real payments and a real order lifecycle.

The programme is split into four sequential phases. **This document contains a full,
implementable design for P0 only**, plus a roadmap for P1–P3. Each later phase gets its own
spec and implementation plan when its predecessor lands, so details are written while they
are still accurate rather than guessed months ahead.

---

## 2. Current state

Findings from a read of the codebase on 2026-08-23. These are the actual motivation for the
phase ordering.

| # | Finding | Location | Severity |
|---|---------|----------|----------|
| 1 | **The cart is global.** `let cart = []` at module scope means every browser sharing the API shares one cart. | `server/src/services/store.js:15` | Critical bug |
| 2 | **Checkout trusts client-supplied line items.** `POST /api/checkout` prefers `req.body.items` over the server cart, so a client can dictate its own prices. | `server/src/routes/checkout.js:10` | Critical security |
| 3 | **The checkout page does not exist.** An 8-line stub rendering "This page is under construction." Both the cart drawer's CTA and the `/cart` redirect land here, so no order can be placed from the UI at all. | `client/src/pages/Checkout.jsx`, `client/src/App.jsx:24` | Blocking gap |
| 4 | **The order tracker is fake.** Status is derived purely from minutes elapsed since `placedAt` against a hardcoded offsets array. Nothing can set an order's real status. | `server/src/services/store.js:111-125` | Fiction |
| 5 | **No persistence.** Cart, orders, consultations and prescriptions are in-memory arrays; all reset on restart. Two fake past orders are seeded so the orders page isn't empty. | `server/src/services/store.js:15-19, 210-242` | Blocking gap |
| 6 | **No auth of any kind.** No user model, no sessions, no route protection. `GET /api/orders` returns every order to any caller. | `server/src/routes/orders.js:6` | Critical security |
| 7 | **No test infrastructure.** Server dependencies are `cors`, `dotenv`, `express`, `multer` and `nodemon`. No test runner, no assertions, nothing. | `server/package.json` | Blocks "production-ready" |
| 8 | **Money is stored as floating-point rupees**, and three pages (`Medicines.jsx:78`, `Supplements.jsx:45`, `LabTests.jsx:62`) interpolate `₹{item.price}` directly instead of using the `inr()` formatter. Will drift once percentage coupons, partial refunds and tax compound. | catalog data files, product pages | Correctness risk |
| 9 | Coupons are hardcoded in a source file, not data. | `server/src/data/content.js` | Maintainability |
| 10 | Business rules duplicated across client and server (`FREE_DELIVERY_ABOVE = 499` in both; the ₹499 threshold is also hardcoded in header copy). | `store.js:9`, `CartDrawer.jsx:9`, `Header.jsx:54` | Drift risk |

---

## 3. Goals and non-goals

**Goals.** Persistent, per-user carts and orders. Real authentication with customer and
admin roles. Server-authoritative pricing. Real payment capture via Razorpay. A genuine
order status lifecycle that operators control. Cancellation, reorder, prescription gating
and invoicing. Automated tests covering the money- and identity-critical paths.

**Non-goals for the whole programme.** Multi-warehouse inventory or logistics-partner
integration. A licensed-pharmacist compliance workflow beyond an approval gate. A full
GST/tax engine (order schema carries tax-ready fields; no rate engine). Internationalisation
or multi-currency. Native mobile apps. Recommendation or loyalty systems.

---

## 4. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Target fidelity | Production-ready | Explicit requirement; not a demo |
| Persistence | MongoDB + Mongoose 8 | Already available to the team |
| Mongo topology | Single-node replica set | Required for multi-document transactions (cart merge, stock decrement + order creation) |
| Identity | Full accounts, both email+password and phone+OTP | Email is primary and testable; phone matches Indian pharmacy UX |
| Password hashing | `bcrypt`, cost 12 | Prebuilt binaries, no native toolchain friction on Windows. argon2id is stronger but harder to install |
| Payment gateway | Razorpay (P2) | India/INR/UPI fits the app; its API is denominated in paise |
| SMS for OTP | `SmsProvider` interface, dev implementation logs the code | No provider account yet; real adapter drops in without touching auth logic |
| Money representation | Integer paise everywhere | Prevents float drift; matches Razorpay's unit |
| Server structure | Layered rewrite (`models` / `services` / `routes` / `middleware`) | P2–P3 add substantial logic that needs a home outside route handlers |
| Guest carts | Allowed, keyed by cookie, merged into user cart on login | No login wall before browsing |
| Plan shape | Roadmap for all phases, detailed spec per phase | Keeps each spec sharp enough to build from |

---

## 5. Phase roadmap

Phases are strictly sequential — each depends on the one before.

### P0 — Data and identity foundation *(detailed in §6)*

Mongoose models and connection, catalog and coupons migrated into Mongo, full auth with
roles, per-owner persisted carts with guest merge, money converted to paise, test
infrastructure, and the two critical security fixes (findings 2 and 6).

**Exit criterion:** the site behaves as it does today — same pages, same catalog, same cart
behaviour — but Mongo-backed, user-scoped, and with checkout no longer trusting client
input. No new user-facing features.

### P1 — Checkout and order placement

The multi-step checkout UI that does not currently exist: address selection from a saved
address book, delivery slot choice, coupon entry, and an order review step. Server
recomputes every total from the persisted cart and the live catalog; the client sends no
prices. Stock validated and decremented atomically with order creation inside a
transaction. Order confirmation screen. Order history and detail read from Mongo.
`CouponRedemption` records enforce per-user coupon limits. COD is the only payment method
in this phase, so the flow is provably correct before money is involved.

**Exit criterion:** a logged-in user places a COD order end-to-end; totals are
server-verified; stock decrements exactly once under concurrent attempts.

### P2 — Payments

A `PaymentProvider` interface with a Razorpay implementation. Gateway order creation,
client handoff, signature verification on return, and a webhook endpoint verifying the raw
body signature. Idempotency keys so a retried placement cannot double-charge or
double-create. Orders enter `PENDING_PAYMENT` and only become `PLACED` on confirmed
payment. A reconciliation path for payments left in limbo. A refund call that P3 consumes.

**Exit criterion:** a test-mode payment completes and is verified; replayed webhooks are
safe; an abandoned payment resolves correctly without stranding stock.

### P3 — Lifecycle and operations

A status state machine with explicit allowed transitions and guards, replacing the fake
timer. An admin console: filterable order list, order detail, status advancement,
cancellation and refund. Customer cancellation permitted before dispatch, wired to the P2
refund call. Reorder that returns available items to the cart and reports what is no longer
available. Prescription gating — Rx-required items block fulfilment until a prescription is
attached and pharmacist-approved. PDF invoices. An extension point for order notifications.

**Exit criterion:** an admin advances real status and the customer tracker reflects it; a
cancellation refunds; an invoice downloads.

---

## 6. P0 detailed design

### 6.1 Server structure

`services/store.js` is deleted and its responsibilities distributed.

```
server/src/
  config/
    env.js              zod-validated env; fails fast on missing/invalid vars
    db.js               mongoose connect with retry + connection event logging
    constants.js        FREE_DELIVERY_ABOVE_PAISE, DELIVERY_FEE_PAISE, ORDER_STATUS, limits
  models/
    User.js             + embedded AddressSchema
    Session.js          refresh-token records
    OtpChallenge.js
    Product.js          medicines + supplements, discriminated by `kind`
    LabTest.js
    Cart.js
    Order.js            full P0 shape; extended in P1–P3
    Coupon.js
    Consultation.js
    Prescription.js
    Counter.js          monotonic order-number sequence
  services/
    authService.js      register, login, token issue/rotate/revoke
    otpService.js       challenge lifecycle; delegates delivery to SmsProvider
    smsProvider.js      interface + DevLoggerProvider
    catalogService.js   queries, filtering, pagination
    cartService.js      owner resolution, mutation, price resolution, merge
    couponService.js    validation and discount computation
    orderService.js     listing, reads, and a ported createOrder (server-cart-only, COD);
                        P1 rewrites createOrder with slots, stock and redemption
  routes/               HTTP + validation only; no business logic
  middleware/
    attachUser.js       verifies access token, sets req.user (never throws)
    requireAuth.js      401 when req.user absent
    requireRole.js      403 when role mismatched
    attachCartOwner.js  resolves userId or mints/reads guest cookie
    validate.js         runs a zod schema against body/params/query
    originCheck.js      rejects cross-origin state-changing requests
    rateLimit.js        configured limiter factories
    errorHandler.js     central error → response mapping
  utils/
    AppError.js         status + machine code + message
    asyncHandler.js
    hash.js             sha256 helpers for token and OTP hashing
  scripts/
    seed.js             idempotent catalog, coupon and admin seeding
  tests/
```

### 6.2 Money representation

All monetary values are stored and transmitted as **integer paise**. Field names carry the
unit (`pricePaise`, `totalPaise`) so a bare `price` is never ambiguous.

Conversion happens at exactly two boundaries: `scripts/seed.js` multiplies the existing
rupee values by 100 on the way in, and the client's formatter divides by 100 on the way out.

Client call sites that must change, from an audit of the current code:

- `client/src/lib/format.js` — `inr()` now takes paise: `₹${(paise/100).toLocaleString("en-IN")}`. Every existing `inr()` call site then stays correct unchanged, because all values reaching them become paise.
- **`client/src/pages/Medicines.jsx:78-79`, `Supplements.jsx:45-46`, `LabTests.jsx:62-63` — these bypass `inr()` entirely** and interpolate raw values as `₹{med.price}`. Left alone they would render "₹1500" for a ₹15 medicine. All six sites must be converted to use `inr()` rather than patched, so this class of bug cannot recur.
- `client/src/components/CartDrawer.jsx:9` — `FREE_DELIVERY_ABOVE` becomes `49900`, imported from the new constants module rather than redeclared.
- `client/src/lib/constants.js` — **new**; holds `FREE_DELIVERY_ABOVE_PAISE` so the threshold is stated once on the client instead of three times.
- `client/src/components/Header.jsx:54` — hardcoded "₹499" copy derives from that constant.
- `client/src/components/FilterSidebar.jsx:6` — the `priceMax = 2000` default prop becomes `200000`.
- `client/src/components/FilterSidebar.jsx:50-51` — price-range state and the `maxPrice` query param both move to paise, so its existing `inr()` calls keep working.
- `client/src/pages/Home.jsx:353` — "from ₹349" is static marketing copy, not a computed value; it needs no conversion but is flagged so it isn't mistaken for one.
- `server/src/utils/filter.js:39-40,51-53` — `minPrice`/`maxPrice` comparisons and price sorting operate on paise.

Server-side conversion traps found in the audit:

- **Coupon `value` is unit-dependent.** In `data/content.js`, a `flat` coupon's `value` is rupees and must be multiplied by 100, while a `percent` coupon's `value` is percentage points and must **not** be. `minOrder` and `maxDiscount` always convert. The seed must branch on `type`; a test covers both kinds.
- **`data/doctors.js:15` — `consultationFee` is money too.** Consultation fees convert to `consultationFeePaise` when doctors and consultations migrate, or the consult flow will misprice by 100×.

A unit test asserts `inr(49900) === "₹499"` to catch a missed conversion.

### 6.3 Data model

Indexes are listed because they are part of the contract, not an afterthought.

**User**

```
email          String, lowercase, trim, sparse unique index
passwordHash   String, nullable          // null for phone-only accounts
phone          String, E.164, sparse unique index
phoneVerified  Boolean, default false
emailVerified  Boolean, default false
name           String, required
role           enum('customer','admin'), default 'customer', indexed
tokenVersion   Number, default 0         // bumped to invalidate all access tokens
addresses      [AddressSchema]
disabledAt     Date, nullable
timestamps
```

Invariant enforced in a pre-validate hook: **at least one of `email` or `phone` must be
present**, and an account with `email` must have a `passwordHash`.

**AddressSchema** (embedded, has its own `_id`)

```
label      String            // 'Home', 'Work'
name       String, required
phone      String, required, E.164
line1      String, required
line2      String
city       String, required
state      String, required
pincode    String, required, /^[1-9][0-9]{5}$/
isDefault  Boolean, default false
```

At most one address may have `isDefault: true`; `cartService` and the address service
enforce this by clearing the flag on siblings within a transaction.

**Session** — one document per issued refresh token.

```
userId          ObjectId → User, indexed
tokenHash       String (sha256 hex), unique index
family          String (uuid), indexed        // reuse detection
userAgent       String
ip              String
expiresAt       Date, TTL index (expireAfterSeconds: 0)
revokedAt       Date, nullable
replacedByHash  String, nullable
timestamps
```

**OtpChallenge**

```
phone       String, indexed
codeHash    String (sha256 of code + OTP_PEPPER)
purpose     enum('login','verify_phone')
attempts    Number, default 0, max 5
expiresAt   Date, TTL index          // 5 minutes
consumedAt  Date, nullable
timestamps
compound index { phone, purpose, consumedAt }
```

**Product** — medicines and supplements unified into one collection, discriminated by
`kind`. They share nearly every field, and a single collection makes cross-type search and
filtering straightforward.

```
slug                String, unique index
name                String, required
kind                enum('medicine','supplement'), indexed
brand               String, indexed
pricePaise          Number, integer, required, min 0
mrpPaise            Number, integer, required, min 0, must be >= pricePaise
image               String
prescriptionRequired Boolean, default false
stock               Number, integer, default 0, min 0
isActive            Boolean, default true, indexed
description, composition, packSize, dosageForm, manufacturer  String
categories          [String], indexed
tags                [String]
rating              { average: Number, count: Number }
timestamps
compound index { kind, isActive, brand }
text index on { name, brand, composition }
```

**LabTest** — kept separate; its shape genuinely differs.

```
slug, name, description
pricePaise, mrpPaise    Number, integer
testCount               Number
fastingRequired         Boolean
reportTimeHours         Number
sampleType              String
categories              [String]
isActive                Boolean, default true
timestamps
```

**Cart** — the security fix is structural here.

```
userId             ObjectId → User, partial unique index where userId exists
guestId            String, partial unique index where guestId exists
items              [{ refId, refModel: enum('Product','LabTest'),
                      quantity: 1..10, addedAt }]
appliedCouponCode  String, nullable      // revalidated on every read, never trusted
guestExpiresAt     Date, TTL index       // set only on guest carts
lastActiveAt       Date
timestamps
```

Cart items store **only a reference and a quantity — never a price**. Prices are resolved
from the live catalog on read and snapshotted onto the order at placement. This eliminates
both the client-supplied-price vulnerability and stale-price drift by construction rather
than by validation.

Invariant in a pre-validate hook: exactly one of `userId` or `guestId` is set. Item
uniqueness per `(refId, refModel)` is enforced in `cartService`.

Because Mongo TTL indexes cannot be conditional, `guestExpiresAt` is populated only for
guest carts (30 days); user carts leave it unset and therefore never expire.

**Order** — the full shape is defined now, even where fields go unused until P2/P3, so the
collection is never migrated twice.

```
orderNumber      String, unique index         // 'SO-<seq>' via Counter
userId           ObjectId → User, indexed
items            [{ refId, refModel, name, brand, kind, image,
                    unitPricePaise, mrpPaise, quantity,
                    prescriptionRequired, lineTotalPaise }]
pricing          { subtotalPaise, mrpSavingsPaise, couponCode,
                   couponDiscountPaise, deliveryFeePaise,
                   taxPaise, totalPaise }
shippingAddress  embedded snapshot            // copied, not referenced
paymentMethod    enum('COD','RAZORPAY'), default 'COD'
paymentStatus    enum('pending','paid','failed','refunded'), default 'pending'
status           ORDER_STATUS enum, default 'PLACED', indexed
statusHistory    [{ status, at, byUserId, note }]
placedAt         Date
cancelledAt, deliveredAt   Date, nullable
prescriptionIds  [ObjectId → Prescription]    // used in P3
idempotencyKey   String, sparse unique index  // used in P2
timestamps
compound index { userId, placedAt: -1 }
```

`ORDER_STATUS` is `PENDING_PAYMENT, PLACED, CONFIRMED, PACKED, DISPATCHED,
OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED, REFUNDED`. P0 defines the whole enum —
including `PENDING_PAYMENT`, which only becomes reachable in P2 — and writes an initial
`PLACED` entry into `statusHistory`. P0 does **not** implement transitions; the state machine
and the admin controls that drive it land in P3.

**Accepted regression:** deleting the fake timer means orders stop appearing to progress on
their own. Until P3, an order sits at `PLACED` and the tracker renders that honestly. This is
deliberate — showing invented progress is worse than showing real stasis.

**Coupon** — migrated out of `data/content.js`.

```
code             String, uppercase, unique index
type             enum('percent','flat')
value            Number                   // percent points, or paise for flat
minOrderPaise    Number, integer, default 0
maxDiscountPaise Number, nullable
validFrom, validUntil  Date
usageLimit       Number, nullable         // total redemptions allowed
usedCount        Number, default 0
perUserLimit     Number, default 1
appliesTo        enum('all','medicine','supplement','labTest'), default 'all'
isActive         Boolean, default true
timestamps
```

`CouponRedemption` is deliberately deferred to P1, where redemption actually happens.

**Counter** — `{ _id: String, seq: Number }`, incremented via `findOneAndUpdate` with
`$inc` and `upsert`, giving gap-free monotonic order numbers without a race.

**Consultation** and **Prescription** are straightforward ports of the existing in-memory
shapes, each gaining an indexed `userId`.

### 6.4 Identity and tokens

**Access token.** A JWT with payload `{ sub, role, ver }`, 15-minute lifetime, delivered in
an httpOnly `so_at` cookie scoped to `/`. `ver` is compared against `user.tokenVersion`, so
bumping that field invalidates every outstanding access token — the mechanism behind
password change and forced logout.

**Refresh token.** An opaque 256-bit random value, 30-day lifetime, in an httpOnly `so_rt`
cookie scoped to `/api/auth` so it is never sent with ordinary API traffic. Stored only as a
sha256 hash. Rotated on every use: the old `Session` is marked revoked with
`replacedByHash` set. **Reuse detection:** presenting an already-revoked token revokes the
entire `family`, on the assumption the token was stolen.

**Cookies.** All three (`so_at`, `so_rt`, `so_gid`) are httpOnly with `SameSite=Lax`.
`Secure` is driven by `COOKIE_SECURE` so local http development works.

**CSRF.** `SameSite=Lax` withholds cookies from cross-site POST, PUT and DELETE, which
covers the state-changing surface. `originCheck` middleware additionally rejects mutating
requests whose `Origin` is not in the allowlist, as defence in depth.

**Rate limits.** Login: 5 attempts per 15 minutes per IP+email pair. OTP request: 3 per hour
per phone and 10 per hour per IP. OTP verification: 5 attempts per challenge, after which the
challenge is consumed.

**Dual-method linking rule.** An OTP login for a phone that already belongs to an account
authenticates that account rather than creating a duplicate. A user who registered by email
can attach a phone via `POST /api/auth/link-phone`, which requires an OTP verification. A
phone-only account has a null `passwordHash` and can set one later.

### 6.5 Guest cart and merge

`attachCartOwner` runs on every cart-touching request. If `req.user` is set, the owner is
that user. Otherwise it reads the `so_gid` cookie, minting a UUID and setting the cookie when
absent.

On successful register, login or OTP verify, `cartService.mergeGuestCart` runs inside a
transaction: quantities for items present in both carts are summed and capped at available
stock, items unique to the guest cart are moved across, the guest cart document is deleted,
and the `so_gid` cookie is cleared. The operation is idempotent — a second call with no guest
cart present is a no-op.

### 6.6 API surface

The **cart, catalog and coupon contracts are deliberately preserved exactly as they are
today**, including the `{ id, type }` item shape with `type` of `medicine`, `supplement` or
`labTest`. `cartService` translates `type` to the internal `(refModel, kind)` pair. This keeps
Mongo model names out of the public API and means `CartContext.jsx` and the cart methods in
`api.js` need no changes at all — the only client-visible difference is that prices arrive in
paise.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{name, email, password}`; sets cookies, merges guest cart |
| POST | `/api/auth/login` | — | `{email, password}`; sets cookies, merges guest cart |
| POST | `/api/auth/otp/request` | — | `{phone, purpose}` → `202 {challengeId}`; dev provider also returns `devCode` |
| POST | `/api/auth/otp/verify` | — | `{challengeId, code}`; sets cookies, merges guest cart |
| POST | `/api/auth/link-phone` | user | OTP-verified phone attachment |
| POST | `/api/auth/refresh` | cookie | Rotates the refresh token |
| POST | `/api/auth/logout` | cookie | Revokes the session, clears cookies |
| GET | `/api/auth/me` | user | Current user, or 401 |
| PATCH | `/api/auth/me` | user | Name and password change (bumps `tokenVersion`) |
| GET/POST | `/api/me/addresses` | user | List, create |
| PATCH/DELETE | `/api/me/addresses/:id` | user | Update, remove |
| POST | `/api/me/addresses/:id/default` | user | Set default |
| GET | `/api/cart` | either | Contract unchanged; prices resolved live, in paise |
| POST | `/api/cart/add` | either | Contract unchanged |
| PUT | `/api/cart/update` | either | Contract unchanged |
| DELETE | `/api/cart/:type/:id` | either | Contract unchanged |
| DELETE | `/api/cart` | either | Contract unchanged |
| GET | catalog endpoints | — | Contracts unchanged; Mongo-backed, paise |
| POST | `/api/coupons/validate` | either | Contract unchanged; `subtotal` in paise |
| POST | `/api/checkout` | **user** | **Ignores `body.items` entirely**; always uses the server cart |
| GET | `/api/orders` | user | Own orders only |
| GET | `/api/orders/:id` | user | Own order, or any for an admin |

"either" means guest or authenticated. Requiring auth on checkout is consistent with the
accounts decision: a guest proceeding to checkout is prompted to log in, and their cart
merges across.

### 6.7 Middleware chain

```
cors(credentials, origin allowlist)
  → cookieParser
  → express.json
  → originCheck            (mutating methods only)
  → rateLimit              (per-route configuration)
  → attachUser             (optional; never throws)
  → attachCartOwner        (cart and checkout routes)
  → validate(schema) → handler
  → 404 handler
  → errorHandler
```

### 6.8 Error and validation contract

Errors are emitted as `{ error: "human readable message", code: "MACHINE_CODE", details?: [] }`.

**`error` stays a plain string deliberately.** `client/src/lib/api.js:26` reads `data.error`
as a string; nesting it into an object would silently degrade every error message in the UI
to the generic fallback. `code` and `details` are added alongside it.

Status codes: 400 malformed request, 401 unauthenticated, 403 wrong role, 404 missing,
409 conflict such as duplicate email, 422 validation failure with per-field `details`,
429 rate limited, 500 unexpected. Every mutating route validates with zod.

### 6.9 Client changes

New: `context/AuthContext.jsx` (bootstraps from `GET /api/auth/me`, exposes login, register,
OTP and logout), `components/RequireAuth.jsx`, `pages/Login.jsx`, `pages/Register.jsx`.

Modified:

- `lib/api.js` — `credentials: 'include'`; a 401 handler that attempts one silent `/auth/refresh`, retries the original request once, then redirects to login; new auth and address methods.
- `lib/format.js` — `inr()` takes paise.
- `main.jsx` — `AuthProvider` wraps `CartProvider`, since the cart merge is triggered by auth events.
- `App.jsx` — `/login` and `/register` routes; `RequireAuth` around `/orders`.
- `components/Header.jsx` — account menu; free-delivery copy from `lib/constants.js`.
- `components/CartDrawer.jsx` — paise threshold, imported from `lib/constants.js`.
- `components/FilterSidebar.jsx` — paise price range.
- `pages/Orders.jsx` — timeline rendered from `statusHistory` against the canonical stage list instead of the fabricated one.

`CartContext.jsx` is intentionally untouched.

### 6.10 Configuration

`server/.env.example`, with `env.js` refusing to boot on anything missing or malformed:

```
MONGODB_URI=mongodb://127.0.0.1:27017/subhone?replicaSet=rs0
PORT=5000
NODE_ENV=development
JWT_SECRET=                  # >=32 chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:5173
OTP_PEPPER=                  # >=16 chars
SMS_PROVIDER=dev             # dev | msg91 | twilio
GUEST_CART_TTL_DAYS=30
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

### 6.11 Seeding

`scripts/seed.js`, run via `npm run seed`, upserts catalog by `slug` and coupons by `code`,
converting rupees to paise. It is safe to re-run: existing documents are updated in place,
never duplicated, and stock is only initialised on insert so re-seeding cannot silently
restock. It creates the admin user from `SEED_ADMIN_*` if absent. A `--fresh` flag drops the
catalog collections only; it will never touch users or orders.

### 6.12 Testing

`vitest` + `supertest` + `mongodb-memory-server` in `MongoMemoryReplSet` mode, which
provides the transaction support the design depends on. Written test-first, per the project's
TDD workflow.

Priority coverage:

- Refresh-token rotation, and reuse detection revoking the family.
- `tokenVersion` bump invalidating outstanding access tokens.
- Cart owner resolution for guest and user, and merge idempotency including the stock cap.
- Server-side price resolution — specifically that a forged `items` payload to `/api/checkout` cannot influence totals (regression test for finding 2).
- `GET /api/orders` returning only the caller's orders (regression test for finding 6).
- Coupon validation boundaries: `minOrderPaise`, `maxDiscountPaise`, expiry, inactive.
- Seed idempotency across two consecutive runs.
- `inr()` paise formatting.

### 6.13 P0 exit checklist

1. `npm run seed` populates catalog, coupons and admin; a second run changes nothing.
2. Server boots only with a valid `.env`; a missing `JWT_SECRET` fails fast with a clear message.
3. A user registers, logs out, logs back in; cookies rotate; `GET /api/auth/me` reflects state.
4. Phone OTP login works with the dev provider's logged code.
5. A guest adds items, logs in, and finds the cart merged with correct quantities.
6. Two different browsers hold two different carts (finding 1 resolved).
7. A forged `items` array sent to `/api/checkout` is ignored (finding 2 resolved).
8. `GET /api/orders` returns only the caller's orders (finding 6 resolved).
9. Restarting the server preserves users, carts and orders (finding 5 resolved).
10. Every price in the UI renders correctly with paise storage — medicines, supplements, lab tests, cart lines, cart subtotal, search results, filter range and order totals all verified by eye; `grep -r '₹{' client/src` returns nothing.
11. `store.js` no longer exists.
12. The full test suite passes.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Local Mongo runs standalone, so transactions fail at runtime | `db.js` logs an explicit warning when the topology is not a replica set; README documents single-node replica set setup; tests run against `MongoMemoryReplSet` so the gap surfaces immediately |
| `bcrypt` native build fails on the dev machine | Fall back to `bcryptjs`; hashing is isolated behind `authService` so the swap is one import |
| A paise conversion is missed somewhere | This is the likeliest source of P0 defects — an audit already found three pages bypassing `inr()`, a hardcoded `priceMax`, unit-dependent coupon values and doctor fees. The §6.2 list is the checklist; the `inr()` unit test, a coupon-seed test covering both types, and manual pass of exit item 10 catch stragglers. Grep for `₹{` before declaring P0 done |
| Orders no longer self-advance, looking like a regression | Accepted and documented; real transitions arrive in P3 |
| `mongodb-memory-server` first-run download is slow or blocked | Pin the binary version and cache it; document an override to point tests at a local Mongo |
| Auth work expands into password reset, email verification, social login | Explicitly out of P0 scope; `emailVerified` exists as a field but no verification flow is built |

---

## 8. New dependencies

**Server:** `mongoose`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `zod`,
`express-rate-limit`, `uuid`. Dev: `vitest`, `supertest`, `mongodb-memory-server`.

**Client:** none — `react-router-dom` is already present.
