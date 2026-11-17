// Cars: a small factory that builds stylized vehicles from boxes and cylinders,
// the traffic manager that drives them along the road grid, and the arcade
// driving model the player uses when they steal one.
import * as THREE from 'three';
import { CAR, CITY, PALETTE } from './config.js';
import { resolveCircleCollisions } from './city.js';

const KINDS = {
  sedan: { length: 4.4, width: 1.9, height: 1.35, cabin: 0.95 },
  sport: { length: 4.1, width: 1.95, height: 1.05, cabin: 0.8 },
  taxi: { length: 4.4, width: 1.9, height: 1.35, cabin: 0.95 },
  truck: { length: 6.4, width: 2.3, height: 2.1, cabin: 1.4 },
  police: { length: 4.6, width: 2.0, height: 1.4, cabin: 0.95 },
  van: { length: 5.2, width: 2.1, height: 2.0, cabin: 1.2 },
};

export function buildCarMesh(kind, color) {
  const spec = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.55, spec.length), paint);
  body.position.y = spec.height * 0.45;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.82, spec.cabin, spec.length * 0.5), glass);
  cabin.position.set(0, spec.height * 0.72 + spec.cabin * 0.32, -spec.length * 0.06);
  group.add(cabin);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx * (spec.width / 2 - 0.08), 0.36, wz * spec.length * 0.32);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so cars read at dusk.
  const lightGeo = new THREE.BoxGeometry(0.34, 0.18, 0.06);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(s * spec.width * 0.32, spec.height * 0.42, spec.length / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(s * spec.width * 0.32, spec.height * 0.42, -spec.length / 2 - 0.02);
    group.add(tail);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    bar.position.set(0, spec.height + spec.cabin * 0.6, -spec.length * 0.06);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2e6fff }));
    bar2.position.set(0.55, spec.height + spec.cabin * 0.6, -spec.length * 0.06);
    group.add(bar2);
    group.userData.lightBar = bar;
    group.userData.lightBar2 = bar2;
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xf2c200 }));
    sign.position.set(0, spec.height + spec.cabin * 0.62, -spec.length * 0.06);
    group.add(sign);
  }
  group.userData = { ...group.userData, wheels, kind, length: spec.length, width: spec.width };
  return group;
}

// One car in the world: position, heading, speed, health, and its mesh.
export function makeCar(scene, kind, color, x, z, heading) {
  const mesh = buildCarMesh(kind, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    kind, mesh, color,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    health: 100,
    dead: false,
    parked: false,
    driver: null,      // 'player' | 'traffic' | 'police' | null
    honkTimer: 0,
    smokeTimer: 0,
  };
  // The raycaster resolves a hit on any child part back to this car.
  mesh.userData.ref = car;
  return car;
}

// Traffic: cars that cruise the road grid, turn at intersections, and slow down
// for the car ahead. They give way to nothing else — Solmar Bay drivers.
export function createTraffic(scene, rng, roadLines, colliders, count) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const line = rng.pick(roadLines);
    const horizontal = rng.chance(0.5);
    const lane = rng.chance(0.5) ? 2.6 : -2.6;
    const along = rng.range(-CITY.half, CITY.half);
    const x = horizontal ? along : line + lane;
    const z = horizontal ? line + lane : along;
    const heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
    const car = makeCar(scene, rng.pick(kinds), rng.pick(PALETTE.carPaint), x, z, heading);
    car.driver = 'traffic';
    car.horizontal = horizontal;
    car.line = line;
    car.lane = lane;
    car.speed = rng.range(7, 12);
    car.targetSpeed = car.speed;
    cars.push(car);
  }
  // Parked cars the player can steal, lined up along quieter streets.
  const parked = [];
  for (let i = 0; i < 8; i += 1) {
    const line = roadLines[rng.int(1, CITY.blocks - 1)];
    const horizontal = rng.chance(0.5);
    const along = rng.range(-CITY.half + 20, CITY.half - 20);
    const x = horizontal ? along : line + 4.4;
    const z = horizontal ? line + 4.4 : along;
    const heading = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const kind = i === 3 ? 'sport' : rng.pick(['sedan', 'sedan', 'sport', 'van']);
    const car = makeCar(scene, kind, i === 3 ? 0xc22e2e : rng.pick(PALETTE.carPaint), x, z, heading);
    car.driver = null;
    car.parked = true;
    parked.push(car);
  }
  return { cars, parked };
}

function nearestAhead(car, others, lookAhead) {
  let best = null;
  let bestD = lookAhead;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = o.pos.x - car.pos.x;
    const dz = o.pos.z - car.pos.z;
    const forward = dx * fx + dz * fz;
    if (forward <= 0 || forward > lookAhead) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > 2.4) continue;
    if (forward < bestD) { bestD = forward; best = o; }
  }
  return best;
}

export function updateTraffic(traffic, allCars, playerPos, dt, colliders) {
  for (const car of traffic.cars) {
    // Only cars still driven by traffic cruise the grid: a car the player stole
    // (driver 'player') or abandoned (driver null) stays where it was left.
    if (car.dead || car.driver !== 'traffic') continue;
    // Slow down for the car ahead, and for the player when they block the road.
    const ahead = nearestAhead(car, allCars, 14);
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += Math.max(-14 * dt, Math.min(8 * dt, want - car.speed));
    // At an intersection (the along-coordinate is near a grid line), sometimes
    // turn onto the crossing road.
    const along = car.horizontal ? car.pos.x : car.pos.z;
    const phase = (((along + CITY.half) % CITY.pitch) + CITY.pitch) % CITY.pitch;
    const nearGrid = Math.min(phase, CITY.pitch - phase) < 1.4;
    if (nearGrid && Math.random() < dt * 0.06) {
      const newLane = car.lane;
      car.horizontal = !car.horizontal;
      if (car.horizontal) {
        car.pos.z = Math.round((car.pos.z + CITY.half) / CITY.pitch) * CITY.pitch - CITY.half + newLane;
        car.heading = newLane > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.pos.x = Math.round((car.pos.x + CITY.half) / CITY.pitch) * CITY.pitch - CITY.half + newLane;
        car.heading = newLane > 0 ? Math.PI : 0;
      }
    }
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    // U-turn at the city edge instead of driving into the bay.
    if (Math.abs(car.pos.x) > CITY.bound || Math.abs(car.pos.z) > CITY.bound) {
      car.heading += Math.PI;
      car.pos.x = Math.max(-CITY.bound, Math.min(CITY.bound, car.pos.x));
      car.pos.z = Math.max(-CITY.bound, Math.min(CITY.bound, car.pos.z));
    }
    resolveCircleCollisions(car.pos, 1.7, colliders || []);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
  }
}

// Arcade driving for the player's car: throttle, steering that tightens with
// speed, handbrake slides, and building collisions that cost speed and health.
export function drivePlayerCar(car, input, dt, colliders, effects, audio, onCrash) {
  const axes = input.axes();
  const throttle = axes.forward;
  const steering = axes.strafe;
  const braking = input.held('brake');
  const boosting = input.held('run');
  const maxSpeed = CAR.maxSpeed * (boosting ? 1.12 : 1);
  if (throttle > 0) car.speed += CAR.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) car.speed += (car.speed > 0.5 ? -CAR.brake : -CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (braking) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.steer = steering * 1.4;
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(maxSpeed, car.speed));
  const steerTarget = steering * CAR.steerRate * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * dt * Math.sign(car.speed) * (braking ? 1.5 : 1);
  const before = car.pos.clone();
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  // Buildings stop the car; a hard hit damages it and shakes the camera.
  resolveCircleCollisions(car.pos, 1.7, colliders);
  const hit = car.pos.distanceTo(before) < Math.abs(car.speed) * dt * 0.55;
  if (hit && Math.abs(car.speed) > 6) {
    car.health -= Math.abs(car.speed) * 0.7;
    audio.crash();
    effects.burst(car.pos.clone().setY(1), 0xffc832, 10, 5, 0.5);
    if (onCrash) onCrash(Math.abs(car.speed));
    car.speed *= 0.35;
  }
  if (car.health < 45 && Math.random() < dt * 2) {
    effects.smoke(car.pos.clone().setY(1.4), 1);
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * 0.06 * Math.sign(car.speed);
  const spin = car.speed * dt * 2.2;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.mesh.userData.wheels.length >= 2) {
    car.mesh.userData.wheels[0].rotation.y = car.steer * 0.28;
    car.mesh.userData.wheels[1].rotation.y = car.steer * 0.28;
  }
}
