# VELVET VAULT — The Grand Getaway

[![Rank](https://make.fun/badge/best-heist-game-20261122-0559/wahyunp26-source/best-heist-game-20261122-v3/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![Reward](https://make.fun/badge/best-heist-game-20261122-0559/wahyunp26-source/best-heist-game-20261122-v3/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A complete top-down stealth heist game built for the [make.fun best-heist-game bounty](https://make.fun/bounty/best-heist-game-20261122-0559). Play as Vesper, the thief in the fedora: slip through three warm, furniture-filled rooms — the Gallery, the Bank Vault, the Penthouse — grab the diamond, crack the safes, and reach the exit before the alarm hits 100%.

## How to play

- **WASD / Arrows** — move, **Shift** — sneak (slower, harder to spot)
- **E** — grab loot, **C** — toss a coin to distract a guard, **Q** — smoke bomb
- **Click** — walk there, **M** — mute, **Enter** — start / next room, **R** — retry

Guards patrol, get suspicious, chase, search, and return. Cameras sweep their cones. The Bank Vault adds blinking laser beams. The alarm rises when you are seen and falls when you stay hidden — at 100% the building locks down.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network requests, no build step — all art is drawn in code and all sound is synthesized with WebAudio.

## Layout

- `main.ts` — the hand-in program (Node 22 stdlib only): copies `game/` + `screenshots/` to `/output` and writes `dossier.json` via the kit's `vendor/makefun-game.ts`.
- `game/src/config.js` — constants, palettes, helpers
- `game/src/levels.js` — the three rooms (maps, patrols, cameras, loot)
- `game/src/world.js` — grid, collision, line of sight, pathfinding, lasers
- `game/src/thief.js` — Vesper: movement, walk cycle, detailed figure
- `game/src/guards.js` — the night watch: patrol → suspicious → alert → search → return
- `game/src/cameras.js` — sweeping wall cameras
- `game/src/audio.js` — synthesized sound effects
- `game/src/render.js` — floors, furniture, cones, HUD, menus
- `game/src/main.js` — game states, tools, alarm, autopilot, debug hooks
- `screenshots/` — real renders of the game in headless Chromium
