// The wanted system and the Solmar Bay Police Department. Crimes raise the
// star level; patrol cars spawn on the road grid, chase the player, ram their
// car, and try to bust them on foot. Lose the police and the heat cools off.
import * as THREE from 'three';
import { CITY, WANTED } from './config.js';
import { makeCar } from './vehicles.js';
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

export function updatePolice(police, scene, rng, roadLines, colliders, player, dt, effects, audio, onBusted) {
  // Keep the number of patrol cars matched to the wanted level.
  const wantCount = police.level === 0 ? 0 : Math.min(2 + police.level, 7);
  police.spawnTimer -= dt;
  if (police.cars.length < wantCount && police.spawnTimer <= 0) {
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
    if (car.mesh.userData.lightBar) {
      const on = Math.floor(performance.now() / 260) % 2 === 0;
      car.mesh.userData.lightBar.material.color.setHex(on ? 0xff2e2e : 0x550000);
      car.mesh.userData.lightBar2.material.color.setHex(on ? 0x000055 : 0x2e6fff);
    }
    if (car.health < 40 && Math.random() < dt * 3) effects.smoke(car.pos.clone().setY(1.4), 1);
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.2;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
  // Remove dead patrol cars once they have stopped.
  police.cars = police.cars.filter((c) => !c.dead || c.speed > 0.5);
  for (const car of police.cars) {
    if (car.dead) car.speed = Math.max(0, car.speed - 12 * dt);
  }
  // When the heat is fully gone, the remaining patrol cars give up and drive
  // off instead of circling the player forever.
  if (police.level === 0 && police.cars.length > 0) {
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
