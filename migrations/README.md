# Database migrations

The supplied project currently has a manually accumulated `sql.txt` schema and no ordered migration history. No database DDL was changed by this release-hardening pass, so a fabricated baseline migration is intentionally not included.

Before the next schema change, adopt a migration runner (for example `node-pg-migrate`) and create a baseline from a verified dump of the actual production PostgreSQL schema. Do not treat `sql.txt` alone as a verified production schema: some referenced core tables (including `users` and `user_spotify_accounts`) are not fully defined there.

The `scripts/encryptSpotifyTokens.js` task is a data migration, not a schema migration. Back up the database first, set `SPOTIFY_TOKEN_ENCRYPTION_KEY`, then run `npm run encrypt:spotify-tokens`.
