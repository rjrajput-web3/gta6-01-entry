// The world: builds the scene and owns every system — city, player, traffic,
// pedestrians, police, missions, combat, pickups and effects — and steps them
// together each frame. main.js only runs the loop and the screens around it.
import * as THREE from 'three';
import { CITY, PALETTE, START_CASH, PICKUP_VALUE, PICKUP_COUNT } from './config.js';
import { createRng } from './rng.js';
import { buildCity, resolveCircleCollisions } from './city.js';
import { createPlayer, updatePlayerOnFoot, nearestStealableCar } from './player.js';
import { createTraffic, updateTraffic, drivePlayerCar, makeCar } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addWanted } from './police.js';
import { createMissions, startMission, updateMissions, currentStep, stepTargetPos } from './missions.js';
import { createCombat, shoot, punch, updateCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { saveGame, loadGame } from './save.js';

export function createWorld(canvas, seed, opts) {
  const options = opts || {};
  const rng = createRng(seed);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  // Late-afternoon sun: warm, low, long shadows.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(120, 160, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1));

  const city = buildCity(scene, rng);
  const effects = createEffects(scene);
  const audio = createAudio();
  const hud = createHud();
  const player = createPlayer(scene, city.landmarks.spawn);
  const traffic = createTraffic(scene, rng, city.roadLines, city.colliders, 16);
  const peds = createPedestrians(scene, rng, city.roadLines, 26);
  const police = createPolice(scene);
  const missions = createMissions();
  const combat = createCombat();

  // The red sports car for the repo job, parked at the beach lot.
  const repoCar = makeCar(scene, 'sport', 0xc22e2e, city.landmarks.beachLot.x, city.landmarks.beachLot.z, Math.PI / 2);
  repoCar.driver = null;
  repoCar.parked = true;
  missions.targetCar = repoCar;

  // Cash pickups scattered near landmarks and along the beach strip.
  const pickups = [];
  const pickupSpots = [
    city.landmarks.downtown, city.landmarks.market, city.landmarks.docks,
    city.landmarks.marina, city.landmarks.hideout, city.landmarks.hills,
    { x: -60, z: -120 }, { x: 80, z: 60 }, { x: -120, z: 40 },
    { x: 40, z: -60 }, { x: -40, z: 120 }, { x: 120, z: -100 },
  ];
  pickupSpots.slice(0, PICKUP_COUNT).forEach((spot, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x7dff9b }),
    );
    mesh.position.set(spot.x + rng.range(-4, 4), 1.0, spot.z + rng.range(-4, 4));
    scene.add(mesh);
    pickups.push({ id: i, mesh, pos: mesh.position.clone(), taken: false, spin: rng.range(0, 6) });
  });

  const world = {
    renderer, scene, camera, sun, rng, city, effects, audio, hud,
    player, traffic, peds, police, missions, combat, pickups,
    allCars: [...traffic.cars, ...traffic.parked, repoCar],
    cash: START_CASH,
    playedSeconds: 0,
    missionProgress: { policeDisabled: 0 },
    missionTargetPos: null,
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 9,
    dragTimer: 0,
    shake: 0,
    over: false,
    overKind: null,
    onGameOver: options.onGameOver || (() => {}),
    lastDamageAt: -100,
  };

  // Restore a save, if the player asked to continue.
  if (options.loadSave) {
    const data = loadGame();
    if (data) {
      world.cash = data.cash;
      world.missions.index = data.missionIndex;
      world.missions.completed = data.completed || [];
      player.health = data.health;
      combat.ammo = data.ammo || combat.ammo;
      if (data.wanted) police.level = data.wanted;
      player.pos.set(data.pos.x, 0, data.pos.z);
      player.mesh.position.copy(player.pos);
      world.playedSeconds = data.playedSeconds || 0;
      for (const id of data.pickups || []) {
        const p = pickups[id];
        if (p) { p.taken = true; p.mesh.visible = false; }
      }
    }
  }

  // Screenshot scenes step the world with a scripted input; main.js and
  // shots.js use this instead of reaching into the loop.
  world._stepForShot = (input, dt) => updateWorld(world, input, dt);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return world;
}

function endGame(world, kind, title, text) {
  if (world.over) return;
  world.over = true;
  world.overKind = kind;
  world.audio.fail();
  world.onGameOver(kind, title, text);
}

// One frame of the whole game. `input` is the createInput handle. `pressedSet`,
// when given, is the frame's pressed keys taken once by the main loop, so the
// pause handler and the world never consume each other's keys; screenshot scenes
// call this without one and take the keys from the input instead.
export function updateWorld(world, input, dt, pressedSet) {
  if (world.over) return;
  world.playedSeconds += dt;
  const player = world.player;
  const pressed = pressedSet || input.takePressed();
  const drag = input.takeDrag();
  const wheel = input.takeWheel();

  // Camera orbit: drag to look around, wheel to zoom, and it drifts back
  // behind the car while driving.
  if (drag.dx !== 0 || drag.dy !== 0) {
    world.camYaw -= drag.dx * 0.005;
    world.camPitch = Math.max(0.08, Math.min(1.1, world.camPitch + drag.dy * 0.004));
    world.dragTimer = 2.5;
  }
  world.dragTimer = Math.max(0, world.dragTimer - dt);
  world.camDist = Math.max(5, Math.min(16, world.camDist + wheel * 0.01));

  // Mute toggle.
  if (pressed.has('mute')) world.audio.setMuted(!world.audio.isMuted());

  // Enter / exit a car.
  if (pressed.has('enter')) {
    if (player.inCar) {
      const car = player.inCar;
      car.driver = null;
      car.parked = true;
      car.speed = 0;
      player.inCar = null;
      const side = car.pos.clone();
      side.x += Math.cos(car.heading) * 2.6;
      side.z -= Math.sin(car.heading) * 2.6;
      player.pos.copy(side);
      resolveCircleCollisions(player.pos, 0.6, world.city.colliders);
      player.mesh.position.copy(player.pos);
      world.hud.toast('On foot. Watch the streets.');
    } else {
      const car = nearestStealableCar(player, world.allCars, 4.2);
      if (car) {
        const wasParked = car.parked;
        const wasMoving = car.driver === 'traffic';
        car.driver = 'player';
        car.parked = false;
        player.inCar = car;
        player.mesh.visible = false;
        world.audio.horn();
        // Any theft is a crime the police notice.
        addWanted(world.police, 1);
        if (wasMoving) world.hud.toast('Carjacked! The police saw that.');
        else if (wasParked) world.hud.toast('Stolen! That car is hot now — +1 wanted star.');
        // If this is the repo job's car, the mission notices.
        if (car === world.missions.targetCar) world.hud.toast('That is Mara\'s car. Get it to the garage.');
      } else {
        world.hud.toast('No car close enough. Walk up to one and press E.');
      }
    }
  }

  // Attack: F punches on foot; a mouse click shoots when armed.
  if (pressed.has('attack') || pressed.has('shoot')) {
    if (player.inCar) {
      world.audio.horn();
    } else if (pressed.has('shoot') && world.combat.ammo > 0) {
      const result = shoot(world.combat, world, world.camera);
      if (result && result.kind === 'pedDown') world.hud.toast('A pedestrian is down. The police are coming.');
      if (result && result.kind === 'policeDown') world.hud.toast('Patrol car disabled!');
      if (result && result.kind === 'carDown') world.hud.toast('Car disabled.');
    } else if (pressed.has('attack')) {
      const result = punch(world);
      if (result.kind === 'pedHit') world.hud.toast('You threw a punch.');
    } else {
      world.hud.toast('Out of ammo — grab a cash pickup for more.');
    }
  }

  // Movement: drive, or walk.
  if (player.inCar) {
    const car = player.inCar;
    const prevHealth = car.health;
    drivePlayerCar(car, input, dt, world.city.colliders, world.effects, world.audio, (speed) => {
      if (speed > 14) world.shake = Math.min(1, speed / 30);
    });
    player.pos.copy(car.pos);
    player.heading = car.heading;
    world.audio.engine(Math.abs(car.speed) / 40, true);
    if (car.health <= 0 && prevHealth > 0) {
      car.dead = true;
      world.effects.burst(car.pos.clone().setY(1.2), 0xff8c2e, 30, 10, 1.2);
      world.effects.smoke(car.pos.clone().setY(1.4), 8);
      world.audio.crash();
      player.inCar = null;
      player.mesh.visible = true;
      player.health -= 30;
      player.pos.copy(car.pos).add(new THREE.Vector3(3, 0, 0));
      player.mesh.position.copy(player.pos);
      world.hud.toast('Your car is wrecked! You crawl out, hurt.');
      world.hud.flashDamage();
    }
    // Running over a pedestrian at speed is a crime.
    for (const p of world.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      if (d < 2.1 && Math.abs(car.speed) > 5) {
        p.dead = true;
        p.mesh.visible = false;
        world.effects.burst(p.pos.clone().setY(1), 0xff5d5d, 10, 5, 0.6);
        addWanted(world.police, 1);
        world.hud.toast('You hit a pedestrian! +1 wanted star.');
        world.audio.crash();
        car.speed *= 0.7;
      }
    }
  } else {
    updatePlayerOnFoot(player, input, world.camYaw, dt, world.city.colliders, world.allCars);
    world.audio.engine(0, false);
  }

  // Slow health regen when out of trouble.
  if (world.playedSeconds - world.lastDamageAt > 8 && player.health > 0 && player.health < 100) {
    player.health = Math.min(100, player.health + 2.5 * dt);
  }

  // Traffic, pedestrians, police.
  updateTraffic(world.traffic, world.allCars, player.pos, dt, world.city.colliders);
  updatePedestrians(world.peds, player.pos, player.inCar ? Math.abs(player.inCar.speed) : player.speed, world.combat.gunshotAt, dt);
  updatePolice(world.police, world.scene, world.rng, world.city.roadLines, world.city.colliders, player, dt, world.effects, world.audio, () => {
    endGame(world, 'busted', 'BUSTED', 'The Solmar Bay police hauled you in. Mara will post bail — but the job is blown.');
  });
  updateCombat(world.combat, dt);

  // Cash pickups: walk or drive over one to collect it.
  for (const p of world.pickups) {
    if (p.taken) continue;
    p.spin += dt * 2;
    p.mesh.rotation.y = p.spin;
    p.mesh.position.y = 1.0 + Math.sin(p.spin * 1.4) * 0.15;
    const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
    if (d < 2.4) {
      p.taken = true;
      p.mesh.visible = false;
      world.cash += PICKUP_VALUE;
      world.combat.ammo += 6;
      world.audio.pickup();
      world.effects.sparkle(p.pos.clone());
      world.hud.toast(`+$${PICKUP_VALUE} cash found — and some ammo.`);
    }
  }

  // Mission state, and where its target is for the HUD and minimap.
  const step = currentStep(world.missions);
  world.missionTargetPos = world.missions.active && step ? stepTargetPos(world.missions, world, step) : null;
  updateMissions(world.missions, world, dt);

  // Start the next job automatically when the player is free-roaming near Mara.
  if (!world.missions.active && world.missions.index < 6 && !world.over) {
    const marker = world.city.landmarks.spawn;
    const d = Math.hypot(player.pos.x - marker.x, player.pos.z - marker.z);
    if (d < 6) startMission(world.missions, world);
  }

  // Effects, camera, HUD.
  world.effects.update(dt);
  updateCamera(world, dt);
  world.hud.update(world);

  // Wasted?
  if (player.health <= 0) {
    endGame(world, 'wasted', 'WASTED', 'Solmar Bay got the better of you this time. Mara will remember the effort.');
  }
}

function updateCamera(world, dt) {
  const player = world.player;
  const focus = player.inCar ? player.inCar.pos : player.pos;
  const heading = player.inCar ? player.inCar.heading : player.heading;
  // While driving, the camera settles behind the car unless just dragged.
  if (player.inCar && world.dragTimer <= 0) {
    let diff = (heading + Math.PI) - world.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    world.camYaw += diff * Math.min(1, dt * 1.6);
  }
  const dist = world.camDist + (player.inCar ? 3 : 0);
  const target = focus.clone();
  target.y = player.inCar ? 2.2 : 1.6;
  const cx = target.x + Math.sin(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cz = target.z + Math.cos(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cy = target.y + Math.sin(world.camPitch) * dist;
  // Keep the camera out of buildings: clamp it above the rooftops when needed.
  world.camera.position.set(cx, Math.max(cy, 3), cz);
  if (world.shake > 0) {
    world.camera.position.x += (Math.random() - 0.5) * world.shake * 0.7;
    world.camera.position.y += (Math.random() - 0.5) * world.shake * 0.5;
    world.shake = Math.max(0, world.shake - dt * 2.2);
  }
  world.camera.lookAt(target);
}

export function renderWorld(world) {
  world.renderer.render(world.scene, world.camera);
}

export function autosave(world) {
  saveGame(world);
}
