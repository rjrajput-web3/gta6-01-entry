// The wanted system and the Solmar Bay Police Department. Crimes raise the
// star level; patrol cars spawn on the road grid, chase the player, ram their
// car, and try to bust them on foot. At four stars and up, dispatch also sets
// a ROADBLOCK: two patrol cars parked across the road ahead of the player,
// with an officer standing at each car. Lose the police and the heat cools off.
import * as THREE from 'three';
import { CITY, WANTED } from './config.js';
import { makeCar } from './vehicles.js';
import { buildPersonMesh } from './player.js';
import { resolveCircleCollisions } from './city.js';

export function createPolice(scene) {
  return {
    cars: [],
    level: 0,
    heat: 0,              // seconds since the last crime
    decayTimer: 0,
    bustTimer: 0,
    spawnTimer: 0,
    sirenNear: false,
    roadblock: null,      // { center, cars: [], officers: [] } while one is set
    roadblockCooldown: 0, // seconds before dispatch may set another one
  };
}

export function addWanted(police, stars) {
  police.level = Math.min(WANTED.maxStars, police.level + stars);
  police.heat = 0;
  police.decayTimer = 0;
}

function spawnPoliceCar(police, scene, rng, playerPos, roadLines) {
  const line = rng.pick(roadLines);
  const horizontal = rng.chance(0.5);
  // Spawn on a road 55-90 m away so the chase arrives, it does not pop in.
  const dir = rng.chance(0.5) ? 1 : -1;
  const dist = rng.range(55, 90);
  let x;
  let z;
  if (horizontal) {
    x = playerPos.x + dir * dist;
    z = line;
  } else {
    x = line;
    z = playerPos.z + dir * dist;
  }
  x = Math.max(-CITY.bound, Math.min(CITY.bound, x));
  z = Math.max(-CITY.bound, Math.min(CITY.bound, z));
  const car = makeCar(scene, 'police', 0x1c2733, x, z, 0);
  car.driver = 'police';
  car.speed = 10;
  car.maxSpeed = 26 + police.level * 2.5;
  police.cars.push(car);
  return car;
}

// --- Roadblocks -------------------------------------------------------------
// Dispatch sets a roadblock on the road the player is driving, about 36 m
// ahead of them: two patrol cars parked nose-to-tail across the lane, lights
// flashing, and one uniformed officer standing beside each car. It is a real
// obstacle — hit it at speed and the car takes damage and loses most of its
// speed. The block is lifted when the wanted level drops below four stars,
// or when the player gets well clear of it (escaped past it or around it).

export function spawnRoadblock(police, scene, player, roadLines) {
  if (police.roadblock) return police.roadblock;
  const heading = player.inCar ? player.inCar.heading : player.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let cx = player.pos.x + fx * 36;
  let cz = player.pos.z + fz * 36;
  // Snap the block onto the road the player is on, so it never lands inside a
  // block of buildings: east-west travel snaps z to a road line, north-south
  // travel snaps x.
  if (roadLines && roadLines.length) {
    const snap = (v) => roadLines.reduce((best, line) => (Math.abs(line - v) < Math.abs(best - v) ? line : best), roadLines[0]);
    if (Math.abs(fx) > Math.abs(fz)) cz = snap(player.pos.z);
    else cx = snap(player.pos.x);
  }
  cx = Math.max(-CITY.bound, Math.min(CITY.bound, cx));
  cz = Math.max(-CITY.bound, Math.min(CITY.bound, cz));
  if (Math.hypot(cx - player.pos.x, cz - player.pos.z) < 18) return null;
  // The cars sit across the direction of travel: their length runs along the
  // perpendicular, and they are offset to either side of the road centre.
  const px = fz;
  const pz = -fx;
  const across = heading + Math.PI / 2;
  const cars = [];
  const officers = [];
  for (const side of [-1, 1]) {
    const x = cx + px * side * 2.4;
    const z = cz + pz * side * 2.4;
    const car = makeCar(scene, 'police', 0x1c2733, x, z, across);
    car.driver = 'police';
    car.speed = 0;
    car.maxSpeed = 0;
    car.roadblock = true;
    car.hitCooldown = 0;
    police.cars.push(car);
    cars.push(car);
    // An officer in SBPD navy, standing on the shoulder beside the car.
    const mesh = buildPersonMesh(0x1c3a5f, 0x141c28, 0xc98e6a);
    const ox = cx + px * side * 5.6;
    const oz = cz + pz * side * 5.6;
    mesh.position.set(ox, 0, oz);
    mesh.rotation.y = heading + Math.PI;
    scene.add(mesh);
    officers.push({ mesh, pos: new THREE.Vector3(ox, 0, oz) });
  }
  police.roadblock = { center: new THREE.Vector3(cx, 0, cz), cars, officers };
  police.roadblockCooldown = 24;
  return police.roadblock;
}

export function clearRoadblock(police, scene) {
  const block = police.roadblock;
  if (!block) return;
  for (const car of block.cars) {
    scene.remove(car.mesh);
  }
  police.cars = police.cars.filter((c) => !block.cars.includes(c));
  for (const officer of block.officers) {
    scene.remove(officer.mesh);
  }
  police.roadblock = null;
}

function flashLightBar(car) {
  if (!car.mesh.userData.lightBar) return;
  const on = Math.floor(performance.now() / 260) % 2 === 0;
  car.mesh.userData.lightBar.material.color.setHex(on ? 0xff2e2e : 0x550000);
  car.mesh.userData.lightBar2.material.color.setHex(on ? 0x000055 : 0x2e6fff);
}

export function updatePolice(police, scene, rng, roadLines, colliders, player, dt, effects, audio, onBusted) {
  police.roadblockCooldown = Math.max(0, police.roadblockCooldown - dt);
  // Roadblock dispatch: four stars or more and the player is driving — set a
  // block ahead of them. Lift it when the heat drops or they escape clear.
  if (police.roadblock) {
    const d = Math.hypot(police.roadblock.center.x - player.pos.x, police.roadblock.center.z - player.pos.z);
    if (police.level < 4 || d > 85) clearRoadblock(police, scene);
  }
  if (!police.roadblock && police.level >= 4 && player.inCar && police.roadblockCooldown <= 0) {
    spawnRoadblock(police, scene, player, roadLines);
  }
  // Keep the number of patrol cars matched to the wanted level. Roadblock
  // cars are parked, so they do not count toward the chasing pack.
  const chasing = police.cars.filter((c) => !c.roadblock).length;
  const wantCount = police.level === 0 ? 0 : Math.min(2 + police.level, 7);
  police.spawnTimer -= dt;
  if (chasing < wantCount && police.spawnTimer <= 0) {
    spawnPoliceCar(police, scene, rng, player.pos, roadLines);
    police.spawnTimer = 1.6;
  }
  police.sirenNear = false;
  let closest = Infinity;
  for (const car of police.cars) {
    if (car.dead) continue;
    const target = player.inCar ? player.inCar.pos : player.pos;
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    closest = Math.min(closest, dist);
    if (dist < 70) police.sirenNear = true;
    if (car.roadblock) {
      // Parked across the road: it does not chase, but it is solid trouble.
      // A fast hit wrecks speed and costs the player's car real damage.
      flashLightBar(car);
      car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
      if (player.inCar && dist < 3.4 && Math.abs(player.inCar.speed) > 7 && car.hitCooldown <= 0) {
        const victim = player.inCar;
        victim.health -= Math.abs(victim.speed) * 0.5;
        victim.speed *= 0.3;
        car.hitCooldown = 1.2;
        audio.crash();
        effects.burst(victim.pos.clone().setY(1), 0xffc832, 12, 5, 0.5);
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      continue;
    }
    // Chase steering: aim at the player, with a little wobble so they feel human.
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1.6, Math.min(1.6, diff * 1.4));
    car.heading += steer * dt * Math.min(1, car.speed / 6 + 0.3);
    const accel = dist > 26 ? 15 : 9;
    car.speed = Math.min(car.maxSpeed, car.speed + accel * dt);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    resolveCircleCollisions(car.pos, 1.7, colliders);
    // Ram the player's car: a hard hit damages it and shoves it.
    if (player.inCar && dist < 3.4 && car.speed > 6) {
      const victim = player.inCar;
      victim.health -= car.speed * 0.55;
      victim.speed *= 0.55;
      audio.crash();
      effects.burst(victim.pos.clone().setY(1), 0xffc832, 8, 4, 0.4);
      car.speed *= 0.5;
      car.heading += 0.3;
    }
    // On foot, a patrol car that stays on top of the player busts them.
    if (!player.inCar && dist < 3.2) {
      police.bustTimer += dt;
      if (police.bustTimer >= WANTED.bustSeconds && onBusted) onBusted();
    } else if (!player.inCar) {
      police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    }
    // Flash the light bar red/blue while in pursuit.
    flashLightBar(car);
    if (car.health < 40 && Math.random() < dt * 3) effects.smoke(car.pos.clone().setY(1.4), 1);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.2;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
  // Officers at a roadblock stand their ground and face the traffic.
  if (police.roadblock) {
    for (const officer of police.roadblock.officers) {
      officer.mesh.position.copy(officer.pos);
    }
  }
  // Remove dead patrol cars once they have stopped.
  police.cars = police.cars.filter((c) => !c.dead || c.speed > 0.5);
  if (police.roadblock) {
    police.roadblock.cars = police.roadblock.cars.filter((c) => police.cars.includes(c));
    if (police.roadblock.cars.length === 0) {
      for (const officer of police.roadblock.officers) scene.remove(officer.mesh);
      police.roadblock = null;
    }
  }
  for (const car of police.cars) {
    if (car.dead) car.speed = Math.max(0, car.speed - 12 * dt);
  }
  // When the heat is fully gone, the remaining patrol cars give up and drive
  // off instead of circling the player forever.
  if (police.level === 0 && police.cars.length > 0) {
    if (police.roadblock) clearRoadblock(police, scene);
    police.cars = police.cars.filter((car) => {
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d > 90) {
        scene.remove(car.mesh);
        return false;
      }
      return true;
    });
  }
  // Wanted decay: no crime for a while and no patrol car close, stars fall.
  police.heat += dt;
  if (police.level > 0 && police.heat > WANTED.decayDelay && closest > 45) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayStep) {
      police.level -= 1;
      police.decayTimer = 0;
      police.heat = WANTED.decayDelay;
    }
  }
  audio.siren(police.sirenNear && police.level > 0, dt);
}
