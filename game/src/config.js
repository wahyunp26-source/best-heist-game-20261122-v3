// VELVET VAULT: The Grand Getaway — shared constants and palettes.
// Every number here is tuned for a 1280x720 canvas: an 80px HUD bar on top
// and a 32x16 tile playfield (40px tiles) below it.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 16;
export const HUD_H = 80;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const PLAY_W = COLS * TILE; // 1280
export const PLAY_H = ROWS * TILE; // 640

// Movement + senses.
export const THIEF_SPEED = 155; // px per second, walking
export const THIEF_SNEAK = 88; // px per second, Shift held
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 178;
export const GUARD_CONE_RANGE = 175;
export const GUARD_CONE_HALF = 0.56; // radians (~32 deg)
export const CAMERA_CONE_RANGE = 195;
export const CAMERA_CONE_HALF = 0.44;
export const SNEAK_CONE_SHRINK = 0.62; // cones see a sneaking thief much later
export const SUSPICION_RATE = 1.7; // per second inside a cone
export const SUSPICION_DECAY = 0.85;
export const ALARM_CALM_DECAY = 2.2;
export const ALARM_SEEN_RATE = 7; // per second while any guard is alert
export const ALARM_SPOTTED_RATE = 9; // per second while a camera sees you
export const ALARM_SUSPICIOUS_RATE = 3.5;
export const CATCH_DIST = 30; // an alert guard touching you ends the run

// Tools.
export const TOOL_COINS = 3;
export const TOOL_SMOKE = 2;
export const SMOKE_RADIUS = 72;
export const SMOKE_SECONDS = 4.5;

// Loot values (dollars).
export const LOOT_MAIN = 12000;
export const LOOT_SAFE = 2500;
export const LOOT_CASHBAG = 1500;

// Per-level look. Warm rooms only: no dark empty floors anywhere.
export const PALETTES = [
  {
    name: 'The Gallery',
    sub: 'Level 1 — slip past the night watch',
    floorA: '#8a6a42',
    floorB: '#7d5f3a',
    plank: '#6e5233',
    carpet: '#7e1f2a',
    carpetEdge: '#c9a227',
    wall: '#2e2620',
    wallTop: '#4a3b2c',
    glow: '#ffd98a',
  },
  {
    name: 'The Bank Vault',
    sub: 'Level 2 — crack the vault, dodge the lasers',
    floorA: '#b8b4ac',
    floorB: '#a9a59d',
    plank: '#8f8b83',
    carpet: '#274a6b',
    carpetEdge: '#c9a227',
    wall: '#33302c',
    wallTop: '#57534c',
    glow: '#ffe9a8',
  },
  {
    name: 'The Penthouse',
    sub: 'Level 3 — the grand getaway',
    floorA: '#6b4a2f',
    floorB: '#5f4028',
    plank: '#4e331f',
    carpet: '#5e1220',
    carpetEdge: '#c9a227',
    wall: '#2b2019',
    wallTop: '#463322',
    glow: '#ffb36b',
  },
];

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic pseudo-random from two integers (stable decor per tile).
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
