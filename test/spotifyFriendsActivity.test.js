import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

process.env.SPOTIFY_CLIENT_ID = 'unit-test-client';
process.env.SPOTIFY_CLIENT_SECRET = 'unit-test-secret';
process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/spotify/callback';
const spotifyService = await import('../src/services/spotifyService.js');

test('Spotify authorization requests recently-played permission', () => {
  const url = new URL(spotifyService.getAuthorizeURL('unit-test-state'));
  const scopes = url.searchParams.get('scope').split(' ');
  assert.ok(scopes.includes('user-read-recently-played'));
});

test('recently-played service requests one track with the user access token', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuthorization = '';

  globalThis.fetch = async (url, options = {}) => {
    capturedUrl = String(url);
    capturedAuthorization = options.headers?.Authorization || '';
    return {
      ok: true,
      json: async () => ({ items: [{ played_at: '2026-11-14T12:00:00Z', track: { id: 'track-1' } }] })
    };
  };

  try {
    const result = await spotifyService.getRecentlyPlayedTrack('friend-access-token');
    assert.equal(capturedUrl, 'https://api.spotify.com/v1/me/player/recently-played?limit=1');
    assert.equal(capturedAuthorization, 'Bearer friend-access-token');
    assert.equal(result.items[0].track.id, 'track-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('friends activity is limited to explicitly classified contacts and omits email', async () => {
  const source = await readFile(path.join(root, 'src/controllers/spotifyController.js'), 'utf8');
  const start = source.indexOf('export const getFriendsActivity');
  const end = source.indexOf('export const getActiveFriendsNowPlaying', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /LOWER\(COALESCE\(u\.relation::text, 'normal'\)\) = ANY/);
  assert.match(handler, /\['friends', 'family'\]/);
  assert.match(handler, /LEFT JOIN user_spotify_accounts/);
  assert.doesNotMatch(handler, /u\.email/);
  assert.doesNotMatch(handler, /availability:\s*'friendship-graph-required'/);
});


test('relation values match the PostgreSQL user_relation_type enum used by the app', async () => {
  const controller = await readFile(path.join(root, 'src/controllers/adminController.js'), 'utf8');
  const validators = await readFile(path.join(root, 'src/utils/validators.js'), 'utf8');
  const adminHtml = await readFile(path.join(root, 'public/admin/admin.html'), 'utf8');
  const expected = ['normal', 'friends', 'acquaintance', 'family', 'business'];
  for (const value of expected) {
    assert.ok(controller.includes(`'${value}'`), `admin controller missing ${value}`);
    assert.ok(validators.includes(`'${value}'`), `register validator missing ${value}`);
    assert.ok(adminHtml.includes(`value=\"${value}\"`), `admin select missing ${value}`);
  }
  for (const invalid of ['friend', 'partner']) {
    assert.ok(!controller.includes(`'${invalid}'`), `admin controller still accepts invalid enum ${invalid}`);
    assert.ok(!validators.includes(`'${invalid}'`), `register validator still accepts invalid enum ${invalid}`);
    assert.ok(!adminHtml.includes(`value=\"${invalid}\"`), `admin select still offers invalid enum ${invalid}`);
  }
});
