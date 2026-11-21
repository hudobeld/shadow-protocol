// Shadow Protocol: all drawing — floor, walls, vision cones, HUD, screens.
import { COLS, FIELD, GUARD, ROWS, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FLOOR_A = '#1b2230';
const FLOOR_B = '#1a202c';
const SHADOW_FLOOR = '#10151f';
const WALL_FILL = '#3a4356';
const WALL_TOP = '#565f73';
const CRATE_FILL = '#6b4a2b';
const CRATE_EDGE = '#8a6238';

function tileChar(map, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return map[row][col];
}

function isSolid(ch) {
  return ch === '#' || ch === 'C';
}

function conePolygon(map, gx, gy, dir, fov, range) {
  const points = [{ x: gx, y: gy }];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const angle = dir - fov / 2 + (fov * i) / rays;
    let r = range;
    for (let d = 8; d <= range; d += 6) {
      const x = gx + Math.cos(angle) * d;
      const y = gy + Math.sin(angle) * d;
      if (isSolid(tileChar(map, Math.floor(x / TILE), Math.floor(y / TILE)))) {
        r = d;
        break;
      }
    }
    points.push({ x: gx + Math.cos(angle) * r, y: gy + Math.sin(angle) * r });
  }
  return points;
}

function drawCone(ctx, map, g, alarm) {
  const suspicion = g.suspicion;
  let fill = 'rgba(255, 214, 90, 0.14)';
  let edge = 'rgba(255, 214, 90, 0.35)';
  if (alarm || suspicion >= 100) {
    fill = 'rgba(255, 64, 64, 0.30)';
    edge = 'rgba(255, 90, 90, 0.55)';
  } else if (suspicion > 55) {
    fill = 'rgba(255, 140, 50, 0.24)';
    edge = 'rgba(255, 150, 60, 0.5)';
  } else if (suspicion > 20) {
    fill = 'rgba(255, 190, 70, 0.19)';
    edge = 'rgba(255, 200, 90, 0.42)';
  }
  const points = conePolygon(map, g.x, g.y, g.dir, GUARD.fov, GUARD.visionRange);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWorld(ctx, state, time) {
  const map = state.map;
  // Floor.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = map[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (ch === 's') {
        ctx.fillStyle = SHADOW_FLOOR;
        ctx.fillRect(x, y, TILE, TILE);
      } else {
        ctx.fillStyle = (col + row) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(x, y, TILE, TILE);
      }
      if (ch === 's') {
        ctx.strokeStyle = 'rgba(120, 160, 255, 0.10)';
        ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
      }
    }
  }
  // Exit.
  const allTaken = state.intel.every((item) => item.taken);
  const ex = state.exit;
  ctx.save();
  ctx.translate(ex.x, ex.y);
  ctx.fillStyle = allTaken ? '#1f7a4d' : '#2c3a2e';
  ctx.strokeStyle = allTaken ? '#4ade80' : '#5b6b5f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = allTaken ? '#d1fae0' : '#9fb3a4';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', 0, 0);
  if (allTaken) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.25 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 19 + 3 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Intel.
  for (const item of state.intel) {
    if (item.taken) continue;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + item.x);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.fillStyle = `rgba(34, 211, 238, ${0.15 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 13 + 3 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Walls and crates.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = map[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (ch === '#') {
        ctx.fillStyle = WALL_FILL;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (ch === 'C') {
        ctx.fillStyle = CRATE_FILL;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = CRATE_EDGE;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + TILE - 5, y + TILE - 5);
        ctx.moveTo(x + TILE - 5, y + 5);
        ctx.lineTo(x + 5, y + TILE - 5);
        ctx.stroke();
      }
    }
  }

  // Vision cones, then guards, then the player.
  for (const g of state.guards) drawCone(ctx, map, g, state.alarm);
  for (const g of state.guards) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = state.alarm ? '#ef4444' : '#dc2626';
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#fee2e2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(g.dir) * (GUARD.radius + 5), Math.sin(g.dir) * (GUARD.radius + 5));
    ctx.stroke();
    // Alert marker.
    if (g.suspicion > 55 || state.alarm) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -GUARD.radius - 6);
    } else if (g.suspicion > 20) {
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -GUARD.radius - 6);
    }
    ctx.restore();
  }

  // Player.
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.sneak) {
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#14b8a6';
  ctx.strokeStyle = '#ccfbf1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f0fdfa';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.dir) * 15, Math.sin(p.dir) * 15);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.fillRect(0, 0, FIELD.width, 34);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.def.name, 12, 17);
  // Intel pips.
  const taken = state.intel.filter((item) => item.taken).length;
  for (let i = 0; i < state.intel.length; i += 1) {
    const x = 300 + i * 22;
    ctx.save();
    ctx.translate(x, 17);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < taken ? '#22d3ee' : '#334155';
    ctx.strokeStyle = '#67e8f9';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText(`INTEL ${taken}/${state.intel.length}`, 372, 17);
  // Suspicion bar.
  const barX = 480;
  const barW = 150;
  ctx.fillStyle = '#334155';
  ctx.fillRect(barX, 11, barW, 12);
  const susp = state.suspicion / 100;
  ctx.fillStyle = state.alarm ? '#ef4444' : susp > 0.55 ? '#f59e0b' : '#eab308';
  ctx.fillRect(barX, 11, barW * susp, 12);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(barX + 0.5, 11.5, barW - 1, 11);
  ctx.fillStyle = state.alarm ? '#fca5a5' : '#e2e8f0';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(state.alarm ? 'ALARM!' : 'SUSPICION', barX + barW + 8, 17);
  // Attempts, time, score.
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  const mins = Math.floor(state.elapsed / 60);
  const secs = Math.floor(state.elapsed % 60);
  ctx.fillText(
    `TRIES ${'●'.repeat(state.attemptsLeft)}${'○'.repeat(3 - state.attemptsLeft)}   ${mins}:${String(secs).padStart(2, '0')}   SCORE ${state.score}`,
    FIELD.width - 12,
    17,
  );
  ctx.textAlign = 'left';
  // Bottom hint.
  ctx.fillStyle = 'rgba(8, 12, 20, 0.7)';
  ctx.fillRect(0, FIELD.height - 22, FIELD.width, 22);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD / arrows — move      SHIFT — sneak (slower, harder to spot)      dark floor — shadow, detection is halved      R — restart level', 12, FIELD.height - 11);
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 8, 14, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, FIELD.width / 2, FIELD.height / 2 - 90);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - 40 + i * 26);
  });
}

export function render(ctx, world, screen, time) {
  const state = world.state;
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawWorld(ctx, state, time);
  if (screen === SCREEN_PLAY) {
    drawHud(ctx, state);
    if (state.alarm) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(0, 34, FIELD.width, FIELD.height - 56);
    }
    return;
  }
  drawHud(ctx, state);
  if (screen === SCREEN_TITLE) {
    overlay(ctx, 'SHADOW PROTOCOL', [
      'A top-down stealth game. Stay out of the yellow cones.',
      'Grab all 3 intel chips, then reach the green EXIT — unseen.',
      'Crouch in the dark floor: shadows halve how fast guards spot you.',
      'Walking is heard up close. Hold SHIFT to sneak.',
      '',
      'Press ENTER to begin',
    ], '#5eead4');
  } else if (screen === SCREEN_CLEAR) {
    overlay(ctx, 'LEVEL CLEAR', [
      `Score this level: ${state.score}    Total: ${world.totalScore}`,
      'The next floor has more guards, faster patrols, less room.',
      '',
      'Press ENTER for the next level',
    ], '#4ade80');
  } else if (screen === SCREEN_OVER) {
    overlay(ctx, 'CAUGHT', [
      'The guards dragged you out. The intel is still in there.',
      '',
      'Press ENTER to try again',
    ], '#f87171');
  } else if (screen === SCREEN_WIN) {
    overlay(ctx, 'ALL INTEL SECURED', [
      `Final score: ${world.totalScore}`,
      'Three floors, zero alarms left ringing. Clean run, agent.',
      '',
      'Press ENTER to play again',
    ], '#facc15');
  }
}
