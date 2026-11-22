// VELVET VAULT — Vesper, the thief. A big, readable figure, not a dot:
// fedora, black mask, dark suit, loot bag on the back, and a two-frame
// walk cycle so the direction of travel reads at a glance.

import { TILE, THIEF_SPEED, THIEF_SNEAK, clamp } from './config.js';

export class Thief {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.facing = -Math.PI / 2; // starts looking up the room
    this.walkPhase = 0;
    this.moving = false;
    this.sneaking = false;
    this.carrying = false; // main loot in hand
    this.coins = 3;
    this.smokes = 2;
  }

  update(dt, input, world, sfx) {
    let mx = 0, my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    // Click-to-move target overrides the keys while it is active.
    if (input.clickTarget) {
      const dx = input.clickTarget.x - this.x;
      const dy = input.clickTarget.y - this.y;
      if (Math.hypot(dx, dy) > 8) {
        mx = dx / Math.hypot(dx, dy);
        my = dy / Math.hypot(dx, dy);
      } else {
        input.clickTarget = null;
      }
    }
    const len = Math.hypot(mx, my);
    this.moving = len > 0;
    this.sneaking = !!input.sneak;
    if (this.moving) {
      const sp = this.sneaking ? THIEF_SNEAK : THIEF_SPEED;
      const nx = (mx / len) * sp * dt;
      const ny = (my / len) * sp * dt;
      this.facing = Math.atan2(my, mx);
      world.moveCircle(this, nx, ny);
      this.walkPhase += dt * (this.sneaking ? 7 : 11);
      if (sfx) sfx.step();
    }
  }

  // Drawn top-down / three-quarter: shadow, swinging legs, suited body,
  // head with mask, fedora brim + crown, loot bag (swells when carrying).
  draw(ctx, time) {
    const bob = this.moving ? Math.sin(this.walkPhase) * 1.6 : Math.sin(time * 2) * 0.6;
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    const px = -fy, py = fx; // perpendicular (left/right of facing)
    const legSwing = this.moving ? Math.sin(this.walkPhase) * 5 : 0;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (two dark shoes swinging with the walk cycle).
    ctx.fillStyle = '#14141c';
    for (const s of [-1, 1]) {
      const lx = px * s * 6 + fx * legSwing * s;
      const ly = py * s * 6 + fy * legSwing * s + 8;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 4.5, 6, this.facing, 0, Math.PI * 2);
      ctx.fill();
    }

    // Loot bag on the back (bulges + gold coins peek once the loot is taken).
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath();
    ctx.ellipse(-fx * 9, -fy * 9 + 2, 8, 10, this.facing, 0, Math.PI * 2);
    ctx.fill();
    if (this.carrying) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(-fx * 11, -fy * 11 - 4, 3.2, 0, Math.PI * 2);
      ctx.arc(-fx * 8, -fy * 12 - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body: dark suit with a white shirt stripe, turned to the facing.
    ctx.save();
    ctx.rotate(this.facing + Math.PI / 2);
    ctx.fillStyle = '#1c1c26';
    ctx.beginPath();
    ctx.roundRect(-9, -11 + bob * 0.4, 18, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-2.5, -9 + bob * 0.4, 5, 12);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-9, 2 + bob * 0.4, 18, 2.5); // belt
    // Reaching arm (holds the loot out in front when carrying).
    ctx.fillStyle = '#1c1c26';
    ctx.beginPath();
    ctx.ellipse(11, 2 + bob * 0.4, 4, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head + mask.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(fx * 2, fy * 2 - 12 + bob * 0.4, 8.5, 0, Math.PI * 2);
    ctx.fill();
    // Black domino mask with two white eye slits.
    ctx.fillStyle = '#101018';
    ctx.beginPath();
    ctx.ellipse(fx * 2, fy * 2 - 13 + bob * 0.4, 8, 3.6, this.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx * 2 + px * 3.4, fy * 2 - 13 + bob * 0.4, 1.1, 0, Math.PI * 2);
    ctx.arc(fx * 2 - px * 3.4, fy * 2 - 13 + bob * 0.4, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Fedora: wide brim + crown, tilted with the facing.
    ctx.fillStyle = '#2b2b38';
    ctx.beginPath();
    ctx.ellipse(fx * 2, fy * 2 - 15 + bob * 0.4, 11.5, 8.5, this.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath();
    ctx.ellipse(fx * 2, fy * 2 - 16 + bob * 0.4, 6.5, 5, this.facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(fx * 2 - 6.5, fy * 2 - 13 + bob * 0.4, 13, 1.6);

    // The stolen diamond, held high in the leading hand when carrying.
    if (this.carrying) {
      const hx = fx * 20, hy = fy * 20 - 8 + bob * 0.4;
      ctx.save();
      ctx.shadowColor = '#7ee7ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#8fe8ff';
      ctx.beginPath();
      ctx.moveTo(hx, hy - 7);
      ctx.lineTo(hx + 6, hy);
      ctx.lineTo(hx, hy + 7);
      ctx.lineTo(hx - 6, hy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
