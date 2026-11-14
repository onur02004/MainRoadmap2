import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
process.env.NODE_ENV = 'test';
const { encryptSpotifyToken, decryptSpotifyToken } = await import('../src/utils/tokenEncryption.js');

test('Spotify token encryption round-trips and does not store plaintext', () => {
  const original = 'spotify-access-token-example';
  const encrypted = encryptSpotifyToken(original);
  assert.notEqual(encrypted, original);
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(decryptSpotifyToken(encrypted), original);
});

test('Spotify token encryption preserves legacy plaintext values for migration compatibility', () => {
  assert.equal(decryptSpotifyToken('legacy-plaintext-token'), 'legacy-plaintext-token');
});

test('Spotify token encryption returns null for missing token', () => {
  assert.equal(encryptSpotifyToken(null), null);
  assert.equal(decryptSpotifyToken(null), null);
});
