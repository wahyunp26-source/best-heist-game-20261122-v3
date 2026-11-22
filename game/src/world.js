// VELVET VAULT — the room: grid, collision, line of sight, paths, lasers.
// One World per level, built from that level's map in levels.js.

import { TILE, COLS, ROWS } from './config.js';

const SOLID = new Set(['#', 'T', 'P', 'B', 'F', 'V', 'S', 'L']);
const SIGHT_BLOCK = new Set(['#', 'V', 'F', 'B']);

export class World {
  constructor(def) {
    this.def = def;
    this.grid = def.map.map((row) => row.split(''));
    this.loot = null; // {tx, ty, taken}
    this.exit = null; // {tx, ty}
    this.safes = []; // {tx, ty, taken}
    this.laserGroups = []; // {tiles:[[tx,ty]...], phase, on}
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x];
        if (c === 'L') this.loot = { tx: x, ty: y, taken: false };
        if (c === 'E') this.exit = { tx: x, ty: y };
        if (c === 'S') this.safes.push({ tx: x, ty: y, taken: false });
      }
    }
    // Contiguous '=' runs in a row form one blinking laser beam.
    for (let y = 0; y < ROWS; y++) {
      let run = [];
      for (let x = 0; x <= COLS; x++) {
        if (x < COLS && this.grid[y][x] === '=') run.push([x, y]);
        else if (run.length) {
          this.laserGroups.push({ tiles: run, phase: (y * 1.7 + run[0][0] * 0.6) % 3.4 });
          run = [];
        }
      }
    }
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return this.grid[ty][tx];
  }
  isSolid(tx, ty) {
    return SOLID.has(this.tileAt(tx, ty));
  }
  blocksSight(tx, ty) {
    return SIGHT_BLOCK.has(this.tileAt(tx, ty));
  }
  isWalk(tx, ty) {
    const c = this.tileAt(tx, ty);
    return !SOLID.has(c);
  }
  tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  // Move a circle (x, y, radius) by (dx, dy), sliding along solid tiles.
  // The collision radius is 1px smaller than the drawn radius so a figure
  // hugging a wall corner slides past it instead of wedging on the corner.
  moveCircle(p, dx, dy) {
    const r = p.r - 1;
    let nx = p.x + dx;
    if (!this.circleHits(nx, p.y, r)) p.x = nx;
    let ny = p.y + dy;
    if (!this.circleHits(p.x, ny, r)) p.y = ny;
  }
  circleHits(x, y, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.isSolid(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  // Line of sight between two pixel points (walls block it).
  los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tx = Math.floor((ax + (bx - ax) * t) / TILE);
      const ty = Math.floor((ay + (by - ay) * t) / TILE);
      if (this.blocksSight(tx, ty)) return false;
    }
    return true;
  }

  // Breadth-first path over walkable tiles. goalTest(tx,ty) stops the search.
  // Returns an array of tile coords from start (exclusive) to goal (inclusive).
  bfsPath(sx, sy, goalTest, avoid = null) {
    const key = (x, y) => x + ',' + y;
    const prev = new Map();
    const q = [[sx, sy]];
    prev.set(key(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (goalTest(x, y)) {
        const path = [];
        let cur = [x, y];
        while (cur) {
          path.unshift(cur);
          cur = prev.get(key(cur[0], cur[1]));
        }
        return path.slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (prev.has(key(nx, ny))) continue;
        if (!this.isWalk(nx, ny)) continue;
        if (avoid && avoid.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]);
        q.push([nx, ny]);
      }
    }
    return null;
  }

  // Is the laser group on at game time t (seconds)? 2.2s on, 1.4s off.
  laserOn(group, t) {
    return ((t + group.phase) % 3.6) < 2.2;
  }
  thiefOnLaser(x, y, t) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (this.tileAt(tx, ty) !== '=') return null;
    for (const g of this.laserGroups) {
      if (g.tiles.some(([gx, gy]) => gx === tx && gy === ty)) {
        return this.laserOn(g, t) ? g : null;
      }
    }
    return null;
  }
}
