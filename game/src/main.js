// VELVET VAULT: The Grand Getaway — game orchestration.
// States: menu -> playing -> levelclear -> playing ... -> win, or caught.
// Owns the alarm, the loot, the tools, and the autopilot the playtests use
// to prove the game can actually be won.

import {
  TILE, HUD_H, VIEW_W, VIEW_H, COLS, ROWS,
  ALARM_CALM_DECAY, ALARM_SEEN_RATE, ALARM_SPOTTED_RATE,
  ALARM_SUSPICIOUS_RATE, CATCH_DIST,
  LOOT_MAIN, LOOT_SAFE, LOOT_CASHBAG,
  clamp, dist,
} from './config.js';
import { LEVELS } from './levels.js';
import { World } from './world.js';
import { Thief } from './thief.js';
import { Guard } from './guards.js';
import { Camera } from './cameras.js';
import { Sfx } from './audio.js';
import { Render } from './render.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sfx = new Sfx();
    this.render = new Render();
    this.input = {
      up: false, down: false, left: false, right: false,
      sneak: false, clickTarget: null,
    };
    this.state = 'menu';
    this.levelIndex = 0;
    this.time = 0; // total run time (playing only)
    this.loot = 0;
    this.score = 0;
    this.roomLoot = 0;
    this.alarm = 0;
    this.caughtReason = '';
    this.smokes = [];
    this.thrownCoin = null;
    this.auto = false; // autopilot for the self-test
    this.autoTimer = 0;
    this.danger = new Set();
    this.laserZapAt = -10;
    this.keys = {};
    this.loadLevel(0);
    this.bindInput();
  }

  get def() { return LEVELS[this.levelIndex]; }
  get world() { return this._world; }

  loadLevel(i) {
    this.levelIndex = i;
    const def = LEVELS[i];
    this._world = new World(def);
    const c = this._world.tileCenter(def.start[0], def.start[1]);
    this.thief = new Thief(c.x, c.y);
    this.guards = def.guards.map((g) => new Guard(g));
    this.cameras = def.cameras.map((c2) => new Camera(c2));
    this.cashbags = def.cashbags.map(([tx, ty]) => {
      const p = this._world.tileCenter(tx, ty);
      return { x: p.x, y: p.y, taken: false };
    });
    this.smokes = [];
    this.thrownCoin = null;
    this.alarm = 0;
    this.roomLoot = 0;
    this.danger = new Set();
    // Fresh input: no stale keys (e.g. sneak) leaking between stages/runs.
    this.input = { up: false, down: false, left: false, right: false, sneak: false, clickTarget: null };
  }

  startRun() {
    this.time = 0;
    this.loot = 0;
    this.score = 0;
    this.loadLevel(0);
    this.state = 'playing';
  }

  bindInput() {
    const keyMap = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sneak', ShiftRight: 'sneak',
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.sfx.ensure();
      const k = keyMap[e.code];
      if (k) { this.input[k] = true; e.preventDefault(); }
      if (e.code === 'KeyE') this.grab();
      if (e.code === 'KeyC') this.tossCoin();
      if (e.code === 'KeyQ') this.dropSmoke();
      if (e.code === 'KeyM') this.sfx.toggleMute();
      if (e.code === 'Enter') {
        if (this.state === 'menu') this.startRun();
        else if (this.state === 'levelclear') this.nextLevel();
      }
      if (e.code === 'KeyR') {
        if (this.state === 'caught') { this.loadLevel(this.levelIndex); this.state = 'playing'; }
        else if (this.state === 'win') this.startRun();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = keyMap[e.code];
      if (k) this.input[k] = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (VIEW_W / rect.width);
      const y = (e.clientY - rect.top) * (VIEW_H / rect.height) - HUD_H;
      if (y < 0) return;
      this.sfx.ensure();
      this.input.clickTarget = { x, y };
    });
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'win';
      this.score += 2000;
      this.sfx.win();
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.state = 'playing';
  }

  // Grab whatever loot is within reach: the diamond first, then safes, then bags.
  grab() {
    if (this.state !== 'playing') return;
    const t = this.thief;
    const w = this._world;
    const near = (tx, ty, range) => {
      const c = w.tileCenter(tx, ty);
      return dist(t.x, t.y, c.x, c.y) < range;
    };
    if (!w.loot.taken && near(w.loot.tx, w.loot.ty, TILE * 1.35)) {
      w.loot.taken = true;
      t.carrying = true;
      this.addLoot(LOOT_MAIN);
      this.sfx.grab();
      return;
    }
    for (const s of w.safes) {
      if (!s.taken && near(s.tx, s.ty, TILE * 1.35)) {
        s.taken = true;
        this.addLoot(LOOT_SAFE);
        this.sfx.grab();
        return;
      }
    }
    for (const b of this.cashbags) {
      if (!b.taken && dist(t.x, t.y, b.x, b.y) < 30) {
        b.taken = true;
        this.addLoot(LOOT_CASHBAG);
        this.sfx.grab();
        return;
      }
    }
  }

  addLoot(v) {
    this.loot += v;
    this.score += v;
    this.roomLoot += v;
  }

  tossCoin() {
    if (this.state !== 'playing' || this.thief.coins <= 0 || this.thrownCoin) return;
    this.thief.coins -= 1;
    const t = this.thief;
    const x1 = t.x + Math.cos(t.facing) * TILE * 3;
    const y1 = t.y + Math.sin(t.facing) * TILE * 3;
    this.thrownCoin = { x0: t.x, y0: t.y, x1, y1, left: 0.55 };
    this.sfx.coin();
  }

  dropSmoke() {
    if (this.state !== 'playing' || this.thief.smokes <= 0) return;
    this.thief.smokes -= 1;
    this.smokes.push({ x: this.thief.x, y: this.thief.y, r: 72, left: 4.5 });
    this.sfx.smoke();
  }

  caught(reason) {
    if (this.state !== 'playing') return;
    this.state = 'caught';
    this.caughtReason = reason;
    this.auto = false;
    this.sfx.caught();
  }

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    if (this.auto) this.autopilot(dt);

    const t = this.thief;
    t.update(dt, this.input, this._world, this.sfx);
    for (const g of this.guards) g.update(dt, this._world, t, this.smokes, this.sfx);
    for (const c of this.cameras) c.update(dt, this.time, this._world, t, this.smokes);

    // Smoke clouds fade.
    for (const s of this.smokes) s.left -= dt;
    this.smokes = this.smokes.filter((s) => s.left > 0);

    // Thrown coin: arc, then guards nearby go to investigate.
    if (this.thrownCoin) {
      this.thrownCoin.left -= dt;
      if (this.thrownCoin.left <= 0) {
        const { x1, y1 } = this.thrownCoin;
        this.thrownCoin = null;
        for (const g of this.guards) {
          if (dist(g.x, g.y, x1, y1) < 240 && g.state !== 'alert') {
            g.state = 'search';
            g.searchTimer = 0;
            g.lastSeen = { x: x1, y: y1 };
            g.suspicion = Math.max(g.suspicion, 0.5);
          }
        }
      }
    }

    // Lasers: crossing a live beam spikes the alarm.
    const laser = this._world.thiefOnLaser(t.x, t.y, this.time);
    if (laser && this.time - this.laserZapAt > 1) {
      this.laserZapAt = this.time;
      this.alarm = clamp(this.alarm + 25, 0, 100);
      this.sfx.zap();
    }

    // Alarm: rises with danger, falls when calm.
    const anyAlert = this.guards.some((g) => g.state === 'alert');
    const anyCamera = this.cameras.some((c) => c.seeing);
    const anySus = this.guards.some((g) => g.state === 'suspicious' || g.suspicion > 0.25);
    if (anyAlert) this.alarm += ALARM_SEEN_RATE * dt;
    else if (anyCamera) this.alarm += ALARM_SPOTTED_RATE * dt;
    else if (anySus) this.alarm += ALARM_SUSPICIOUS_RATE * dt;
    else this.alarm -= ALARM_CALM_DECAY * dt;
    this.alarm = clamp(this.alarm, 0, 100);
    if (this.alarm >= 100) {
      this.caught('The alarm hit 100% — the building locked down.');
      return;
    }

    // An alert guard touching Vesper ends the run.
    for (const g of this.guards) {
      if (g.state === 'alert' && dist(g.x, g.y, t.x, t.y) < CATCH_DIST) {
        this.caught('A guard grabbed Vesper by the collar.');
        return;
      }
    }

    // Exit opens once the diamond is taken; stepping through clears the room.
    const et = this._world.tileCenter(this._world.exit.tx, this._world.exit.ty);
    if (this._world.loot.taken && dist(t.x, t.y, et.x, et.y) < 26) {
      this.score += 500;
      this.state = 'levelclear';
      this.auto = false;
      this.sfx.levelClear();
    }
  }

  // --- Autopilot: proves the game is winnable. Sneaks everywhere, waits
  // out cones, retreats when spotted, uses smoke when a chase closes in.
  autopilot(dt) {
    this.autoTimer -= dt;
    const t = this.thief;
    const w = this._world;
    const tx = Math.floor(t.x / TILE), ty = Math.floor(t.y / TILE);
    const key = (x, y) => x + ',' + y;

    if (this.autoTimer <= 0) {
      this.autoTimer = 0.25;
      this.danger = new Set();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!w.isWalk(x, y)) continue;
          const c = w.tileCenter(x, y);
          let hot = false;
          for (const g of this.guards) {
            const range = 175 * 0.62;
            if (Math.hypot(c.x - g.x, c.y - g.y) > range) continue;
            const ang = Math.atan2(c.y - g.y, c.x - g.x);
            let d = ang - g.facing;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < 0.56 && w.los(g.x, g.y, c.x, c.y)) { hot = true; break; }
          }
          if (!hot) {
            for (const cam of this.cameras) {
              if (Math.hypot(c.x - cam.x, c.y - cam.y) > 195) continue;
              const ang = Math.atan2(c.y - cam.y, c.x - cam.x);
              let d = ang - cam.angle;
              while (d > Math.PI) d -= Math.PI * 2;
              while (d < -Math.PI) d += Math.PI * 2;
              if (Math.abs(d) < 0.44 && w.los(cam.x, cam.y, c.x, c.y)) { hot = true; break; }
            }
          }
          if (!hot && w.tileAt(x, y) === '=' && w.thiefOnLaser(c.x, c.y, this.time)) hot = true;
          if (hot) this.danger.add(key(x, y));
        }
      }
    }

    // Panic: a chase closing in -> smoke and run.
    const chaser = this.guards.find((g) => g.state === 'alert' && dist(g.x, g.y, t.x, t.y) < 140);
    if (chaser && t.smokes > 0 && this.smokes.length === 0) this.dropSmoke();

    const inDanger = this.danger.has(key(tx, ty));
    let goal = null; // pixel target
    const lootC = w.tileCenter(w.loot.tx, w.loot.ty);
    if (!w.loot.taken && dist(t.x, t.y, lootC.x, lootC.y) < TILE * 2) {
      // Close in: standing on the tile next to the diamond is not close
      // enough — the grab only reaches 1.35 tiles, so walk right up to it.
      goal = lootC;
    } else if (inDanger) {
      // Retreat to the nearest safe tile.
      const path = w.bfsPath(tx, ty, (x, y) => !this.danger.has(key(x, y)) && (x !== tx || y !== ty));
      if (path && path.length) {
        const c = w.tileCenter(path[0][0], path[0][1]);
        goal = c;
      }
    } else {
      const lootGoal = !w.loot.taken
        ? (x, y) => Math.abs(x - w.loot.tx) + Math.abs(y - w.loot.ty) === 1
        : null;
      const exitGoal = (x, y) => x === w.exit.tx && y === w.exit.ty;
      const path = w.bfsPath(tx, ty, lootGoal || exitGoal, this.danger);
      if (path && path.length) {
        const c = w.tileCenter(path[0][0], path[0][1]);
        goal = c;
      } else if (!lootGoal) {
        // Exit blocked by a sweeping cone: wait for it to pass.
        goal = null;
      } else {
        // Loot approach blocked: wait near the loot for a gap.
        goal = null;
      }
    }

    // Steer toward the goal with the keys; always sneak. Both axes at once:
    // dominant-axis-only steering wedges the thief on wall corners.
    this.input.up = this.input.down = this.input.left = this.input.right = false;
    this.input.sneak = true;
    this.input.clickTarget = null;
    if (goal) {
      const dx = goal.x - t.x, dy = goal.y - t.y;
      if (Math.abs(dx) > 6) this.input[dx > 0 ? 'right' : 'left'] = true;
      if (Math.abs(dy) > 6) this.input[dy > 0 ? 'down' : 'up'] = true;
    }
    // Grab the moment we are in reach.
    if (!w.loot.taken) {
      const c = w.tileCenter(w.loot.tx, w.loot.ty);
      if (dist(t.x, t.y, c.x, c.y) < TILE * 1.35) this.grab();
    }
    for (const b of this.cashbags) {
      if (!b.taken && dist(t.x, t.y, b.x, b.y) < 30) this.grab();
    }
  }

  // --- Staging helpers for the screenshots (real game states, no compositing).
  stageCover() {
    // Diamond in hand, a guard mid-chase with "!", alarm already hot.
    this.startRun();
    const w = this._world;
    const c = w.tileCenter(w.loot.tx, w.loot.ty);
    this.thief.x = c.x - TILE;
    this.thief.y = c.y + TILE / 2;
    this.thief.facing = Math.PI / 4;
    this.grab();
    const g = this.guards[0];
    // Same open room as the thief (row 4/5): a wall row between them would
    // block the guard's line of sight and the chase would never read.
    g.x = this.thief.x + 130;
    g.y = this.thief.y - 10;
    g.state = 'alert';
    g.suspicion = 1;
    g.facing = Math.atan2(this.thief.y - g.y, this.thief.x - g.x);
    g.lastSeen = { x: this.thief.x, y: this.thief.y };
    this.alarm = 58;
    this.loot = 12000;
    this.score = 12000;
    this.time = 48;
  }
  stagePlay() {
    // Level 2: sneaking past the vault while a guard goes suspicious ("?").
    this.startRun();
    this.loadLevel(1);
    this.state = 'playing';
    this.thief.x = 15 * TILE + TILE / 2;
    this.thief.y = 9 * TILE + TILE / 2;
    this.thief.facing = -Math.PI / 2;
    this.input.sneak = true;
    const g = this.guards[2];
    g.x = 10 * TILE + TILE / 2;
    g.y = 9 * TILE + TILE / 2;
    g.state = 'suspicious';
    g.suspicion = 0.9; // decays while the thief stays out of the cone; "?" holds
    g.facing = Math.atan2(this.thief.y - g.y, this.thief.x - g.x);
    this.alarm = 34;
    this.time = 72;
  }
  stageAlert() {
    // Level 2: alarm 78%, guard chasing, camera about to spot.
    this.startRun();
    this.loadLevel(1);
    this.state = 'playing';
    this.thief.x = 20 * TILE + TILE / 2;
    this.thief.y = 8 * TILE + TILE / 2;
    this.thief.facing = Math.PI;
    const w = this._world;
    w.loot.taken = true;
    this.thief.carrying = true;
    this.loot = 12000;
    this.score = 13500;
    const g = this.guards[2];
    g.x = this.thief.x - 150;
    g.y = this.thief.y + 40;
    g.state = 'alert';
    g.suspicion = 1;
    g.facing = Math.atan2(this.thief.y - g.y, this.thief.x - g.x);
    g.lastSeen = { x: this.thief.x, y: this.thief.y };
    this.alarm = 78;
    this.time = 96;
  }

  frame(now) {
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000 || 0.016);
    this._last = now;
    this.update(dt);
    this.render.draw(this.ctx, this, this.time);
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__heist = {
  game,
  version: 'v3',
  get state() { return game.state; },
  get level() { return game.levelIndex; },
  get alarm() { return game.alarm; },
  get loot() { return game.loot; },
  get score() { return game.score; },
  start: (n = 0) => { game.loadLevel(n); game.state = 'playing'; },
  startRun: () => game.startRun(),
  teleport: (tx, ty) => {
    const c = game.world.tileCenter(tx, ty);
    game.thief.x = c.x;
    game.thief.y = c.y;
  },
  grab: () => game.grab(),
  setAlarm: (v) => { game.alarm = v; },
  setAuto: (v) => { game.auto = !!v; },
  forceAlert: (i = 0) => {
    const g = game.guards[i];
    g.state = 'alert';
    g.suspicion = 1;
    g.lastSeen = { x: game.thief.x, y: game.thief.y };
  },
  forceSuspicious: (i = 0, s = 0.6) => {
    const g = game.guards[i];
    g.state = 'suspicious';
    g.suspicion = s;
    g.lastSeen = { x: game.thief.x, y: game.thief.y };
  },
  stageCover: () => game.stageCover(),
  stagePlay: () => game.stagePlay(),
  stageAlert: () => game.stageAlert(),
  snapshot: () => ({
    state: game.state,
    level: game.levelIndex,
    alarm: Math.round(game.alarm),
    loot: game.loot,
    score: game.score,
    time: Math.round(game.time),
    thief: { x: Math.round(game.thief.x), y: Math.round(game.thief.y), carrying: game.thief.carrying },
    guards: game.guards.map((g) => ({ state: g.state, suspicion: +g.suspicion.toFixed(2) })),
    cameras: game.cameras.map((c) => ({ seeing: c.seeing })),
  }),
};

function loop(now) {
  game.frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
