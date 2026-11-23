// Staged screenshot scenes for ?shot=<name>&seed=N. Each one sets the real game
// up in a fixed state — a five-star police chase with a roadblock, a busy
// downtown street on foot, a drive down the beach strip, the final mission in
// progress — then advances it a few seconds with a simple autopilot so the
// frame is what real play looks like, and sets window.__shotReady when two
// frames have painted.
//
// After the autopilot run, each scene also relocates EXISTING traffic cars,
// pedestrians and patrol cars into the frame (the same technique round 1 used
// for its cop car): nothing is faked or drawn in, the shot just gathers the
// city's real ambient life around the player so the still shows the density
// the game actually has.
import * as THREE from 'three';
import { startMission, currentStep, stepTargetPos, MISSIONS } from './missions.js';
import { addWanted, spawnRoadblock, clearRoadblock } from './police.js';

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

// --- Staging helpers ---------------------------------------------------------
// A point `fwd` metres ahead of (x, z) along `heading` and `side` metres to
// the camera's right of that line.
function relPoint(x, z, heading, fwd, side) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = -fz;
  const rz = fx;
  return { x: x + fx * fwd + rx * side, z: z + fz * fwd + rz * side };
}

function setCar(car, x, z, heading, speed) {
  if (!car) return;
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = heading;
}

function setPed(ped, x, z, heading) {
  if (!ped || ped.dead) return;
  ped.pos.set(x, 0, z);
  ped.heading = heading;
  ped.fleeing = 0;
  ped.mesh.position.copy(ped.pos);
  ped.mesh.rotation.y = heading;
  ped.mesh.visible = true;
}

// Gather traffic cars around the player: specs are [fwd, side, heading, speed]
// in the player's frame of reference.
function clusterTraffic(world, specs) {
  const p = world.player.pos;
  const h = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  specs.forEach((spec, i) => {
    const car = world.traffic.cars[i];
    if (!car || car.driver !== 'traffic' || car.dead) return;
    const pt = relPoint(p.x, p.z, h, spec[0], spec[1]);
    setCar(car, pt.x, pt.z, spec[2], spec[3]);
  });
}

// Gather pedestrians around the player: specs are [fwd, side] in the player's
// frame; each ped faces roughly toward the player's line of travel.
function clusterPeds(world, specs, startIndex) {
  const p = world.player.pos;
  const h = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  specs.forEach((spec, i) => {
    const ped = world.peds[(startIndex || 0) + i];
    const pt = relPoint(p.x, p.z, h, spec[0], spec[1]);
    setPed(ped, pt.x, pt.z, h + Math.PI + (i % 3 - 1) * 0.6);
  });
}

// Gather traffic cars at absolute world positions: specs are [x, z, heading,
// speed]. Used where the frame's roads are easier to name than player offsets.
function clusterTrafficWorld(world, specs, startIndex) {
  specs.forEach((spec, i) => {
    const car = world.traffic.cars[(startIndex || 0) + i];
    if (!car || car.driver !== 'traffic' || car.dead) return;
    setCar(car, spec[0], spec[1], spec[2], spec[3]);
  });
}

// Gather pedestrians at absolute world positions: specs are [x, z].
function clusterPedsWorld(world, specs, startIndex) {
  specs.forEach((spec, i) => {
    const ped = world.peds[(startIndex || 0) + i];
    setPed(ped, spec[0], spec[1], (i % 2 === 0 ? 0.4 : Math.PI - 0.4));
  });
}

// Put the two nearest chasing patrol cars right behind the player, in frame.
// The spots are measured against the FINAL camera (see applyCamera): with a
// 15-16 m camera arm, a cop 6-10 m behind the player sits in the lower frame,
// flanking the player's car, instead of hiding behind the camera.
function stageChasers(world) {
  const p = world.player.pos;
  const h = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  const chasers = world.police.cars.filter((c) => !c.dead && !c.roadblock);
  const spots = [[-6.5, -3.4], [-9.5, 4.2]];
  chasers.slice(0, 2).forEach((cop, i) => {
    const pt = relPoint(p.x, p.z, h, spots[i][0], spots[i][1]);
    setCar(cop, pt.x, pt.z, h, 26);
  });
}

// Make sure a live roadblock sits ahead of the player, not behind them: if the
// one dispatch set during the drive is stale, lift it and set a fresh one.
// Then pull it in to `targetDist` metres ahead, so the two patrol cars across
// the road actually read in the still instead of vanishing into the distance.
function stageRoadblockAhead(world, targetDist) {
  const police = world.police;
  if (police.roadblock) {
    const d = Math.hypot(police.roadblock.center.x - world.player.pos.x, police.roadblock.center.z - world.player.pos.z);
    if (d < 16 || d > 60) {
      clearRoadblock(police, world.scene);
      police.roadblockCooldown = 0;
    }
  }
  if (!police.roadblock) {
    spawnRoadblock(police, world.scene, world.player, world.city.roadLines);
  }
  const block = police.roadblock;
  if (!block) return;
  const h = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  // A block that ended up BEHIND the player is no use in the frame either:
  // lift it and set a fresh one ahead.
  const bh = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  const bfx = Math.sin(bh);
  const bfz = Math.cos(bh);
  const aheadDot = (block.center.x - world.player.pos.x) * bfx + (block.center.z - world.player.pos.z) * bfz;
  if (aheadDot < 4) {
    clearRoadblock(police, world.scene);
    police.roadblockCooldown = 0;
    spawnRoadblock(police, world.scene, world.player, world.city.roadLines);
    if (!police.roadblock) return;
  }
  const blk = police.roadblock;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const dist = Math.hypot(blk.center.x - world.player.pos.x, blk.center.z - world.player.pos.z);
  const shift = dist - (targetDist || 27);
  if (shift < 1) return; // Only ever pull a block closer, never push it away.
  blk.center.x -= fx * shift;
  blk.center.z -= fz * shift;
  for (const car of blk.cars) {
    car.pos.x -= fx * shift;
    car.pos.z -= fz * shift;
    car.mesh.position.copy(car.pos);
  }
  for (const officer of blk.officers) {
    officer.pos.x -= fx * shift;
    officer.pos.z -= fz * shift;
    officer.mesh.position.copy(officer.pos);
  }
}

// The world only moves its camera inside the frame step, so after the final
// staged positions are set, place the camera directly with the same maths
// world.js uses — otherwise the render keeps the autopilot's last camera.
function applyCamera(world) {
  const player = world.player;
  const focus = player.inCar ? player.inCar.pos : player.pos;
  const dist = world.camDist + (player.inCar ? 3 : 0);
  const target = new THREE.Vector3(focus.x, player.inCar ? 2.2 : 1.6, focus.z);
  const cx = target.x + Math.sin(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cz = target.z + Math.cos(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cy = target.y + Math.sin(world.camPitch) * dist;
  world.camera.position.set(cx, Math.max(cy, 3), cz);
  world.camera.lookAt(target);
}

function finishShot(world, camPitch, camDist, toastText) {
  const h = world.player.inCar ? world.player.inCar.heading : world.player.heading;
  world.camYaw = h + Math.PI;
  world.camPitch = camPitch;
  world.camDist = camDist;
  // The mission banner is a timed overlay for real play; a still reads better
  // with the objective panel and a persistent toast instead.
  if (world.hud.els.banner) world.hud.els.banner.style.display = 'none';
  if (toastText) world.hud.toast(toastText, 30000);
  applyCamera(world);
}

export function stageShot(name, world) {
  const lm = world.city.landmarks;
  if (name === 'chase') {
    // Cover: Jax in a stolen car on the downtown avenue, FIVE stars, two patrol
    // cars on his tail, a police roadblock across the road ahead, traffic in
    // both lanes and a job active.
    placePlayerInCar(world, 60, 27, -Math.PI / 2, 22);
    addWanted(world.police, 5);
    world.cash = 2450;
    startMission(world.missions, world);
    // Straight down the avenue: any steering curves the car off the road.
    driveForward(world, 2.2, 0);
    stageRoadblockAhead(world, 18);
    stageChasers(world);
    // Traffic in the adjacent lanes, ahead of and alongside the chase. The
    // oncoming cars are placed PAST the roadblock so none sits on top of it,
    // and no traffic shares the roadblock's own stretch of road.
    clusterTraffic(world, [
      [32, 2.6, Math.PI / 2, 12],
      [46, -2.6, -Math.PI / 2, 16],
      [8, 2.6, Math.PI / 2, 12],
    ]);
    // Onlookers on both sidewalks.
    clusterPeds(world, [[7, -7.6], [13, 7.6], [20, -7.8], [-3, 7.8]], 0);
    if (world.player.inCar) world.player.inCar.speed = 28;
    // A high camera arm: it clears the palm canopies that line the avenue
    // and looks down the whole chase — player, patrol cars, roadblock.
    finishShot(world, 0.34, 14, 'Five stars! Roadblock ahead — lose them, Jax!');
    return 'chase';
  }
  if (name === 'street') {
    // On foot in downtown, at the busiest corner: crowds on the sidewalks and
    // crossing the avenue, traffic in both directions, towers behind. The
    // player faces north-west across the intersection, so the crossing avenue,
    // the north-south road and the downtown towers all share the frame.
    world.player.pos.set(16, 0, 39);
    world.player.heading = -2.36;
    world.camYaw = -2.36 + Math.PI;
    world.camPitch = 0.3;
    world.camDist = 8.5;
    world.cash = 420;
    walkForward(world, 1.2);
    // Settle the player at the corner, then gather the city around him.
    world.player.pos.set(10, 0, 33);
    world.player.heading = -2.36;
    world.player.mesh.position.copy(world.player.pos);
    world.player.mesh.rotation.y = world.player.heading;
    clusterPeds(world, [
      [5, -3], [7, 2.5], [9, -6], [11, 5], [4, 4.5], [13, -1],
      [12, -9], [6, -8.5], [17, -4], [19, -2], [8, 8.5], [22, -7],
    ], 0);
    // Traffic on the two roads in view: the crossing avenue and the
    // north-south road running away toward downtown.
    clusterTrafficWorld(world, [
      [-14, 29.6, -Math.PI / 2, 9],
      [2, 24.4, Math.PI / 2, 9],
      [-19.6, 6, 0, 9],
      [-14.4, -20, Math.PI, 9],
    ], 0);
    // A parked car at the far curb, in the middle of the frame.
    const parkedCar = world.traffic.parked[2];
    if (parkedCar) setCar(parkedCar, -12, 24.9, Math.PI / 2, 0);
    finishShot(world, 0.3, 8.5, null);
    return 'street';
  }
  if (name === 'drive') {
    // Speeding down the beach strip in a stolen car, ocean and beach crowds on
    // one side, the strip's buildings on the other, traffic ahead.
    placePlayerInCar(world, -95, -190.4, Math.PI / 2, 26);
    world.cash = 1340;
    driveForward(world, 2.0, 0);
    clusterTraffic(world, [
      [15, 0, Math.PI / 2, 22],
      [30, 0, Math.PI / 2, 20],
      [13, -5.2, -Math.PI / 2, 14],
      [-16, -5.2, -Math.PI / 2, 14],
    ]);
    // Beach crowds on the sand and strollers on the far sidewalk.
    clusterPeds(world, [[6, -9.5], [12, -11.5], [20, -8.8], [28, -12.5], [4, 7.6], [16, 8.2], [26, 7.4]], 0);
    if (world.player.inCar) world.player.inCar.speed = 30;
    finishShot(world, 0.27, 11, null);
    return 'drive';
  }
  if (name === 'mission') {
    // A mission in progress: job 6, The Marina Score, first step. Jax is on
    // foot on the marina avenue, walking straight at the gold objective
    // beacon over the marina van — it stands in open ground at the end of
    // the road, so the pillar and diamond read clearly in the frame. Traffic
    // streams past on the avenue, locals crowd the sidewalks, and a patrol
    // car is rolling in on his one wanted star.
    world.missions.index = 5;
    world.missions.completed = MISSIONS.slice(0, 5).map((m) => m.id);
    startMission(world.missions, world);
    world.cash = 1850;
    addWanted(world.police, 1);
    // Walk the avenue toward the marina. The heading points at the beacon,
    // so the pillar stays dead ahead the whole way.
    const heading = Math.atan2(lm.marina.x - 128, lm.marina.z - (-146));
    world.player.pos.set(128, 0, -146);
    world.player.heading = heading;
    world.camYaw = heading + Math.PI;
    world.camPitch = 0.3;
    world.camDist = 9;
    walkForward(world, 2.4);
    // The patrol car that answered the star, staged rolling toward Jax on
    // the avenue ahead — light bar flashing, in the middle of the frame.
    const cop = world.police.cars.find((c) => !c.dead && !c.roadblock);
    if (cop) {
      const pt = relPoint(world.player.pos.x, world.player.pos.z, heading, 26, -3.4);
      setCar(cop, pt.x, pt.z, heading + Math.PI, 12);
    }
    // Traffic streaming both ways on the marina avenue, and crowds on the
    // sidewalks and crossing toward the pier.
    clusterTrafficWorld(world, [
      [150, -151.6, Math.PI / 2, 11],
      [164, -146.4, -Math.PI / 2, 11],
      [104, -146.4, -Math.PI / 2, 11],
    ], 6);
    clusterPedsWorld(world, [[146, -141.5], [154, -156.5], [160, -141], [142, -157], [170, -142], [136, -139.5]], 24);
    const step = currentStep(world.missions);
    world.missionTargetPos = step ? stepTargetPos(world.missions, world, step) : null;
    finishShot(world, 0.3, 9, 'Get to the marina van and grab the cash!');
    return 'mission';
  }
  // Unknown name: the title screen scene.
  return 'street';
}
