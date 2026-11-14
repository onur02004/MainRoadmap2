import fs from 'node:fs/promises';
import path from 'node:path';

const appPath = path.resolve('src/app.js');
const middlewarePath = path.resolve('src/middleware/gameStatic.js');

const middleware = `import express from 'express';
import path from 'path';

/**
 * Serves playable game bundles, including directory index.html files.
 * The protected /games/games.html route must be registered before this mount.
 */
export function createGameStaticMiddleware(publicDirectory, options = {}) {
  return express.static(path.join(publicDirectory, 'games'), {
    etag: true,
    index: 'index.html',
    ...options
  });
}
`;

let app;
try {
  app = await fs.readFile(appPath, 'utf8');
} catch {
  console.error('Cannot find src/app.js. Run this installer from the MainRoadmap2 project root.');
  process.exit(1);
}

const protectedRoute = "app.get('/games/games.html', protect";
const mount = "app.use('/games', createGameStaticMiddleware";
const genericStatic = 'app.use(express.static(privatePagePath';

if (!app.includes(protectedRoute)) {
  console.error('Could not find the protected /games/games.html route in src/app.js. No files were changed.');
  process.exit(1);
}
if (!app.includes(genericStatic)) {
  console.error('Could not find the generic public static mount in src/app.js. No files were changed.');
  process.exit(1);
}

if (!app.includes("from './middleware/gameStatic.js'")) {
  const importAnchor = /import \{ createRateLimit \} from '\.\/middleware\/rateLimit\.js';/;
  if (!importAnchor.test(app)) {
    console.error('Could not find a safe import insertion point in src/app.js. No files were changed.');
    process.exit(1);
  }
  app = app.replace(importAnchor, match => `${match}\nimport { createGameStaticMiddleware } from './middleware/gameStatic.js';`);
}

if (!app.includes(mount)) {
  const routeIndex = app.indexOf(protectedRoute);
  const staticIndex = app.indexOf(genericStatic);
  if (routeIndex < 0 || staticIndex < 0 || routeIndex >= staticIndex) {
    console.error('Unexpected route order in src/app.js. No files were changed.');
    process.exit(1);
  }
  const mountBlock = `// Playable game bundles are public static assets. The games catalogue above stays protected.\napp.use('/games', createGameStaticMiddleware(privatePagePath, {\n  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0\n}));\n\n`;
  app = app.replace(genericStatic, `${mountBlock}${genericStatic}`);
}

await fs.mkdir(path.dirname(middlewarePath), { recursive: true });
await fs.writeFile(middlewarePath, middleware, 'utf8');
await fs.writeFile(appPath, app, 'utf8');
console.log('Game static route installed.');
console.log('Protected /games/games.html route remains before the public game asset mount.');
console.log('Directory URLs such as /games/roadtrip/ can now resolve to index.html.');
