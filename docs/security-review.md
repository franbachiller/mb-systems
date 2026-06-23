# MB Systems - Security review

## Executive summary

The MVP had a reasonable server-side auth boundary for admin actions, but it still exposed common web-app risks: state-changing endpoints without same-origin checks, no global security headers, production fallback credentials, a fail-open Mercado Pago webhook secret, public endpoint abuse risk, and a moderate transitive dependency advisory.

All practical MVP-level fixes below were applied and verified with lint, build, runtime checks, and `npm audit`.

## Fixed findings

### SEC-001 - Missing CSRF/origin defense on state-changing endpoints

Severity: High

Location:

- Shared control: `src/lib/request-security.ts:18`
- Public reservation create: `src/app/api/bookings/route.ts:39`
- Admin booking update: `src/app/api/bookings/[id]/route.ts:25`
- Admin payment/operation writes: `src/app/api/bookings/[id]/payments/route.ts:20`, `src/app/api/bookings/[id]/operations/route.ts:23`
- Admin catalog/inventory writes: `src/app/api/products/route.ts:20`, `src/app/api/products/[id]/route.ts:24`, `src/app/api/inventory-blocks/route.ts:41`, `src/app/api/inventory-blocks/[id]/route.ts:19`
- Public booking lookup/payment preference: `src/app/api/public-bookings/lookup/route.ts:13`, `src/app/api/mercadopago/preferences/route.ts:28`

Impact: A malicious site could attempt cross-site POST/PATCH/DELETE requests against cookie-authenticated admin endpoints.

Fix applied: Added a same-origin Origin/Referer check for all app-owned state-changing endpoints. Mercado Pago webhook remains external by design and is handled separately by signature validation.

### SEC-002 - Public endpoint abuse / enumeration risk

Severity: Medium

Location:

- Shared limiter: `src/lib/request-security.ts:32`
- Public reservation create: `src/app/api/bookings/route.ts:45`
- Public lookup: `src/app/api/public-bookings/lookup/route.ts:19`
- Mercado Pago preference create: `src/app/api/mercadopago/preferences/route.ts:34`

Impact: Attackers could script booking spam, repeated lookup attempts, or payment preference creation.

Fix applied: Added in-memory rate limits to the public mutation/lookup/payment endpoints. This is enough for a single-node MVP; production should move this to Redis/edge/WAF.

### SEC-003 - Missing security headers

Severity: Medium

Location: `next.config.ts:11`, `next.config.ts:16`, `next.config.ts:28`

Impact: Missing defense-in-depth against clickjacking, MIME sniffing, unsafe embedding, and overly broad browser capabilities.

Fix applied: Added global headers: CSP for `base-uri`, `object-src`, `frame-ancestors`, `form-action`; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy`; and `Permissions-Policy`.

### SEC-004 - Production fallback admin credentials

Severity: High

Location: `src/lib/admin-auth.ts:110`, `src/lib/admin-auth.ts:120`

Impact: A production deployment without env vars could silently use local fallback auth values.

Fix applied: Local development still supports the fallback PIN, but production now fails closed unless `ADMIN_PIN` and `ADMIN_SESSION_SECRET` are configured.

### SEC-005 - Mercado Pago webhook fail-open in production

Severity: Medium

Location: `src/app/api/mercadopago/webhook/route.ts:102`

Impact: If payments were enabled in production without a webhook secret, forged payment callbacks could be accepted.

Fix applied: Missing webhook secret is tolerated only outside production. In production, webhook signature validation fails closed.

### SEC-006 - Checkout redirect destination validation

Severity: Low

Location: `src/lib/mercado-pago.ts:179`, `src/lib/mercado-pago.ts:253`

Impact: A malformed external payment response could become an unsafe browser redirect.

Fix applied: Mercado Pago checkout URLs must be HTTPS and belong to allowed Mercado Pago hostnames before being returned to the browser.

### SEC-007 - Transitive dependency advisory

Severity: Medium

Location: `package.json:18`, `package.json:20`

Impact: `npm audit` reported vulnerable `postcss <8.5.10` through Next's nested dependency.

Fix applied: Added an npm override forcing Next's `postcss` to `8.5.10`. `npm audit --audit-level=moderate` now reports 0 vulnerabilities.

## Remaining risks for production

### RISK-001 - PIN-only admin auth

PIN auth is acceptable for a private MVP demo, but production should use real users, roles, password hashing, audit logs, and optional 2FA.

### RISK-002 - In-memory rate limits

The current limiter resets on process restart and does not share state across multiple instances. Use Redis, a reverse proxy, Cloudflare/Vercel/edge limits, or WAF rules in production.

### RISK-003 - CSP is conservative, not strict

The CSP avoids breaking Next.js by not enforcing strict `script-src` nonces yet. For production hardening, implement nonce-based CSP or roll out report-only CSP first.

### RISK-004 - SQLite/local file database

SQLite is fine for MVP/demo and small single-user setups. Multi-user production should move to PostgreSQL with migrations, backups, and transaction tests around availability.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Runtime checks:
  - Public lookup without `Origin`: `403`.
  - Public lookup with same-origin but invalid body: `400`.
  - Admin login without `Origin`: `403`.
  - Admin login with same-origin wrong PIN: `401`.
  - Home response includes CSP, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
