# MainRoadmap2 / SongShare – Release Readiness

This document records the changes applied in this release-hardening pass and the items that still require deployment or product-owner action. It is not a penetration-test certification.

## Required production environment

- `NODE_ENV=production`
- `JWT_SECRET`: at least 32 random characters. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- `SPOTIFY_TOKEN_ENCRYPTION_KEY`: exactly 32 random bytes as base64 (or 64 hex characters). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `CORS_ORIGINS`: comma-separated exact trusted origins, e.g. `https://your-domain.example` (no path).
- `TRUST_PROXY=1` only when the app is behind exactly one trusted reverse proxy; adjust the hop count if your deployment differs.
- Existing Spotify callback configuration must use the exact HTTPS callback URL configured in the Spotify Developer Dashboard.

Do not commit these values. The server now refuses to start in production without `JWT_SECRET` and `SPOTIFY_TOKEN_ENCRYPTION_KEY`.

## Changes applied

- Custom theme create/delete now require an authenticated session and enforce owner identity server-side. Theme listing returns public themes plus the current user's own themes; request query parameters cannot impersonate another user.
- Theme card and toast rendering use DOM text nodes / `textContent` rather than interpolating user-supplied names/status into `innerHTML`.
- Spotify OAuth uses a random short-lived, one-time state cookie; callback requires the signed-in SongShare session and constant-time state comparison.
- Spotify access/refresh tokens are encrypted at rest with AES-256-GCM when the encryption key is configured. Legacy plaintext rows remain readable so existing installations do not break; they are rewritten encrypted on the next successful connection/refresh. **For full at-rest remediation, backfill/reconnect existing linked accounts before launch.**
- Spotify application-level client-credentials token is cached in-process and concurrent refresh requests are coalesced.
- Spotify disconnect endpoint removes the user's local account/token row.
- Friend listening activity is intentionally fail-closed and returns an empty list with `availability: friendship-graph-required`. The supplied SQL schema has no accepted-friendship relationship or activity-consent table; returning all Spotify-linked users was a privacy leak. Implement a real friend graph and explicit activity consent before restoring this feature.
- SongShare create/update/rate/comment/repost endpoints validate visibility and supplied fields, enforce access to private/custom shares, constrain comment lengths, and use atomic array updates for repost toggling.
- Feed pagination now honors `page` and `limit`, and private recipient/repost arrays are removed from feed responses.
- Login/register validation and endpoint rate limits were added. An authenticated password-change endpoint and account settings form were also added; password reset by email and self-service account deletion still require an email provider and retention/deletion policy. The login response keeps a non-secret compatibility sentinel in both legacy response shapes. New login/register responses no longer expose the JWT to JavaScript; the real token is stored in an HttpOnly cookie. Cookie-first auth keeps compatibility with old Authorization headers where possible. Logout now clears the cookie server-side.
- Basic security headers, report-only CSP, origin checks for browser mutations, exact-origin CORS, API rate limits, and protected direct-page routes were added.
- Production errors return generic server messages; debug routes are not mounted in production.
- Placeholder Photobooth endpoint now returns an explicit empty state rather than demo photos pretending to be user data.
- Repost and Immersive controls on the SongShare feed are connected to existing endpoints / preview UI.
- `npm test` now uses Node's built-in test runner; focused token-encryption tests were added.

## Known limitations / not safe to claim complete

- There is no accepted-friendship database table or activity-consent model in the supplied SQL. Friend activity is disabled rather than exposing listening details to strangers.
- Existing Spotify token rows in PostgreSQL may still be plaintext until migrated. After backing up the database and setting the encryption key, run `npm run encrypt:spotify-tokens` once; reconnect/refresh also encrypts updated tokens.
- Password change is now available from Account Settings after re-checking the current password. Password reset by email, email verification, and self-service account deletion remain unimplemented; they require an email provider and explicit deletion/retention policy decisions. The password-change flow rotates the current browser cookie but does not instantly revoke previously issued stateless JWTs in other sessions; full per-user session revocation needs a session/token-version field and a verified database migration.
- `sql.txt` is a manually accumulated schema file and `migrations/` was empty. A repeatable migration history and schema verification against the real production database are still required. No production database was available in this source ZIP.
- Theme custom background images can still be user-supplied HTTPS URLs or data URLs; production should consider file size/content-type validation and object storage rather than storing large base64 payloads in PostgreSQL.
- The existing UI has many legacy inline scripts and third-party embeds. CSP is deliberately `Report-Only`; do not switch it to enforce mode until violations are reviewed and nonce/hash support is implemented.
- The rate limiter is in-memory and per Node process. Multi-instance deployments need a shared Redis-backed limiter. Configure `CORS_ORIGINS` for every trusted frontend origin; do not use wildcards with credentialed cookies.
- Friend activity and Photobooth content have been gated to prevent misleading/insecure behavior; build the data model/storage before re-enabling them.
- No live Spotify OAuth, real PostgreSQL, multi-user, or browser end-to-end test could be performed from this offline source archive.
- `npm audit` could not be completed in the offline environment. Run `npm ci` and `npm audit --omit=dev` in CI with registry access, then review/fix findings.
- Privacy policy, Terms of Service, Impressum, copyright/licensing review for lyrics, support contact, and incident-response details require the actual operator/company information and legal review; they are not fabricated here.
- The source includes large GIF/avatar assets. Optimize these (WebP/AVIF where appropriate) before serving at scale.

## Verification commands

```bash
npm ci
npm test
npm audit --omit=dev
```

The source-level syntax pass should also run over `src/**/*.js` and relevant browser modules. Before deployment, test with a staging PostgreSQL database and at least two separate users, including private-share access checks and OAuth reconnect/disconnect flows.
