# Air Hockey demo

Place this folder at:

`public/games/hockey/`

The game is opened at:

`/games/hockey/` (assuming Express serves `public` as the static root).

## Included modes

- Solo: one player versus a basic CPU.
- 1 vs 1: two people on the same keyboard.
- Team match: 2v2 or 3v3 (4 or 6 people) on the same keyboard.

## Controls

- Solo: W/S or Up/Down.
- 1v1: Player 1 W/S, Player 2 Up/Down.
- 2v2 / 3v3:
  - Green team: W/S, E/D, T/G
  - Orange team: Up/Down, I/K, O/L
- Space pauses/resumes.

The game includes canvas physics, paddle collisions, wall bounces, scoring, target score selection, countdown, restart, and basic touch/drag controls.

## Important multiplayer note

The multiplayer modes in this demo are local same-device multiplayer. They do not yet connect separate browsers/devices over the network. Online multiplayer needs a Socket.IO room/server integration and authentication/room lifecycle in your existing backend.
