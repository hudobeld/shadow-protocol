// Screenshot scenes behind ?shot=start|play|alert|end. Each one plays the real rules
// forward from a fresh level with an autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { EVENT_CLEAR, EVENT_WIN, hasLineOfSight } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 22;
const END_LIMIT_SECONDS = 300;
const SAMPLE = STEP;

function tileOf(x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

function passable(map, col, row) {
  if (col < 0 || col >= map[0].length || row < 0 || row >= map.length) return false;
  const ch = map[row][col];
  return ch !== '#' && ch !== 'C';
}

// Breadth-first path over tiles; `blocked` is a set of "col,row" tiles to avoid.
function bfsPath(map, from, to, blocked) {
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [from];
  prev.set(key(from.col, from.row), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.col === to.col && cur.row === to.row) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (!passable(map, nc, nr)) continue;
      if (blocked && blocked.has(key(nc, nr))) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), cur);
      queue.push({ col: nc, row: nr });
    }
  }
  const goalKey = key(to.col, to.row);
  if (!prev.has(goalKey)) return null;
  const path = [];
  let cur = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur.col, cur.row));
  }
  return path;
}

// How exposed a point is: 1 inside a guard's cone with line of sight, 0 when safe.
function dangerAt(state, x, y) {
  let danger = 0;
  for (const g of state.guards) {
    const dx = x - g.x;
    const dy = y - g.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 195) continue;
    let diff = Math.atan2(dy, dx) - g.dir;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > (75 * Math.PI) / 360) continue;
    if (!hasLineOfSight(state.map, g.x, g.y, x, y)) continue;
    danger = Math.max(danger, 1 - dist / 195);
  }
  return danger;
}

function nearestShadowTile(state, x, y) {
  const from = tileOf(x, y);
  let best = null;
  let bestDist = Infinity;
  for (let row = 0; row < state.map.length; row += 1) {
    for (let col = 0; col < state.map[0].length; col += 1) {
      if (state.map[row][col] !== 's') continue;
      const cx = (col + 0.5) * TILE;
      const cy = (row + 0.5) * TILE;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestDist && dangerAt(state, cx, cy) < 0.1) {
        bestDist = d;
        best = { col, row };
      }
    }
  }
  return best || from;
}

// Steer the player along a BFS path to `target`, waiting out cones and ducking
// into shadow when suspicion climbs. Returns {x, y} movement and sneak flag.
function makePilot(world) {
  let path = null;
  let pathTarget = null;
  let waitTimer = 0;
  let repathTimer = 0;
  return function pilot() {
    const state = world.state;
    const p = state.player;
    let target;
    if (state.suspicion > 70) {
      target = nearestShadowTile(state, p.x, p.y);
    } else {
      const remaining = state.intel.filter((item) => !item.taken);
      if (remaining.length > 0) {
        let best = remaining[0];
        let bestDist = Infinity;
        for (const item of remaining) {
          const d = Math.hypot(item.x - p.x, item.y - p.y);
          if (d < bestDist) {
            bestDist = d;
            best = item;
          }
        }
        target = tileOf(best.x, best.y);
      } else {
        target = tileOf(state.exit.x, state.exit.y);
      }
    }
    const targetKey = `${target.col},${target.row}`;
    repathTimer -= SAMPLE;
    if (!path || pathTarget !== targetKey || repathTimer <= 0) {
      const blocked = new Set();
      path = bfsPath(state.map, tileOf(p.x, p.y), target, blocked);
      pathTarget = targetKey;
      repathTimer = 1;
      waitTimer = 0;
    }
    if (!path || path.length < 2) return { x: 0, y: 0, sneak: true };
    const next = path[1];
    const nx = (next.col + 0.5) * TILE;
    const ny = (next.row + 0.5) * TILE;
    // Wait out a cone covering the next step; after a while, route around it.
    if (dangerAt(state, nx, ny) > 0.15) {
      waitTimer += SAMPLE;
      if (waitTimer > 2.5) {
        const blocked = new Set([`${next.col},${next.row}`]);
        const detour = bfsPath(state.map, tileOf(p.x, p.y), target, blocked);
        if (detour) {
          path = detour;
          waitTimer = 0;
        } else {
          waitTimer = 0;
        }
      }
      return { x: 0, y: 0, sneak: true };
    }
    waitTimer = 0;
    const dx = nx - p.x;
    const dy = ny - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) {
      path.shift();
      return { x: 0, y: 0, sneak: true };
    }
    return { x: dx / d, y: dy / d, sneak: true };
  };
}

function runPilot(world, seconds, mode) {
  const pilot = makePilot(world);
  let events = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    const move = mode === 'reckless' ? recklessMove(world) : pilot();
    events = world.step(SAMPLE, { x: move.x, y: move.y }, move.sneak !== false);
    if (events & (EVENT_CLEAR | EVENT_WIN)) break;
    if (world.state.status !== 'playing') break;
  }
  return events;
}

// Run straight away from the nearest guard.
function fleeMove(world) {
  const state = world.state;
  const p = state.player;
  let best = state.guards[0];
  let bestDist = Infinity;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  const dx = p.x - best.x;
  const dy = p.y - best.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, sneak: false };
}

// Shadow the nearest guard at ~120 px, staying in front of its cone: close
// enough for suspicion to build, far enough that the alarm leaves room to run.
function stalkMove(world) {
  const state = world.state;
  const p = state.player;
  let g = state.guards[0];
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - p.x, guard.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      g = guard;
    }
  }
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  if (d > 130) return { x: -ux, y: -uy, sneak: false };
  if (d < 100) return { x: ux, y: uy, sneak: false };
  let err = Math.atan2(dy, dx) - g.dir;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  if (Math.abs(err) < 0.1) return { x: 0, y: 0, sneak: false };
  // Tangent around the guard, in the direction that closes the angle error.
  const tx = -uy;
  const ty = ux;
  const sign = err > 0 ? -1 : 1;
  return { x: tx * sign, y: ty * sign, sneak: false };
}

// Walk straight at the nearest guard: the fastest way to raise the alarm.
function recklessMove(world) {
  const state = world.state;
  const p = state.player;
  let best = state.guards[0];
  let bestDist = Infinity;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  const dx = best.x - p.x;
  const dy = best.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, sneak: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a quiet level.
 * play: mid-level, sneaking for intel with cones in view.
 * alert: the alarm going off, guards closing in.
 * end: level 1 cleared.
 */
export function stageShot(name, world) {
  world.levelIndex = 0;
  world.totalScore = 0;
  world.reset(0);
  if (name === 'alert') {
    // Walk at the nearest guard until suspicion is high, then run away: the
    // alarm trips while the player is already pulling clear, so the frame
    // shows red cones and a chase, not a capture.
    let fleeing = false;
    let chaseTime = 0;
    for (let t = 0; t < 30; t += SAMPLE) {
      const s = world.state;
      if (s.status !== 'playing') break;
      if (!fleeing && s.suspicion >= 85) fleeing = true;
      if (fleeing && s.suspicion < 40 && !s.alarm) fleeing = false;
      const move = fleeing ? fleeMove(world) : stalkMove(world);
      world.step(SAMPLE, { x: move.x, y: move.y }, false);
      if (s.alarm) {
        chaseTime += SAMPLE;
        if (chaseTime > 1.2) break;
      }
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    const events = runPilot(world, END_LIMIT_SECONDS, 'careful');
    if (events & EVENT_WIN) return { screen: SCREEN_WIN };
    if (events & EVENT_CLEAR) return { screen: SCREEN_CLEAR };
    return { screen: world.state.status === 'over' ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'play') {
    runPilot(world, PLAY_SECONDS, 'careful');
    return { screen: world.state.status === 'over' ? SCREEN_OVER : SCREEN_PLAY };
  }
  for (let t = 0; t < START_SECONDS; t += SAMPLE) {
    world.step(SAMPLE, { x: 0, y: 0 }, true);
  }
  return { screen: SCREEN_TITLE };
}
