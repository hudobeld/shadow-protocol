// Shadow Protocol: the world — levels, guards, vision cones, suspicion, alarm.
import { COLS, DETECT, FIELD, GUARD, LEVELS, PLAYER, ROWS, STEP, TILE } from './config.js';

export const EVENT_CLEAR = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_GAMEOVER = 4;
export const EVENT_WIN = 8;

function tileAt(map, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return map[row][col];
}

function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

function circleHitsSolid(map, x, y, radius) {
  const left = Math.floor((x - radius) / TILE);
  const right = Math.floor((x + radius) / TILE);
  const top = Math.floor((y - radius) / TILE);
  const bottom = Math.floor((y + radius) / TILE);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (!isSolidTile(tileAt(map, col, row))) continue;
      const cx = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
      const cy = Math.max(row * TILE, Math.min(y, (row + 1) * TILE));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
    }
  }
  return false;
}

export function hasLineOfSight(map, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isSolidTile(tileAt(map, Math.floor(x / TILE), Math.floor(y / TILE)))) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function parseLevel(def) {
  const map = def.map;
  let player = { x: TILE * 1.5, y: TILE * 1.5 };
  const intel = [];
  let exit = { x: TILE * 28.5, y: TILE * 17.5 };
  const spawns = {};
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = map[row][col];
      const cx = (col + 0.5) * TILE;
      const cy = (row + 0.5) * TILE;
      if (ch === 'P') player = { x: cx, y: cy };
      else if (ch === 'I') intel.push({ x: cx, y: cy, taken: false });
      else if (ch === 'E') exit = { x: cx, y: cy };
      else if (ch >= '1' && ch <= '4') spawns[ch] = { x: cx, y: cy };
    }
  }
  return { map, player, intel, exit, spawns };
}

export function createWorld() {
  const world = {
    levelIndex: 0,
    state: null,
    totalScore: 0,
    reset(levelIndex) {
      const def = LEVELS[levelIndex];
      const parsed = parseLevel(def);
      const guards = def.guards.map((g) => {
        const spawn = parsed.spawns[g.spawn];
        const path = g.path.map(([c, r]) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }));
        return {
          x: spawn.x,
          y: spawn.y,
          dir: 0,
          path,
          wpIndex: 1,
          wpDir: 1,
          pause: 0,
          scan: 0,
          suspicion: 0,
          seesPlayer: false,
          stuck: 0,
          lastX: spawn.x,
          lastY: spawn.y,
        };
      });
      this.state = {
        def,
        map: parsed.map,
        player: { ...parsed.player, dir: 0, moving: false, sneak: false },
        guards,
        intel: parsed.intel,
        exit: parsed.exit,
        suspicion: 0,
        alarm: false,
        alarmTimer: 0,
        loseSightTimer: 0,
        attemptsLeft: 3,
        elapsed: 0,
        score: 0,
        status: 'playing',
        levelIndex,
      };
      return this.state;
    },
    inShadow(x, y) {
      return tileAt(this.state.map, Math.floor(x / TILE), Math.floor(y / TILE)) === 's';
    },
    // Move one step. `move` is {x, y} -1..1, `sneak` a boolean. Returns event flags.
    step(dt, move, sneak) {
      const s = this.state;
      if (!s || s.status !== 'playing') return 0;
      s.elapsed += dt;
      const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const p = s.player;
      p.sneak = sneak;
      p.moving = move.x !== 0 || move.y !== 0;
      if (p.moving) p.dir = Math.atan2(move.y, move.x);
      const nx = p.x + move.x * speed * dt;
      if (!circleHitsSolid(s.map, nx, p.y, PLAYER.radius)) p.x = nx;
      const ny = p.y + move.y * speed * dt;
      if (!circleHitsSolid(s.map, p.x, ny, PLAYER.radius)) p.y = ny;

      // Guards: vision, suspicion, patrol / chase.
      let anySees = false;
      let maxSuspicion = 0;
      for (const g of s.guards) {
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const dist = Math.hypot(dx, dy);
        const inRange = dist < GUARD.visionRange;
        const inCone = inRange && angleDiff(Math.atan2(dy, dx), g.dir) < GUARD.fov / 2;
        const seen = inCone && hasLineOfSight(s.map, g.x, g.y, p.x, p.y);
        g.seesPlayer = seen;
        if (seen) {
          anySees = true;
          const closeness = 1 - dist / GUARD.visionRange;
          let rate = DETECT.maxRate * (DETECT.edgeRate + (1 - DETECT.edgeRate) * closeness);
          if (sneak) rate *= DETECT.sneakFactor;
          if (this.inShadow(p.x, p.y)) rate *= DETECT.shadowFactor;
          g.suspicion = Math.min(100, g.suspicion + rate * dt);
        } else {
          // Walking close by is heard, even out of sight.
          if (p.moving && !sneak && dist < DETECT.hearRadius) {
            g.suspicion = Math.min(100, g.suspicion + DETECT.hearRate * dt);
          } else {
            g.suspicion = Math.max(0, g.suspicion - DETECT.decayRate * dt);
          }
        }
        maxSuspicion = Math.max(maxSuspicion, g.suspicion);

        // Movement: chase while alarmed, patrol otherwise.
        if (s.alarm) {
          const d = Math.hypot(p.x - g.x, p.y - g.y);
          if (d > 1) {
            const mx = ((p.x - g.x) / d) * defChaseSpeed(s) * dt;
            const my = ((p.y - g.y) / d) * defChaseSpeed(s) * dt;
            moveGuard(s, g, mx, my);
            g.dir = Math.atan2(p.y - g.y, p.x - g.x);
          }
        } else if (g.pause > 0) {
          g.pause -= dt;
          g.scan += dt;
          // Scan the area while waiting at a waypoint.
          g.dir += Math.sin(g.scan * 2.2) * 0.9 * dt;
        } else {
          const target = g.path[g.wpIndex];
          const dx2 = target.x - g.x;
          const dy2 = target.y - g.y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < 4) {
            g.pause = GUARD.pauseAtWaypoint;
            g.scan = 0;
            g.wpIndex += g.wpDir;
            if (g.wpIndex >= g.path.length || g.wpIndex < 0) {
              g.wpDir *= -1;
              g.wpIndex += 2 * g.wpDir;
            }
          } else {
            const mx = (dx2 / d2) * s.def.guardSpeed * dt;
            const my = (dy2 / d2) * s.def.guardSpeed * dt;
            moveGuard(s, g, mx, my);
            g.dir = Math.atan2(dy2, dx2);
          }
        }

        // A guard that stops making progress while chasing gives up and goes back.
        if (s.alarm) {
          const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
          g.stuck = moved < 2 ? g.stuck + dt : 0;
          g.lastX = g.x;
          g.lastY = g.y;
        }
      }
      s.suspicion = maxSuspicion;

      // Alarm: triggered by any guard at full suspicion.
      if (!s.alarm && maxSuspicion >= 100) {
        s.alarm = true;
        s.alarmTimer = GUARD.alarmSeconds;
        s.loseSightTimer = 0;
      }
      if (s.alarm) {
        s.alarmTimer -= dt;
        if (anySees) s.loseSightTimer = 0;
        else s.loseSightTimer += dt;
        if (s.loseSightTimer >= GUARD.loseSightSeconds || s.alarmTimer <= 0) {
          s.alarm = false;
          for (const g of s.guards) {
            g.suspicion = 35;
            g.stuck = 0;
          }
        }
      }

      // Caught during the alarm.
      if (s.alarm) {
        for (const g of s.guards) {
          if (Math.hypot(p.x - g.x, p.y - g.y) < GUARD.catchRadius) {
            return this.caught();
          }
        }
      }

      // Intel pickups.
      for (const item of s.intel) {
        if (!item.taken && Math.hypot(p.x - item.x, p.y - item.y) < PLAYER.pickupRadius) {
          item.taken = true;
          s.score += 500;
        }
      }

      // Exit, once all intel is taken.
      const allTaken = s.intel.every((item) => item.taken);
      if (allTaken) {
        const ex = Math.floor(p.x / TILE);
        const ey = Math.floor(p.y / TILE);
        const tx = Math.floor(s.exit.x / TILE);
        const ty = Math.floor(s.exit.y / TILE);
        if (ex === tx && ey === ty) {
          s.score += 1000 + Math.max(0, 2000 - Math.floor(s.elapsed) * 25);
          s.status = 'clear';
          this.totalScore += s.score;
          if (this.levelIndex >= LEVELS.length - 1) {
            s.status = 'win';
            return EVENT_CLEAR | EVENT_WIN;
          }
          return EVENT_CLEAR;
        }
      }
      return 0;
    },
    caught() {
      const s = this.state;
      s.attemptsLeft -= 1;
      if (s.attemptsLeft <= 0) {
        s.status = 'over';
        return EVENT_CAUGHT | EVENT_GAMEOVER;
      }
      const levelIndex = this.levelIndex;
      this.reset(levelIndex);
      this.state.attemptsLeft = s.attemptsLeft;
      return EVENT_CAUGHT;
    },
    nextLevel() {
      this.levelIndex += 1;
      this.reset(this.levelIndex);
    },
  };
  return world;
}

function defChaseSpeed(s) {
  return s.def.chaseSpeed;
}

function moveGuard(s, g, mx, my) {
  if (!circleHitsSolid(s.map, g.x + mx, g.y, GUARD.radius)) g.x += mx;
  if (!circleHitsSolid(s.map, g.x, g.y + my, GUARD.radius)) g.y += my;
}

export { STEP };
