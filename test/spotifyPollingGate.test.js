import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/songShare/songshare.js', import.meta.url), 'utf8');

test('Spotify status request includes HttpOnly session cookies', () => {
  const statusBlock = source.slice(source.indexOf("async function loadSpotifyStatus()"), source.indexOf("btnConnectSpotify?.addEventListener"));
  assert.match(statusBlock, /credentials:\s*'include'/);
  assert.match(statusBlock, /token !== 'cookie-session'/);
});

test('now-playing polling is started only after Spotify status reports a usable account', () => {
  const startupBlock = source.slice(source.indexOf('async function startup()'), source.indexOf('startup();', source.indexOf('async function startup()')));
  assert.match(startupBlock, /await loadSpotifyStatus\(\)/);
  assert.doesNotMatch(startupBlock, /setInterval\(loadMyNowPlaying/);
  const statusBlock = source.slice(source.indexOf("async function loadSpotifyStatus()"), source.indexOf("btnConnectSpotify?.addEventListener"));
  assert.match(statusBlock, /if \(data\.usable\)[\s\S]*?setNowPlayingPolling\(true\)/);
  assert.match(statusBlock, /if \(!data\.connected\)[\s\S]*?setNowPlayingPolling\(false\)/);
});

test('now-playing polling stops on authorization failure instead of repeating every five seconds', () => {
  const nowPlayingStart = source.indexOf('async function loadMyNowPlaying()');
  const nowPlayingBlock = source.slice(nowPlayingStart, source.indexOf('window.refreshSongShareNowPlaying = loadMyNowPlaying', nowPlayingStart));
  assert.match(nowPlayingBlock, /res\.status === 401 \|\| res\.status === 403/);
  assert.match(nowPlayingBlock, /clearInterval\(nowPlayingPollTimer\)/);
});

const statusHtml = await readFile(new URL('../public/spotifyStatus.html', import.meta.url), 'utf8');

test('Spotify status page uses HttpOnly cookies and polls only after a usable connection', () => {
  assert.match(statusHtml, /getSessionFetchOptions\(\)[\s\S]*?credentials:\s*'include'/);
  assert.match(statusHtml, /data\.connected && data\.usable[\s\S]*?setInterval\(fetchNowPlaying, 5000\)/);
  assert.doesNotMatch(statusHtml, /setInterval\(fetchNowPlaying, 5000\);\s*\}\);/);
});

test('cookie-only sessions are accepted by status and login-url requests', () => {
  const statusBlock = source.slice(source.indexOf('async function loadSpotifyStatus()'), source.indexOf('btnConnectSpotify?.addEventListener'));
  assert.doesNotMatch(statusBlock, /if\s*\(!token\)/);
  assert.match(statusBlock, /credentials:\s*'include'/);
  const loginStart = source.indexOf("btnConnectSpotify?.addEventListener");
  const loginEnd = source.indexOf('let lastTrackTitle', loginStart);
  const loginBlock = source.slice(loginStart, loginEnd);
  assert.match(loginBlock, /credentials:\s*'include'/);
  assert.match(loginBlock, /token !== 'cookie-session'/);
});

test('all now-playing fetches skip the cookie-session marker as a Bearer token', () => {
  const blocks = [
    source.slice(source.indexOf('async function loadMyNowPlaying()'), source.indexOf('let friendsActivityLoaded', source.indexOf('async function loadMyNowPlaying()'))),
    source.slice(source.indexOf('window.shareCurrentlyPlaying = async function'), source.indexOf('// 5. YOUTUBE SYNCED LYRICS PREVIEW VE COMPANION', source.indexOf('window.shareCurrentlyPlaying = async function'))),
    source.slice(source.indexOf('async function checkSpotifyConnection('), source.indexOf('function renderLyrics(', source.indexOf('async function checkSpotifyConnection(')))
  ];
  assert.equal(blocks.length, 3);
  for (const block of blocks) {
    assert.match(block, /fetch\('\/api\/spotify\/now-playing'/);
    assert.match(block, /credentials:\s*'include'/);
    assert.match(block, /token !== 'cookie-session'/);
  }
});
