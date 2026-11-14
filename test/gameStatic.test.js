import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

test('game static middleware is mounted after the protected catalogue route', async () => {
  const appSource = await readFile(path.join(projectRoot, 'src/app.js'), 'utf8');
  const protectedCatalogueRoute = appSource.indexOf("app.get('/games/games.html', protect");
  const publicGameMount = appSource.indexOf("app.use('/games', createGameStaticMiddleware");

  assert.notEqual(protectedCatalogueRoute, -1, 'games catalogue must retain its authentication guard');
  assert.notEqual(publicGameMount, -1, 'public game bundles must have a dedicated static mount');
  assert.ok(protectedCatalogueRoute < publicGameMount, 'protected catalogue route must run before public game static files');
  assert.match(await readFile(path.join(projectRoot, 'src/middleware/gameStatic.js'), 'utf8'), /index:\s*'index\.html'/);

  await access(path.join(projectRoot, 'public/games/roadtrip/index.html'));
  await access(path.join(projectRoot, 'public/games/roadtrip/roadtrip.css'));
});
