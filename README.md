# Shadow Protocol

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/hudobeld/shadow-protocol/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/hudobeld/shadow-protocol/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game for [make.fun's best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759).

You are an agent inside a guarded facility. Stay out of the guards' yellow vision cones, grab all 3 intel chips, then reach the green EXIT — unseen. Three floors, more guards and faster patrols on each one.

## How it plays

- **WASD / arrows** — move. **SHIFT** — sneak: slower, harder to spot, silent.
- **Vision cones** — a guard who sees you fills the suspicion bar. Closer and more centred means faster. At full suspicion the alarm sounds and every guard chases you.
- **Cover** — walls and crates block sight. Dark floor is shadow: detection there is halved.
- **Noise** — walking close to a guard is heard, even out of sight. Sneaking is silent.
- **Second chances** — break line of sight for a few seconds and the alarm dies down. Get caught 3 times on a floor and the run ends.

## Run it

No build step, no network. Serve `game/` with any static server and open it in a desktop browser:

```
cd game && python3 -m http.server
```

then open http://localhost:8000. The screenshots in `screenshots/` are deterministic scenes rendered by the game's own code (`?shot=start|play|alert|end`).

## Layout

- `game/index.html` — page and canvas
- `game/src/config.js` — constants and the three levels
- `game/src/world.js` — levels, guards, vision, suspicion, alarm
- `game/src/render.js` — all drawing: floor, cones, HUD, screens
- `game/src/shots.js` — the autopilot that stages the screenshots
- `game/src/input.js`, `game/src/random.js` — keyboard input, seeded RNG
- `game/src/main.js` — game loop and screens
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
