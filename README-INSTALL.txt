MAINROADMAP2 – GAME STATIC ROUTE HOTFIX

WHY THIS IS NEEDED
The previous ZIP included a patch file but not an already-modified src/app.js. Copying/extracting the ZIP alone does not apply a .patch file, so test/gameStatic.test.js continued to fail.

INSTALL
1. Extract this ZIP into the MainRoadmap2 project root (merge folders).
2. From the project root run:

   node tools/install-game-static.mjs
   npm test

The installer is idempotent: it can be run more than once. It modifies only src/app.js and writes src/middleware/gameStatic.js. It does not touch SongShare, Spotify, service settings, or database data.

EXPECTED
- /games/roadtrip/ serves public/games/roadtrip/index.html
- /games/hockey/ serves its index.html if present
- /games/games.html remains protected by the existing protect middleware

If npm test still fails, send the output of:
   grep -n "gameStatic\|/games/games.html\|express.static(privatePagePath" src/app.js
