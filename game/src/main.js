// Boot and the one loop: the game moves between title, play, paused and ended
// screens, and the world advances in fixed 1/60 s steps. With ?shot=<name> it
// stages that scene instead of running the loop, paints it, and sets
// window.__shotReady for a screenshot.
import { createWorld, updateWorld, renderWorld } from './world.js';
import { createInput } from './input.js';
import { saveGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('scene');
const status = document.getElementById('status');
const world = createWorld(canvas, seed, {
  onGameOver: (kind) => {
    if (kind === 'busted') {
      world.cash = Math.max(0, Math.floor(world.cash * 0.7));
      hud.showEnd('BUSTED', 'The police hauled you in and took a cut of your cash. Mara posted bail.');
    } else {
      hud.showEnd('WASTED', 'Solmar Bay got the better of you this time. Your cash stays where it fell.');
      world.cash = Math.max(0, world.cash - 200);
    }
    hud.hideHud();
    saveGame(world);
  },
});
const hud = world.hud;
const input = createInput(canvas);

// Test hook: playtests and screenshots read live state through this handle.
window.__solmar = world;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  stageShot(name, world);
  hud.hideMenu();
  hud.showHud();
  let painted = 0;
  function paint() {
    renderWorld(world);
    hud.update(world);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  const EMPTY_PRESSED = new Set();

  const btnStart = document.getElementById('btn-start');
  const btnContinue = document.getElementById('btn-continue');
  if (!hasSave()) btnContinue.style.display = 'none';

  function startGame(loadSave) {
    world.audio.unlock();
    hud.hideMenu();
    hud.hideEnd();
    hud.showHud();
    screen = 'play';
    if (loadSave) {
      // Rebuild the world from the save: simplest correct route is a reload
      // with the save flag, so the city and systems match the saved state.
      const url = new URL(window.location.href);
      url.searchParams.set('continue', '1');
      window.location.href = url.toString();
      return;
    }
    hud.banner('SOLMAR HEAT', 'Mara Voss has work for you. Get to the marker and press on — or just explore.');
    announce('Playing. Mara Voss has work for you.');
  }

  btnStart.addEventListener('click', () => { world.audio.click(); startGame(false); });
  btnContinue.addEventListener('click', () => { world.audio.click(); startGame(true); });
  document.getElementById('btn-resume').addEventListener('click', () => {
    world.audio.click();
    hud.hidePause();
    screen = 'play';
    announce('Playing.');
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    const ok = saveGame(world);
    document.getElementById('save-note').textContent = ok
      ? `Saved. Cash $${world.cash.toLocaleString('en-US')}, job ${world.missions.index + 1} of 9.`
      : 'Save failed — this browser is blocking storage.';
    world.audio.click();
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    window.location.href = new URL(window.location.pathname, window.location.href).toString();
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    window.location.reload();
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    window.location.href = new URL(window.location.pathname, window.location.href).toString();
  });

  // Continue from a save: the world was built with the saved state already.
  if (params.get('continue') === '1') {
    hud.hideMenu();
    hud.showHud();
    screen = 'play';
    hud.toast('Welcome back, Jax. Mara still has work.');
  }

  function pauseGame() {
    if (screen !== 'play') return;
    screen = 'paused';
    hud.setPauseStats(`Cash $${world.cash.toLocaleString('en-US')} · Job ${Math.min(world.missions.index + 1, 9)} of 9 · ${Math.floor(world.playedSeconds / 60)} min in the city.`);
    hud.showPause();
    announce('Paused.');
  }

  function handleActions(pressed) {
    if (pressed.has('pause')) {
      if (screen === 'play') pauseGame();
      else if (screen === 'paused') {
        hud.hidePause();
        screen = 'play';
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === 'title') {
      // The city idles behind the title: traffic and pedestrians keep moving.
      const idle = { axes: () => ({ forward: 0, strafe: 0 }), held: () => false, takePressed: () => new Set(), takeDrag: () => ({ dx: 0, dy: 0 }), takeWheel: () => 0 };
      while (accumulator >= STEP) {
        updateWorld(world, idle, STEP);
        accumulator -= STEP;
      }
      renderWorld(world);
      return;
    }
    // Take the frame's pressed keys once and hand them to the first sub-step
    // only, so one E press steals a car once instead of once per sub-step.
    const pressed = input.takePressed();
    handleActions(pressed);
    if (screen === 'play') {
      let firstStep = true;
      while (accumulator >= STEP) {
        updateWorld(world, input, STEP, firstStep ? pressed : EMPTY_PRESSED);
        firstStep = false;
        accumulator -= STEP;
        if (world.over) {
          screen = 'ended';
          world.audio.engine(0, false);
          world.audio.siren(false, 0);
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderWorld(world);
    if (screen === 'play') hud.update(world);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') pauseGame();
  });

  announce('Solmar Heat. Press Start Engine to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
