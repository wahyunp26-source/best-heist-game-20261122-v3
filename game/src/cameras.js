// VELVET VAULT — wall cameras. They sweep their cone back and forth; being
// seen by one spikes the alarm and flashes SPOTTED! on the HUD.

import { TILE, CAMERA_CONE_RANGE, CAMERA_CONE_HALF } from './config.js';
import { conePolygon, pointInCone } from './guards.js';

export class Camera {
  constructor(def) {
    this.x = def.tx * TILE + TILE / 2;
    this.y = def.ty * TILE + TILE / 2;
    this.base = def.base;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.angle = def.base;
    this.seeing = false;
  }
  update(dt, time, world, thief, smokes) {
    this.angle = this.base + Math.sin(time * this.speed) * this.sweep;
    this.seeing = false;
    if (pointInCone(world, this.x, this.y, this.angle, CAMERA_CONE_HALF, CAMERA_CONE_RANGE, thief.x, thief.y)) {
      let blocked = false;
      for (const s of smokes) {
        const mx = (this.x + thief.x) / 2, my = (this.y + thief.y) / 2;
        if (Math.hypot(s.x - mx, s.y - my) < s.r * 0.7) { blocked = true; break; }
      }
      this.seeing = !blocked;
    }
  }
  conePoints(world) {
    return conePolygon(world, this.x, this.y, this.angle, CAMERA_CONE_HALF, CAMERA_CONE_RANGE);
  }
  draw(ctx) {
    // Wall mount + camera body, aimed along the sweep.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#22222c';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath();
    ctx.roundRect(0, -5, 16, 10, 4);
    ctx.fill();
    ctx.fillStyle = this.seeing ? '#ff4444' : '#7ee7ff';
    ctx.beginPath();
    ctx.arc(15, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (this.seeing) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED!', 0, -16);
    }
    ctx.restore();
  }
}
