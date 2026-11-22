// VELVET VAULT — the night watch. Uniformed guards with helmets, batons and
// flashlight cones. State machine:
//   patrol -> suspicious (saw something) -> alert (chase) -> search -> return
// A guard's cone is raycast against the walls, so cover really is cover.

import {
  TILE, GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, GUARD_CONE_RANGE,
  GUARD_CONE_HALF, SNEAK_CONE_SHRINK, SUSPICION_RATE, SUSPICION_DECAY,
  angleDiff, clamp, dist,
} from './config.js';

// Raycast a vision cone against the walls; returns the polygon points.
export function conePolygon(world, x, y, angle, half, range) {
  const pts = [[x, y]];
  const rays = 26;
  for (let i = 0; i <= rays; i++) {
    const a = angle - half + (2 * half * i) / rays;
    let r = range;
    for (let d = 8; d <= range; d += 8) {
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (world.blocksSight(Math.floor(px / TILE), Math.floor(py / TILE))) {
        r = d;
        break;
      }
    }
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}

export function pointInCone(world, ox, oy, angle, half, range, tx, ty) {
  const d = dist(ox, oy, tx, ty);
  if (d > range) return false;
  if (Math.abs(angleDiff(Math.atan2(ty - oy, tx - ox), angle)) > half) return false;
  return world.los(ox, oy, tx, ty);
}

export class Guard {
  constructor(def) {
    this.way = def.way.map(([tx, ty]) => ({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
    }));
    this.speed = def.speed || GUARD_PATROL_SPEED;
    this.x = this.way[0].x;
    this.y = this.way[0].y;
    this.r = 15;
    this.facing = 0;
    this.wayIdx = 1;
    this.state = 'patrol'; // patrol | suspicious | alert | search | return
    this.suspicion = 0;
    this.lastSeen = null;
    this.loseTimer = 0;
    this.searchTimer = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.justAlerted = false; // main plays the alarm sting once
    this.path = []; // pixel waypoints for BFS movement (patrol/search/return)
    this.pathGoal = null; // "x,y" of the tile the path leads to
    this.pathTimer = 0;
  }

  // Can this guard see the thief right now? Smoke clouds block sight.
  canSee(world, thief, smokes) {
    const range = GUARD_CONE_RANGE * (thief.sneaking ? SNEAK_CONE_SHRINK : 1);
    if (!pointInCone(world, this.x, this.y, this.facing, GUARD_CONE_HALF, range, thief.x, thief.y)) {
      return false;
    }
    for (const s of smokes) {
      if (dist(s.x, s.y, thief.x, thief.y) < s.r) return false;
      // A smoke cloud between guard and thief blocks the line of sight.
      const mx = (this.x + thief.x) / 2, my = (this.y + thief.y) / 2;
      if (dist(s.x, s.y, mx, my) < s.r * 0.7) return false;
    }
    return true;
  }

  update(dt, world, thief, smokes, sfx) {
    const sees = this.canSee(world, thief, smokes);
    this.justAlerted = false;
    if (sees) {
      this.lastSeen = { x: thief.x, y: thief.y };
      this.loseTimer = 0;
      const d = dist(this.x, this.y, thief.x, thief.y);
      const rate = SUSPICION_RATE * (1.6 - (d / GUARD_CONE_RANGE) * 0.8);
      if (this.state !== 'alert') {
        const before = this.suspicion;
        this.suspicion = clamp(this.suspicion + rate * dt, 0, 1);
        if (before < 0.45 && this.suspicion >= 0.45 && sfx) sfx.suspicious();
        if (this.suspicion >= 1) {
          this.state = 'alert';
          this.justAlerted = true;
          if (sfx) sfx.alert();
        } else if (this.suspicion > 0.25) {
          this.state = 'suspicious';
        }
      }
    } else {
      this.suspicion = clamp(this.suspicion - SUSPICION_DECAY * dt, 0, 1);
      if (this.state === 'suspicious' && this.suspicion <= 0) this.state = 'return';
      if (this.state === 'alert') {
        this.loseTimer += dt;
        if (this.loseTimer > 2.5) {
          this.state = 'search';
          this.searchTimer = 0;
        }
      }
    }

    // Movement per state.
    this.moving = false;
    if (this.state === 'patrol') this.followWaypoints(dt, world);
    else if (this.state === 'suspicious') {
      // Stand and stare at where the thief was glimpsed.
      if (this.lastSeen) {
        this.facing = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
      }
    } else if (this.state === 'alert') {
      this.chase(dt, world, thief);
    } else if (this.state === 'search') {
      this.searchTimer += dt;
      if (this.lastSeen && dist(this.x, this.y, this.lastSeen.x, this.lastSeen.y) > 12) {
        this.followPathTo(dt, world, this.lastSeen.x, this.lastSeen.y, this.speed * 1.15);
      } else if (this.searchTimer > 3) {
        this.state = 'return';
      } else {
        this.facing += dt * 1.8; // scan the room
      }
    } else if (this.state === 'return') {
      // Walk back to the nearest waypoint, then resume the patrol.
      let best = 0, bd = Infinity;
      this.way.forEach((w, i) => {
        const d = dist(this.x, this.y, w.x, w.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < 10) {
        this.wayIdx = best;
        this.state = 'patrol';
      } else {
        this.followPathTo(dt, world, this.way[best].x, this.way[best].y, this.speed);
      }
    }
    if (this.moving) this.walkPhase += dt * 9;
  }

  // BFS pathing: a straight line to a waypoint can run through furniture,
  // so patrol/search/return walk a computed path of tile centres instead.
  followPathTo(dt, world, tx, ty, speed) {
    const gx = Math.floor(tx / TILE), gy = Math.floor(ty / TILE);
    const goalKey = gx + ',' + gy;
    this.pathTimer -= dt;
    if (this.pathGoal !== goalKey || this.path.length === 0 || this.pathTimer <= 0) {
      const sx = Math.floor(this.x / TILE), sy = Math.floor(this.y / TILE);
      const tiles = world.bfsPath(sx, sy, (x, y) => x === gx && y === gy);
      this.path = (tiles || []).map(([px, py]) => world.tileCenter(px, py));
      this.pathGoal = goalKey;
      this.pathTimer = 2;
    }
    if (this.path.length) {
      const next = this.path[0];
      if (dist(this.x, this.y, next.x, next.y) < 6) {
        this.path.shift();
      } else {
        this.moveToward(dt, world, next.x, next.y, speed);
      }
    }
  }

  followWaypoints(dt, world) {
    const target = this.way[this.wayIdx];
    if (dist(this.x, this.y, target.x, target.y) < 8) {
      this.wayIdx = (this.wayIdx + 1) % this.way.length;
      this.path = [];
      this.pathGoal = null;
      return;
    }
    this.followPathTo(dt, world, target.x, target.y, this.speed);
  }

  chase(dt, world, thief) {
    this.moveToward(dt, world, thief.x, thief.y, GUARD_CHASE_SPEED);
  }

  moveToward(dt, world, tx, ty, speed) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    this.facing = Math.atan2(dy, dx);
    world.moveCircle(this, (dx / d) * speed * dt, (dy / d) * speed * dt);
    this.moving = true;
  }

  conePoints(world) {
    return conePolygon(world, this.x, this.y, this.facing, GUARD_CONE_HALF, GUARD_CONE_RANGE);
  }

  draw(ctx, time) {
    const bob = this.moving ? Math.sin(this.walkPhase) * 1.5 : Math.sin(time * 2 + 1) * 0.5;
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    const px = -fy, py = fx;
    const legSwing = this.moving ? Math.sin(this.walkPhase) * 5 : 0;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs.
    ctx.fillStyle = '#16233a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(px * s * 6 + fx * legSwing * s, py * s * 6 + fy * legSwing * s + 8, 4.5, 6, this.facing, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body: navy uniform, gold buttons + belt.
    ctx.save();
    ctx.rotate(this.facing + Math.PI / 2);
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.roundRect(-10, -11 + bob * 0.4, 20, 23, 7);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-10, 2 + bob * 0.4, 20, 2.5);
    ctx.fillStyle = '#ffd94d';
    for (const by of [-6, -1]) {
      ctx.beginPath();
      ctx.arc(0, by + bob * 0.4, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Baton in the right hand.
    ctx.fillStyle = '#3a2c1c';
    ctx.beginPath();
    ctx.ellipse(12, 4 + bob * 0.4, 3, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head + helmet (dome + brim, turned with the facing).
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(fx * 2, fy * 2 - 12 + bob * 0.4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22395e';
    ctx.beginPath();
    ctx.ellipse(fx * 2, fy * 2 - 14 + bob * 0.4, 10, 7.5, this.facing, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fx * 2, fy * 2 - 13 + bob * 0.4, 11, 4, this.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(fx * 2 + px * 4, fy * 2 - 16 + bob * 0.4, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // "?" while suspicious, "!" while chasing — the fair warning.
    if (this.state === 'suspicious' || this.state === 'alert') {
      const alert = this.state === 'alert';
      ctx.fillStyle = alert ? '#ff4444' : '#ffd94d';
      ctx.beginPath();
      ctx.arc(0, -30 + bob * 0.4, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101018';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(alert ? '!' : '?', 0, -29.5 + bob * 0.4);
    }
    ctx.restore();
  }
}
