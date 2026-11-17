// Combat: fists on foot, a pistol with a crosshair, and damage to pedestrians,
// traffic and patrol cars. Hits are raycasts from the camera through the
// crosshair; every car and pedestrian mesh carries a userData.ref back to its
// entity, so a hit on any child part resolves to the thing that was shot.
// A disabled police car explodes into smoke and stops chasing.
import * as THREE from 'three';
import { START_AMMO } from './config.js';
import { addWanted } from './police.js';

const raycaster = new THREE.Raycaster();

export function createCombat() {
  return {
    ammo: START_AMMO,
    cooldown: 0,
    gunshotAt: null,
    gunshotTimer: 0,
  };
}

// Shoot from the camera through the centre of the screen. Returns what was hit.
export function shoot(combat, world, camera) {
  if (combat.cooldown > 0 || combat.ammo <= 0) return null;
  combat.cooldown = 0.28;
  combat.ammo -= 1;
  const audio = world.audio;
  const effects = world.effects;
  audio.gunshot();
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(origin, dir);
  raycaster.far = 90;
  const meshes = [];
  for (const p of world.peds) if (!p.dead) meshes.push(p.mesh);
  for (const car of world.allCars) if (!car.dead) meshes.push(car.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  const muzzlePos = origin.clone().addScaledVector(dir, 1.2);
  muzzlePos.y -= 0.25;
  effects.muzzle(muzzlePos, dir);
  combat.gunshotAt = world.player.pos.clone();
  combat.gunshotTimer = 3;
  if (hits.length === 0) return { kind: 'miss' };
  // Walk up from the hit part to the group that carries the entity reference.
  let node = hits[0].object;
  let target = null;
  while (node && !target) {
    if (node.userData && node.userData.ref) target = node.userData.ref;
    node = node.parent;
  }
  if (!target) return { kind: 'miss' };
  const point = hits[0].point;
  effects.burst(point, 0xff5d5d, 8, 4, 0.5);
  // Pedestrians have no `kind` field; cars do ('sedan', 'police', ...).
  if (!target.kind) {
    target.health -= 60;
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      target.mesh.visible = false;
      addWanted(world.police, 1);
      return { kind: 'pedDown' };
    }
    addWanted(world.police, 1);
    return { kind: 'pedHit' };
  }
  const car = target;
  car.health -= 34;
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    car.speed = 0;
    effects.burst(car.pos.clone().setY(1.2), 0xff8c2e, 26, 9, 1.1);
    effects.smoke(car.pos.clone().setY(1.4), 6);
    audio.crash();
    if (car.driver === 'police') {
      addWanted(world.police, 1);
      world.missionProgress.policeDisabled = (world.missionProgress.policeDisabled || 0) + 1;
      return { kind: 'policeDown' };
    }
    return { kind: 'carDown' };
  }
  return { kind: 'carHit' };
}

// A punch: short range, in front of the player, hurts a pedestrian or shoves a car.
export function punch(world) {
  const player = world.player;
  player.punchTimer = 0.35;
  world.audio.punch();
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  for (const p of world.peds) {
    if (p.dead) continue;
    const dx = p.pos.x - player.pos.x;
    const dz = p.pos.z - player.pos.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < 2.2 && side < 1.1) {
      p.health -= 45;
      p.fleeing = 3;
      world.effects.burst(p.pos.clone().setY(1.3), 0xffe9a8, 6, 3, 0.4);
      if (p.health <= 0) {
        p.dead = true;
        p.mesh.visible = false;
        addWanted(world.police, 1);
      }
      return { kind: 'pedHit' };
    }
  }
  return { kind: 'miss' };
}

export function updateCombat(combat, dt) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.gunshotTimer > 0) {
    combat.gunshotTimer -= dt;
    if (combat.gunshotTimer <= 0) combat.gunshotAt = null;
  }
}
