// Shadow Protocol: configuration and levels.
// Top-down stealth: stay out of the guards' vision cones, grab the intel, reach the exit.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 19;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walkSpeed: 150,
  sneakSpeed: 85,
  pickupRadius: 22,
};

export const GUARD = {
  radius: 12,
  visionRange: 195,
  fov: (75 * Math.PI) / 180,
  pauseAtWaypoint: 0.9,
  catchRadius: 17,
  alarmSeconds: 6,
  loseSightSeconds: 3,
};

// Suspicion 0..100. Rates per second.
export const DETECT = {
  // base fill rate when the player is dead-centre in a cone, at point blank
  maxRate: 95,
  // fill scales down with distance; at the edge of the range it is this fraction
  edgeRate: 0.25,
  decayRate: 26,
  sneakFactor: 0.45,
  shadowFactor: 0.5,
  // walking (not sneaking) close to a guard is heard
  hearRadius: 95,
  hearRate: 22,
};

// Map legend: '#' wall, '.' floor, 's' shadow floor, 'C' crate,
// 'I' intel, 'E' exit, 'P' player start, '1'..'4' guard spawns.
export const LEVELS = [
  {
    name: 'LEVEL 1 — WAREHOUSE',
    brief: 'Two guards. Learn the cones, grab 3 intel, slip out unseen.',
    guardSpeed: 62,
    chaseSpeed: 132,
    map: [
      '##############################',
      '#P....s......#.......I.......#',
      '#.............#..............#',
      '#..C......s...#...C......s...#',
      '#.............#..............#',
      '#......I......#......C.......#',
      '#.............#..............#',
      '#..s......C...#...s..........#',
      '#.............#..............#',
      '##########.#########.#########',
      '#............................#',
      '#..C.......s......C......I...#',
      '#............................#',
      '#.....1...........2..........#',
      '#............................#',
      '#..s......C.......s......C...#',
      '#............................#',
      '#......s.........C..........E#',
      '##############################',
    ],
    guards: [
      { spawn: '1', path: [[3, 13], [14, 13]] },
      { spawn: '2', path: [[16, 13], [27, 13]] },
    ],
  },
  {
    name: 'LEVEL 2 — OFFICE FLOOR',
    brief: 'Three guards, tighter patrols. Shadows are your friends.',
    guardSpeed: 74,
    chaseSpeed: 145,
    map: [
      '##############################',
      '#P....#......s.......#.......#',
      '#.....#..............#...I...#',
      '#..C..#..s......C....#.......#',
      '#.....#..............#...s...#',
      '#.....#......I.......#.......#',
      '#####.######.#########.#######',
      '#.....#......s.......#.......#',
      '#..s..#..C...........#...C...#',
      '#.....#..............#.......#',
      '#.....#......C.......#...I...#',
      '######.##########.#####.######',
      '#............................#',
      '#..C......s.......C......s...#',
      '#............................#',
      '#....1..........2.........3..#',
      '#............................#',
      '#..s......C.......s.....C...E#',
      '##############################',
    ],
    guards: [
      { spawn: '1', path: [[5, 15], [11, 15]] },
      { spawn: '2', path: [[13, 15], [20, 15]] },
      { spawn: '3', path: [[22, 15], [27, 15]] },
    ],
  },
  {
    name: 'LEVEL 3 — THE VAULT',
    brief: 'Four guards, no room for error. One clean run.',
    guardSpeed: 86,
    chaseSpeed: 158,
    map: [
      '##############################',
      '#P...#....s....#......I......#',
      '#....#.........#.............#',
      '#.C..#..s...C..#..s......C...#',
      '#....#.........#.............#',
      '#....#....I....#......s......#',
      '####.#####.######.######.#####',
      '#....#.........#.............#',
      '#.s..#..C...s..#..C.......I..#',
      '#....#.........#.............#',
      '#....#....C....#......C......#',
      '####.#####.######.######.#####',
      '#............................#',
      '#..C.....s........C.....s....#',
      '#............................#',
      '#...1........2.........3...4.#',
      '#............................#',
      '#..s.....C........s.....C...E#',
      '##############################',
    ],
    guards: [
      { spawn: '1', path: [[4, 15], [9, 15]] },
      { spawn: '2', path: [[11, 15], [16, 15]] },
      { spawn: '3', path: [[18, 15], [23, 15]] },
      { spawn: '4', path: [[25, 15], [28, 15]] },
    ],
  },
];
