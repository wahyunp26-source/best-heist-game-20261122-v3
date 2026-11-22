// VELVET VAULT — everything the player sees: warm patterned floors, furniture,
// loot, lasers, vision cones, the alarm HUD, and the menu / caught / win
// screens. All art is drawn in code; nothing is loaded from the network.

import { TILE, COLS, ROWS, HUD_H, VIEW_W, VIEW_H, PALETTES, hash2, clamp } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export class Render {
  draw(ctx, game, time) {
    const pal = PALETTES[game.levelIndex];
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(0, HUD_H);
    this.drawRoom(ctx, game, pal, time);
    this.drawCones(ctx, game);
    this.drawEntities(ctx, game, time);
    ctx.restore();
    this.drawHUD(ctx, game, pal);
    if (game.state === 'menu') this.drawMenu(ctx, game);
    else if (game.state === 'caught') this.drawCaught(ctx, game);
    else if (game.state === 'levelclear') this.drawLevelClear(ctx, game);
    else if (game.state === 'win') this.drawWin(ctx, game);
  }

  drawRoom(ctx, game, pal, time) {
    const w = game.world;
    // Floor: warm checker + plank seams, carpet runs in deep red.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = w.tileAt(x, y);
        const px = x * TILE, py = y * TILE;
        if (c === '#') continue;
        if (c === ',') {
          ctx.fillStyle = pal.carpet;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(px, py + TILE - 3, TILE, 3);
          // Gold runner stripe down the middle of the carpet.
          ctx.fillStyle = pal.carpetEdge;
          ctx.fillRect(px + TILE / 2 - 1.5, py, 3, TILE);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 === 0 ? pal.floorA : pal.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = pal.plank;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        ctx.beginPath();
        ctx.moveTo(px, py + TILE / 2);
        ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        if (hash2(x, y) > 0.86) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        }
      }
    }
    // Walls: dark blocks with a lit top edge.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = w.tileAt(x, y);
        if (c !== '#' && c !== 'V') continue;
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = c === 'V' ? '#3d3d48' : pal.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = c === 'V' ? '#565664' : pal.wallTop;
        ctx.fillRect(px, py, TILE, 5);
        if (c === 'V') {
          ctx.fillStyle = '#c9a227';
          ctx.fillRect(px + 6, py + 6, 3, 3);
          ctx.fillRect(px + TILE - 9, py + 6, 3, 3);
          ctx.fillRect(px + 6, py + TILE - 9, 3, 3);
          ctx.fillRect(px + TILE - 9, py + TILE - 9, 3, 3);
        }
      }
    }
    // Paintings hang on the north wall.
    for (const p of game.def.paintings) {
      const px = p.tx * TILE, py = p.ty * TILE + 2;
      const pw = p.w * TILE - 6, ph = 22;
      ctx.fillStyle = '#c9a227';
      rr(ctx, px + 1, py - 2, pw + 4, ph + 6, 3);
      ctx.fillStyle = '#1c1c26';
      ctx.fillRect(px + 3, py, pw, ph);
      const seg = pw / p.c.length;
      p.c.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        if (i === 0) ctx.moveTo(px + 3, py + ph);
        ctx.lineTo(px + 3 + seg * i, py + 4);
        ctx.lineTo(px + 3 + seg * (i + 1), py + 4);
        ctx.lineTo(px + 3 + seg * (i + 1), py + ph);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(px + pw * 0.7, py + 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Furniture + loot + exit + lasers, tile by tile.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = w.tileAt(x, y);
        const px = x * TILE, py = y * TILE;
        if (c === 'T') this.drawPedestal(ctx, px, py, pal);
        else if (c === 'P') this.drawPlant(ctx, px, py, time);
        else if (c === 'B') this.drawShelf(ctx, px, py);
        else if (c === 'F') this.drawFireplace(ctx, px, py, time);
        else if (c === 'S') this.drawSafe(ctx, px, py, w, x, y);
        else if (c === 'L') this.drawLootPedestal(ctx, px, py, w, time);
        else if (c === 'E') this.drawExit(ctx, px, py, game);
        else if (c === '=') this.drawLaserTile(ctx, px, py, w, x, y, time, game.time);
      }
    }
    // Cash bags (loose loot on the floor).
    for (const bag of game.cashbags) {
      if (bag.taken) continue;
      ctx.save();
      ctx.translate(bag.x, bag.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b98d4f';
      ctx.beginPath();
      ctx.moveTo(-9, 8);
      ctx.quadraticCurveTo(-12, -8, 0, -11);
      ctx.quadraticCurveTo(12, -8, 9, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7a5a28';
      ctx.fillRect(-6, -13, 12, 4);
      ctx.fillStyle = '#3a2c1c';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
      ctx.restore();
    }
  }

  drawPedestal(ctx, px, py, pal) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px + 20, py + 32, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    rr(ctx, px + 11, py + 8, 18, 24, 3);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(px + 9, py + 6, 22, 3);
    ctx.fillRect(px + 9, py + 31, 22, 3);
    ctx.fillStyle = '#7ec850';
    ctx.beginPath();
    ctx.arc(px + 20, py + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlant(ctx, px, py, time) {
    const sway = Math.sin(time * 1.5 + px) * 1.5;
    ctx.fillStyle = '#a34d2d';
    ctx.beginPath();
    ctx.moveTo(px + 11, py + 24);
    ctx.lineTo(px + 29, py + 24);
    ctx.lineTo(px + 26, py + 36);
    ctx.lineTo(px + 14, py + 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f8f3a';
    for (const [dx, dy, r] of [[-6, -6, 7], [6, -8, 8], [0, -13, 7]]) {
      ctx.beginPath();
      ctx.arc(px + 20 + dx + sway, py + 22 + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath();
    ctx.arc(px + 20 + sway, py + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShelf(ctx, px, py) {
    ctx.fillStyle = '#4a2f1d';
    rr(ctx, px + 4, py + 4, 32, 32, 3);
    const cols = ['#c94f5e', '#3f6fb5', '#e8b64c', '#7ec850', '#8e44ad'];
    for (let s = 0; s < 2; s++) {
      const sy = py + 9 + s * 13;
      ctx.fillStyle = '#2e1c10';
      ctx.fillRect(px + 7, sy, 26, 9);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[(i + s * 2) % cols.length];
        ctx.fillRect(px + 8 + i * 4.4, sy + 1, 3, 8);
      }
    }
  }

  drawFireplace(ctx, px, py, time) {
    ctx.fillStyle = '#6e3b2a';
    rr(ctx, px + 2, py + 2, 36, 36, 3);
    ctx.fillStyle = '#1c1210';
    rr(ctx, px + 9, py + 16, 22, 20, 2);
    const flick = 0.7 + Math.sin(time * 9 + px) * 0.3;
    ctx.save();
    ctx.shadowColor = '#ff9a3d';
    ctx.shadowBlur = 18 * flick;
    ctx.fillStyle = `rgba(255,${Math.floor(140 + 60 * flick)},40,0.95)`;
    ctx.beginPath();
    ctx.moveTo(px + 20, py + 34);
    ctx.quadraticCurveTo(px + 12, py + 24, px + 20, py + 18);
    ctx.quadraticCurveTo(px + 28, py + 24, px + 20, py + 34);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(px + 2, py + 2, 36, 3);
  }

  drawSafe(ctx, px, py, w, tx, ty) {
    const safe = w.safes.find((s) => s.tx === tx && s.ty === ty);
    const opened = safe && safe.taken;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px + 20, py + 33, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opened ? '#4a4a58' : '#2c2c38';
    rr(ctx, px + 6, py + 6, 28, 28, 4);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 8.5, py + 8.5, 23, 23);
    ctx.fillStyle = '#8a8a9a';
    ctx.beginPath();
    ctx.arc(px + 20, py + 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(px + 24, py + 18, 6, 3);
    if (!opened) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SAFE $2.5K', px + 20, py + 4);
    }
  }

  drawLootPedestal(ctx, px, py, w, time) {
    if (w.loot.taken) {
      ctx.fillStyle = '#e8e4da';
      rr(ctx, px + 11, py + 8, 18, 24, 3);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(px + 9, py + 6, 22, 3);
      return;
    }
    const bob = Math.sin(time * 2.4) * 2;
    ctx.save();
    ctx.shadowColor = '#7ee7ff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#8fe8ff';
    ctx.beginPath();
    ctx.moveTo(px + 20, py - 2 + bob);
    ctx.lineTo(px + 31, py + 8 + bob);
    ctx.lineTo(px + 20, py + 18 + bob);
    ctx.lineTo(px + 9, py + 8 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(px + 20, py - 2 + bob);
    ctx.lineTo(px + 25, py + 8 + bob);
    ctx.lineTo(px + 20, py + 8 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    rr(ctx, px + 11, py + 20, 18, 12, 3);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(px + 9, py + 18, 22, 3);
    ctx.fillStyle = '#101018';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIAMOND $12K', px + 20, py + 38);
  }

  drawExit(ctx, px, py, game) {
    const open = game.world.loot.taken;
    ctx.fillStyle = open ? '#1f7a37' : '#5a1f1f';
    rr(ctx, px + 4, py + 4, 32, 32, 4);
    ctx.strokeStyle = open ? '#7ee7a0' : '#c94f5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 6.5, py + 6.5, 27, 27);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'EXIT' : 'LOCK', px + 20, py + 19);
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(open ? 'OPEN' : 'NEED LOOT', px + 20, py + 30);
    if (open) {
      ctx.save();
      ctx.shadowColor = '#7ee7a0';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#7ee7a0';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 4, py + 4, 32, 32);
      ctx.restore();
    }
  }

  drawLaserTile(ctx, px, py, w, tx, ty, time, gameTime) {
    const group = w.laserGroups.find((g) => g.tiles.some(([gx, gy]) => gx === tx && gy === ty));
    const on = group ? w.laserOn(group, gameTime) : false;
    ctx.fillStyle = '#3d3d48';
    ctx.fillRect(px + 2, py + 2, 5, 5);
    ctx.fillRect(px + TILE - 7, py + 2, 5, 5);
    ctx.fillRect(px + 2, py + TILE - 7, 5, 5);
    ctx.fillRect(px + TILE - 7, py + TILE - 7, 5, 5);
    if (on) {
      ctx.save();
      ctx.shadowColor = '#ff2d2d';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ff2d2d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py + TILE / 2);
      ctx.lineTo(px + TILE, py + TILE / 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,80,80,0.35)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py + TILE / 2);
      ctx.lineTo(px + TILE, py + TILE / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawCones(ctx, game) {
    // Guard cones first (under the characters), then camera cones.
    for (const g of game.guards) {
      const pts = g.conePoints(game.world);
      const hot = g.state === 'alert';
      const warm = g.state === 'suspicious' || g.state === 'search';
      ctx.fillStyle = hot
        ? 'rgba(255,60,60,0.30)'
        : warm ? 'rgba(255,170,60,0.24)' : 'rgba(255,220,120,0.16)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    for (const cam of game.cameras) {
      const pts = cam.conePoints(game.world);
      ctx.fillStyle = cam.seeing ? 'rgba(255,60,60,0.28)' : 'rgba(110,220,255,0.13)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    // Smoke clouds hide everyone inside them.
    for (const s of game.smokes) {
      const a = clamp(s.left / 1.2, 0, 1);
      ctx.fillStyle = `rgba(200,200,210,${0.55 * a})`;
      for (const [dx, dy, r] of [[0, 0, 34], [-22, 10, 24], [22, 8, 26], [-10, -16, 22], [14, -14, 20]]) {
        ctx.beginPath();
        ctx.arc(s.x + dx, s.y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawEntities(ctx, game, time) {
    for (const cam of game.cameras) cam.draw(ctx);
    // Thrown coin, arcing to its landing spot.
    if (game.thrownCoin) {
      const c = game.thrownCoin;
      const t = clamp(1 - c.left / 0.55, 0, 1);
      const x = c.x0 + (c.x1 - c.x0) * t;
      const y = c.y0 + (c.y1 - c.y0) * t - Math.sin(t * Math.PI) * 26;
      ctx.save();
      ctx.shadowColor = '#ffd94d';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d1f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', x, y + 3);
      ctx.restore();
    }
    for (const g of game.guards) g.draw(ctx, time);
    game.thief.draw(ctx, time);
  }

  drawHUD(ctx, game, pal) {
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(0, HUD_H - 3, VIEW_W, 3);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('VELVET VAULT', 18, 30);
    ctx.fillStyle = '#b9b3a4';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${PALETTES[game.levelIndex].name} — ${PALETTES[game.levelIndex].sub}`, 18, 52);
    ctx.fillStyle = '#8a8a9a';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD move · Shift sneak · E grab · C coin · Q smoke · Click to move · M mute', 18, 70);

    // Alarm meter, centre.
    const ax = 480, aw = 300;
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', ax, 26);
    ctx.fillStyle = '#2c2c38';
    rr(ctx, ax, 34, aw, 18, 9);
    const frac = clamp(game.alarm / 100, 0, 1);
    const col = frac < 0.4 ? '#5cb85c' : frac < 0.7 ? '#e8b64c' : '#ff4444';
    ctx.fillStyle = col;
    if (frac > 0.01) rr(ctx, ax + 2, 36, (aw - 4) * frac, 14, 7);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(game.alarm)}%`, ax + aw + 10, 49);
    ctx.fillStyle = game.world.loot.taken ? '#7ee7a0' : '#ff9a9a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(game.world.loot.taken ? 'EXIT OPEN — RUN!' : 'EXIT LOCKED — TAKE THE LOOT', ax, 70);

    // Loot / score / time, right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`LOOT $${game.loot.toLocaleString('en-US')}`, VIEW_W - 18, 30);
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`SCORE ${game.score.toLocaleString('en-US')}`, VIEW_W - 18, 52);
    const mm = Math.floor(game.time / 60), ss = Math.floor(game.time % 60);
    ctx.fillStyle = '#8a8a9a';
    ctx.font = '13px sans-serif';
    ctx.fillText(`TIME ${mm}:${String(ss).padStart(2, '0')}   COINS ×${game.thief.coins}   SMOKE ×${game.thief.smokes}`, VIEW_W - 18, 70);

    // Camera SPOTTED banner.
    if (game.cameras.some((c) => c.seeing)) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('! CAMERA SPOTTED !', VIEW_W / 2, 26);
    }
  }

  overlay(ctx, title, titleCol, lines, foot) {
    ctx.fillStyle = 'rgba(10,10,16,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = titleCol;
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText(title, VIEW_W / 2, 250);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '19px sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 310 + i * 30));
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(foot, VIEW_W / 2, 310 + lines.length * 30 + 40);
  }

  drawMenu(ctx, game) {
    this.overlay(
      ctx,
      'VELVET VAULT',
      '#ffd94d',
      [
        'The Grand Getaway — Vesper is going in tonight.',
        'Three rooms. Three vaults. One diamond each night — take it and run.',
        '',
        'WASD / Arrows — move      Shift — sneak      E — grab loot',
        'C — toss a coin to distract a guard      Q — smoke bomb',
        'Click — walk there      M — mute',
        '',
        'Read the cones before you move. The alarm only forgives so much.',
      ],
      '— PRESS ENTER TO START —',
    );
  }

  drawCaught(ctx, game) {
    this.overlay(
      ctx,
      'CAUGHT!',
      '#ff4444',
      [`${game.caughtReason}`, `Loot kept: $${game.loot.toLocaleString('en-US')}   Score: ${game.score.toLocaleString('en-US')}`],
      '— PRESS R TO RETRY THIS ROOM —',
    );
  }

  drawLevelClear(ctx, game) {
    this.overlay(
      ctx,
      'ROOM CLEAR!',
      '#7ee7a0',
      [
        `${PALETTES[game.levelIndex].name} — the loot is yours.`,
        `Room loot: $${game.roomLoot.toLocaleString('en-US')}   Total: $${game.loot.toLocaleString('en-US')}`,
      ],
      '— PRESS ENTER FOR THE NEXT ROOM —',
    );
  }

  drawWin(ctx, game) {
    const mm = Math.floor(game.time / 60), ss = Math.floor(game.time % 60);
    this.overlay(
      ctx,
      'THE GRAND GETAWAY!',
      '#ffd94d',
      [
        'Vesper slipped out of the penthouse with every diamond.',
        `Total loot: $${game.loot.toLocaleString('en-US')}   Score: ${game.score.toLocaleString('en-US')}`,
        `Time: ${mm}:${String(ss).padStart(2, '0')}   — the perfect heist.`,
      ],
      '— PRESS R TO PLAY AGAIN —',
    );
  }
}
