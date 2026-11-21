// Keyboard input: held keys as a movement vector, plus edge-triggered presses.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  function down(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.key.toLowerCase());
    keys.add(event.key.toLowerCase());
  }
  function up(event) {
    keys.delete(event.key.toLowerCase());
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return {
    // -1..1 movement vector from WASD / arrows
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sneak() {
      return keys.has('shift');
    },
    // true once per physical press; callers consume it
    wasPressed(key) {
      const hit = pressed.has(key.toLowerCase());
      if (hit) pressed.delete(key.toLowerCase());
      return hit;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
