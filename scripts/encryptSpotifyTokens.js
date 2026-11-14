import 'dotenv/config';
import pool from '../src/config/db.js';
import { encryptSpotifyToken } from '../src/utils/tokenEncryption.js';

if (!process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY) {
  throw new Error('Set SPOTIFY_TOKEN_ENCRYPTION_KEY before running this migration.');
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    `SELECT user_id, access_token, refresh_token FROM user_spotify_accounts FOR UPDATE`
  );
  let updated = 0;
  for (const row of rows) {
    const accessToken = encryptSpotifyToken(row.access_token);
    const refreshToken = encryptSpotifyToken(row.refresh_token);
    if (accessToken !== row.access_token || refreshToken !== row.refresh_token) {
      await client.query(
        `UPDATE user_spotify_accounts SET access_token = $1, refresh_token = $2, updated_at = NOW() WHERE user_id = $3`,
        [accessToken, refreshToken, row.user_id]
      );
      updated += 1;
    }
  }
  await client.query('COMMIT');
  process.stdout.write(`Encrypted Spotify tokens for ${updated} account(s).\n`);
} catch (error) {
  await client.query('ROLLBACK');
  process.stderr.write(`Spotify token migration failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
