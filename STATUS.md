# STATUS — VELVET VAULT: The Grand Getaway (best-heist-game-20261122-0559, v3)

## Entry

- Repo: https://github.com/wahyunp26-source/best-heist-game-20261122-v3
- Commit: `e5bcd0c8d3a66af27a23ac2b6115c37f3b717ec3` (branch `master` pushed to origin `main`). Repo PUBLIC. About set: description names make.fun + this bounty, homepage https://make.fun/bounty/best-heist-game-20261122-0559, topics makefun, ai-agents, bounties.
- Created 2026-11-22T07:55:07Z (after the 05:59:00Z open).
- Account: @yuerta. Payout wallet: wQUy3YoX5DoUSaAsXycrZT21NTih6BRwE6N4ossmy9S.
- NOT SUBMITTED (per brief — subjective entry, Wahyu decides after the preview).
- Competition: $50, top 10 x $5 (1st $12, 2nd $8, 3rd $6, 4th $5, 5th $4, 6th–10th $3). Closes 23 Nov 2026 00:59 WIB (17:59 UTC). Quota: 0/3 used. Leaderboard re-pulled 22 Nov ~15:15 WIB: **0 entries**.

## Game — what changed vs v2

VELVET VAULT: The Grand Getaway — top-down stealth heist, 3 levels (The Gallery, The Bank Vault, The Penthouse), each with its own warm palette and furniture: parquet + red carpet + paintings + pedestals + plants (Gallery); marble + vault door + gold stacks + columns + **blinking laser beams** (Bank, NEW); mahogany + crimson carpet + fireplace + bookshelves + bar (Penthouse). Thief "Vesper" crosses guarded rooms, grabs the main diamond ($12,000) + wall safes ($2,500) + cash bags ($1,500), reaches the green EXIT (locked until the diamond is taken) before the alarm hits 100%.

**v2 weak spots fixed:**
1. **Cover is mid-action now:** the thief holds the glowing diamond in his leading hand while a guard with a red "!" chases him at 61% alarm — no more static thief sitting mid-room.
2. **Richer characters:** bigger detailed figures with clear facing — fedora + domino mask + loot bag (swells with gold when carrying) for Vesper; navy uniforms, helmets, batons, gold buttons for guards; two-frame walk cycles with swinging legs and bob. Guards show "?" (suspicious) / "!" (alert) bubbles.
3. Kept v2's wins: warm palettes, furniture-filled rooms, readable raycast vision cones (yellow calm / orange suspicious / red alert), alarm meter, loot labels, guard AI patrol→suspicious→alert→search→return, cameras with sweeping cones + SPOTTED! banner, coin/smoke/sneak tools, keyboard + click-to-move, synthesized WebAudio sounds.

**New depth vs v2:** laser beams in the Bank Vault (blink 2.2s on / 1.4s off, crossing a live beam is +25 alarm); guards path with BFS between waypoints instead of straight lines; cameras on two levels; exit lock state shown in the HUD ("EXIT LOCKED — TAKE THE LOOT" / "EXIT OPEN — RUN!").

## Files (19, ~525,000 bytes)

- `main.ts` — Node 22 stdlib only; copies game/ + screenshots/ to /output, writes dossier.json via buildDossier from vendor/makefun-game.ts. Two runs byte-identical (verified with diff -r).
- `vendor/makefun-game.ts` — kit copy, byte-identical (sha256 dc671875...).
- `game/index.html` + `game/src/` (9 files, one job each): config, levels, world, thief, guards, cameras, audio, render, main.
- `LICENSE` — MIT, first line `SPDX-License-Identifier: MIT`.
- `README.md` — badges in slug form (rank + reward) + main badge.
- `.makefun/owner.json` — exactly `{"wallet":"wQUy3YoX5DoUSaAsXycrZT21NTih6BRwE6N4ossmy9S"}`.

## Screenshots (all JPEG 1280x720, each < 256 KiB)

- `1-cover.jpg` (85,926 B) — Gallery: thief holding the glowing diamond, guard with red "!" chasing, red alert cone, alarm 61%, LOOT $12,000, EXIT OPEN.
- `2-play.jpg` (109,139 B) — Bank Vault: thief sneaking at the vault door, guard suspicious ("?"), lasers live, diamond in the vault, alarm 36%.
- `3-alert.jpg` (109,022 B) — Bank Vault: alarm 81% red, guard alert ("!") chasing with a big red cone, thief with diamond, EXIT OPEN.
- `4-win.jpg` (59,256 B) — "THE GRAND GETAWAY!" win screen, loot $37,500, score 41,000, time 0:47.

## Playtests (real headless-Chromium, CDP-driven, Node stdlib only)

Full suite run TWICE, all 16 checks PASS both times, zero console/page errors:
- Boot to menu ✓; Enter starts level 1 ✓; keyboard D moves the thief ✓.
- GRAB: teleport next to the diamond + E → loot $12,000, carrying ✓.
- LOSE (alarm): alert guard + alarm 99.5% → caught at 100% ✓. LOSE (touch): alert guard touches Vesper → caught ✓. R retries the room ✓.
- WIN: autopilot clears all 3 levels twice — **55s both runs** (L1 @14s, L2 @38–39s, L3 @53s): final `win`, loot $37,500, score 41,000.
- Geometry validator (maps): all rows 32 chars, start/loot/exit/guard waypoints/cashbags on walkable tiles, BFS loot-adjacent + exit reachable on all 3 levels.

Bugs found and fixed during playtest:
1. Import bug: cameras.js imported `pointInCone` from config.js — it lives in guards.js (game would not boot).
2. Thief wedged on a wall corner: dominant-axis-only autopilot steering + exact-radius collision grazed tile (8,12)'s corner. Fix: diagonal steering + collision radius 1px smaller than drawn radius (also helps human players).
3. Guards stuck on furniture: straight-line patrol legs ran through plants/tables/vault walls (guard 1 sat at (14,2) for 80s — plant at (15,2)). Fix: guards now path with BFS between waypoints (patrol/search/return); L2 guard 3's leg through the vault wall redesigned to stay in the mid hall.
4. Autopilot stalled 5px outside grab range (stood on the tile next to the diamond, grab reaches 1.35 tiles). Fix: close-in steering within 2 tiles of the loot.
5. Stale input: stagePlay's `sneak` flag leaked into stageAlert and shrank guard cones. Fix: loadLevel resets all input.
6. Cover staging put the chasing guard across a wall row (no line of sight, suspicion decayed). Fix: guard placed in the same open room as the thief.
7. Test's own bug: alarm decays when calm, so a bare 99.5% never trips — the alarm test now pairs it with an alert guard (correct by design).

## main.ts / dossier

- `MAKEFUN_OUTPUT_DIR=/tmp/heist3-out1 node main.ts` — exit 0; two runs `diff -r` clean (deterministic).
- Output: game/ + screenshots/ + dossier.json (556,137 B).

## makefun check (dev kit, worktree, no transcripts)

`node cli/makefun.mjs check --kit . --repo <entry> --worktree`:
- PASS: competition_open, snapshot (19 files), license_osi, entrypoint (4 passed)
- FAIL: transcripts_present (expected — no transcripts; parent bundles the session at submit time; every other transcript check skips on that)
- At submission (checked after push): repo_public, repo_owner, commit_in_repo now satisfiable (public repo, owner.json committed, commit pushed); repo_created_after_open satisfiable (created 07:55:07Z > 05:59:00Z open); duplicate_snapshot is the site's check at submit.
- "not ready: fix transcripts_present, then check again" — the only open item, owned by the parent at submit time.

## Authorship note

v2 was studied from its STATUS.md and its cover screenshot only. v2's source code was not opened or copied: every line of this entry was written fresh in this session. The kit's vendor/makefun-game.ts is a kit copy, byte-identical, as usual. The playtest driver (/tmp/heist3-test.mjs) and the CDP probe scripts are scratch tooling in /tmp, not part of the entry.

## Self-evaluation — can this credibly reach top 10?

YES, credibly — stronger than v2. The cover is the fix that matters most: it is a dramatic mid-action frame (loot in hand, "!" chase, hot alarm) where v2's was a static room, and the judge sees the cover largest. The game is complete and genuinely playable (verified win + both lose paths, not a staged mock), with one more mechanic than v2 (lasers), BFS-patrolling guards, and a 9-file one-job-each source split with descriptive names. The $50 prize splits 10 ways and the board was still 0 entries at ~15:15 WIB, so a complete, good-looking entry in a 12-hour bounty has a realistic top-10 path. Weak spots, honestly: characters are still top-down/three-quarter sprites (no full animation); the wall rows read as heavy black bands at thumbnail size; the cameras are small and easy to miss in the cover. None of those blocks a top-10 finish. This version is worth showing to Wahyu.
