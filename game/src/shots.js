// Staged screenshot scenes for ?shot=<name>&seed=N. Each one sets the real game
// up in a fixed state — a police chase, a walk through downtown, a drive down
// the beach strip, a mission in progress — then advances it a few seconds with a
// simple autopilot so the frame is what real play looks like, and sets
// window.__shotReady when two frames have painted.
import * as THREE from 'three';
import { startMission, currentStep, stepTargetPos } from './missions.js';
import { addWanted } from './police.js';

const SIM_STEP = 1 / 60;

function placePlayerInCar(world, x, z, heading, speed) {
  const car = world.traffic.parked[1] || world.allCars[0];
  car.driver = 'player';
  car.parked = false;
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed;
  car.health = 100;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = heading;
  world.player.inCar = car;
  world.player.mesh.visible = false;
  world.player.pos.copy(car.pos);
  world.camYaw = heading + Math.PI;
  world.camPitch = 0.3;
  world.camDist = 10;
}

function driveForward(world, seconds, steer) {
  const input = {
    axes: () => ({ forward: 1, strafe: steer || 0 }),
    held: (k) => k === 'run',
    takePressed: () => new Set(),
    takeDrag: () => ({ dx: 0, dy: 0 }),
    takeWheel: () => 0,
  };
  for (let i = 0; i < seconds / SIM_STEP; i += 1) {
    world._stepForShot(input, SIM_STEP);
  }
}

function walkForward(world, seconds) {
  const input = {
    axes: () => ({ forward: 1, strafe: 0 }),
    held: () => false,
    takePressed: () => new Set(),
    takeDrag: () => ({ dx: 0, dy: 0 }),
    takeWheel: () => 0,
  };
  for (let i = 0; i < seconds / SIM_STEP; i += 1) {
    world._stepForShot(input, SIM_STEP);
  }
}

export function stageShot(name, world) {
  const lm = world.city.landmarks;
  if (name === 'chase') {
    // Cover: Jax in a stolen car on the downtown avenue, 3 stars, patrol cars
    // closing in, job active. The car starts in-lane so it can build speed.
    placePlayerInCar(world, 60, 27, -Math.PI / 2, 22);
    addWanted(world.police, 3);
    world.cash = 2450;
    startMission(world.missions, world);
    // Straight down the avenue: any steering curves the car off the road.
    driveForward(world, 2.5, 0);
    // Pull the nearest patrol car into the frame, just behind the player's car.
    const cop = world.police.cars.find((c) => !c.dead);
    if (cop && world.player.inCar) {
      cop.pos.set(world.player.pos.x + 6, 0, world.player.pos.z + 3);
      cop.heading = world.player.inCar.heading;
      cop.speed = 24;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.heading;
    }
    world.camPitch = 0.26;
    world.camDist = 11;
    world.hud.toast('Lose the tail — get to the marina!');
    return 'chase';
  }
  if (name === 'street') {
    // On foot downtown, on the sidewalk by the avenue, towers and traffic around.
    world.player.pos.set(10, 0, 34);
    world.player.heading = Math.PI * 0.9;
    world.camYaw = Math.PI * 0.9 + Math.PI;
    world.camPitch = 0.28;
    world.camDist = 8;
    world.cash = 150;
    walkForward(world, 2.0);
    return 'street';
  }
  if (name === 'drive') {
    // Speeding down the beach strip in the red sports car, ocean on the left.
    // The car starts in-lane on the southern avenue, heading east.
    placePlayerInCar(world, -80, -190.4, Math.PI / 2, 26);
    world.player.inCar.pos.set(-80, 0, -190.4);
    world.cash = 980;
    driveForward(world, 2.5, 0);
    return 'drive';
  }
  if (name === 'mission') {
    // Mission in progress: the package run (job 2). The player has just picked
    // the package up at the market, so the beacon sits over the docks and the
    // delivery timer is running, with one wanted star for flavour.
    world.missions.index = 1;
    world.missions.completed = ['first-wheels'];
    startMission(world.missions, world);
    // Walk into the market marker to collect the package and start the delivery.
    // The market sits on the street corner, so the walk stays on the road.
    world.player.pos.set(lm.market.x - 6, 0, lm.market.z);
    world.player.heading = Math.PI / 2;
    world.camYaw = Math.PI / 2 + Math.PI;
    world.camPitch = 0.3;
    world.camDist = 9;
    world.cash = 650;
    addWanted(world.police, 1);
    walkForward(world, 1.2);
    const step = currentStep(world.missions);
    world.missionTargetPos = step ? stepTargetPos(world.missions, world, step) : null;
    return 'mission';
  }
  // Unknown name: the title screen scene.
  return 'street';
}
