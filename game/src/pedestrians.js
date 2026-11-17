// Pedestrians: Solmar Bay locals strolling the sidewalks, who scatter when a
// car comes at them or a shot goes off. They are also what the wanted system
// watches: hit one and the police notice.
import * as THREE from 'three';
import { CITY } from './config.js';
import { buildPersonMesh } from './player.js';

const SHIRTS = [0x3a7bd5, 0xe07a5f, 0x81b29a, 0xf2cc8f, 0x9b5de5, 0xef476f, 0x06d6a0, 0xdddddd];
const PANTS = [0x2a3442, 0x4a3b2a, 0x3a3a3a, 0x5a6a7a];
const SKINS = [0xc98e6a, 0x8a5a3b, 0xe8b88a, 0x6e4423];

export function createPedestrians(scene, rng, roadLines, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const line = rng.pick(roadLines);
    const horizontal = rng.chance(0.5);
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-CITY.half, CITY.half);
    const x = horizontal ? along : line + side * (CITY.road / 2 + 2.2);
    const z = horizontal ? line + side * (CITY.road / 2 + 2.2) : along;
    const mesh = buildPersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick(SKINS));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.9),
      walkPhase: rng.range(0, 6),
      health: 100,
      dead: false,
      fleeing: 0,
      wanderTimer: rng.range(2, 6),
      horizontal,
      side,
      line,
    };
    // The raycaster resolves a hit on any child part back to this pedestrian.
    ped.mesh.userData.ref = ped;
    peds.push(ped);
  }
  return peds;
}

export function updatePedestrians(peds, playerPos, playerSpeed, gunshotAt, dt) {
  for (const p of peds) {
    if (p.dead) continue;
    const dp = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
    if (dp < 7 && playerSpeed > 8) p.fleeing = 2.5;
    if (gunshotAt && Math.hypot(p.pos.x - gunshotAt.x, p.pos.z - gunshotAt.z) < 30) p.fleeing = 3;
    p.wanderTimer -= dt;
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      // Run directly away from the player.
      const dx = p.pos.x - playerPos.x;
      const dz = p.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dx / d, dz / d);
      p.pos.x += Math.sin(p.heading) * 4.2 * dt;
      p.pos.z += Math.cos(p.heading) * 4.2 * dt;
    } else {
      // Stroll along the sidewalk; turn around at the block ends.
      if (p.wanderTimer <= 0) {
        p.wanderTimer = 3 + Math.random() * 5;
        p.heading += (Math.random() < 0.5 ? -1 : 1) * Math.PI * (Math.random() < 0.3 ? 1 : 0);
      }
      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.pos.x) > CITY.bound || Math.abs(p.pos.z) > CITY.bound) p.heading += Math.PI;
    }
    p.walkPhase += dt * (p.fleeing > 0 ? 9 : 3.2);
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    const swing = Math.sin(p.walkPhase) * 0.5;
    const u = p.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
  }
}
