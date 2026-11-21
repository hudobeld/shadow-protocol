// Shadow Protocol: game loop, screens, and the deterministic ?shot= scenes.
import { FIELD, STEP } from './config.js';
import { createWorld, EVENT_CLEAR, EVENT_GAMEOVER, EVENT_WIN } from './world.js';
import { createInput } from './input.js';
import { render, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const world = createWorld();
world.reset(0);

function announce(text) {
  if (status) status.textContent = text;
}

if (shotName) {
  // Deterministic screenshot: stage the scene, draw one frame, stop.
  const staged = stageShot(shotName, world);
  render(ctx, world, staged.screen, 0);
  announce(`Shadow Protocol screenshot: ${shotName}`);
} else {
  const input = createInput();
  let screen = SCREEN_TITLE;
  let last = performance.now();
  let acc = 0;

  function advance() {
    if (screen === SCREEN_TITLE) {
      screen = SCREEN_PLAY;
      announce(`${world.state.def.name}. Collect the intel, reach the exit unseen.`);
    } else if (screen === SCREEN_CLEAR) {
      world.nextLevel();
      screen = SCREEN_PLAY;
      announce(`${world.state.def.name}. Collect the intel, reach the exit unseen.`);
    } else if (screen === SCREEN_OVER) {
      world.reset(world.levelIndex);
      screen = SCREEN_PLAY;
      announce('Try again.');
    } else if (screen === SCREEN_WIN) {
      world.levelIndex = 0;
      world.totalScore = 0;
      world.reset(0);
      screen = SCREEN_TITLE;
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.wasPressed('enter') || input.wasPressed(' ')) advance();
    if (screen === SCREEN_PLAY) {
      if (input.wasPressed('r')) {
        world.reset(world.levelIndex);
        input.clearPressed();
      }
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const move = input.move();
        const events = world.step(STEP, move, input.sneak());
        if (events & EVENT_WIN) screen = SCREEN_WIN;
        else if (events & EVENT_CLEAR) screen = SCREEN_CLEAR;
        else if (events & EVENT_GAMEOVER) screen = SCREEN_OVER;
        if (screen !== SCREEN_PLAY) break;
      }
    }
    render(ctx, world, screen, now / 1000);
    requestAnimationFrame(frame);
  }
  announce('Shadow Protocol. Press Enter to begin.');
  requestAnimationFrame(frame);
}
