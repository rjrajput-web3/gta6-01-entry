// Keyboard and mouse input: held keys, edge-triggered actions, and camera orbit
// from mouse drags. The game never needs pointer lock, so it works in any browser.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let dragDx = 0;
  let dragDy = 0;
  let wheelDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let mouseDown = false;
  let mouseDownAt = 0;

  const CODE_TO_KEY = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'brake',
    KeyE: 'enter',
    KeyF: 'attack',
    KeyM: 'mute',
    Escape: 'pause',
    KeyP: 'pause',
  };

  window.addEventListener('keydown', (event) => {
    const key = CODE_TO_KEY[event.code];
    if (!key) return;
    // Keep arrows and space from scrolling the page while playing.
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    const key = CODE_TO_KEY[event.code];
    if (key) keys.delete(key);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    mouseDown = true;
    mouseDownAt = performance.now();
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', (event) => {
    dragging = false;
    // A quick click (not a drag) is a shot: the pistol fires through the crosshair.
    if (mouseDown && performance.now() - mouseDownAt < 220 && Math.abs(event.clientX - lastX) < 6) {
      pressed.add('shoot');
    }
    mouseDown = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragDx += event.clientX - lastX;
    dragDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheelDelta += event.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held(key) { return keys.has(key); },
    // Movement axes in camera space: forward/back and strafe, each -1..1.
    axes() {
      const f = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
      const s = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      return { forward: f, strafe: s };
    },
    // Edge-triggered actions pressed since the last call; clears the set.
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    // Camera orbit deltas accumulated since the last call (pixels).
    takeDrag() {
      const out = { dx: dragDx, dy: dragDy };
      dragDx = 0;
      dragDy = 0;
      return out;
    },
    takeWheel() {
      const out = wheelDelta;
      wheelDelta = 0;
      return out;
    },
  };
}
