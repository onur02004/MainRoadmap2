 .gitignore                                   |   5 [32m+[m[31m-[m
 package-lock.json                            | 253 [32m+++++++++++++++++++++++[m
 package.json                                 |   2 [32m+[m
 public/account.html                          |   6 [32m+[m
 public/content/covers/hokey.png              | Bin [31m0[m -> [32m767426[m bytes
 public/content/covers/weinguesser.png        | Bin [31m0[m -> [32m448582[m bytes
 public/games/games.css                       | 102 [32m++++++++[m[31m--[m
 public/games/games.html                      | 202 [32m+++++++++++[m[31m--------[m
 public/games/games.js                        | 241 [32m+++++++++++++++++[m[31m-----[m
 public/games/hockey/README.md                |  30 [32m+++[m
 public/games/hockey/hockey.css               | 126 [32m++++++++++++[m
 public/games/hockey/hockey.js                | 518 [32m+++++++++++++++++++++++++++++++++++++++++++++++[m
 public/games/hockey/index.html               | 109 [32m++++++++++[m
 public/games/hokeyDemo.html                  |   0
 public/games/launcher/games.css              |  18 [32m++[m
 public/games/launcher/games.js               | 238 [32m++++++++++++++++++++++[m
 public/games/launcher/index.html             |  44 [32m++++[m
 public/games/launcher/launcher.css           |   1 [32m+[m
 public/games/launcher/launcher.js            |  67 [32m+++++++[m
 public/games/weinguesser/app.js              | 686 [32m+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++[m
 public/games/weinguesser/data/locations.json | 451 [32m+++++++++++++++++++++++++++++++++++++++++[m
 public/games/weinguesser/index.html          | 167 [32m++++++++++++++++[m
 public/games/weinguesser/styles.css          | 449 [32m+++++++++++++++++++++++++++++++++++++++++[m
 public/index.html                            |   7 [32m+[m
 public/js/socket/game-presence.js            |  13 [32m++[m
 public/js/socket/presence-client.js          | 139 [32m+++++++++++++[m
 public/js/socket/presence-ui.css             | 175 [32m++++++++++++++++[m
 public/js/socket/presence-ui.js              | 150 [32m++++++++++++++[m
 public/js/socket/socket-client.js            |  92 [32m+++++++++[m
 public/songShare/songShare.html              |   4 [32m+[m
 src/app.js                                   |  14 [32m++[m
 src/config/db.js                             |  19 [32m+[m[31m-[m
 src/controllers/gameController.js            |  47 [32m+++[m[31m--[m
 src/routes/gameRoutes.js                     |   1 [31m-[m
 src/server.js                                |  27 [32m++[m[31m-[m
 src/sockets/devices/deviceHandlers.js        |   3 [32m+[m
 src/sockets/games/gameHandlers.js            |  52 [32m+++++[m
 src/sockets/games/hockeyHandlers.js          | 224 [32m+++++++++++++++++++++[m
 src/sockets/index.js                         |  50 [32m+++++[m
 src/sockets/presence/presenceHandlers.js     |  85 [32m++++++++[m
 src/sockets/presence/presenceManager.js      | 161 [32m+++++++++++++++[m
 src/sockets/socketAuth.js                    |  49 [32m+++++[m
 42 files changed, 4853 insertions(+), 174 deletions(-)
