// Jax Marlowe on foot: a stylized figure with a walk cycle, camera-relative
// movement, building collisions, and the steal-a-car interaction.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleCollisions } from './city.js';

export function buildPersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = 1.72;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 1.76;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.26), pantsMat);
  legL.position.set(-0.17, 0.36, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), shirtMat);
  armL.position.set(-0.42, 1.12, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.userData = { legL, legR, armL, armR, head };
  return group;
}

export function createPlayer(scene, start) {
  const mesh = buildPersonMesh(0xd94f3d, 0x2a3442, 0xc98e6a);
  mesh.position.set(start.x, 0, start.z);
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(start.x, 0, start.z),
    heading: 0,
    health: PLAYER.maxHealth,
    speed: 0,
    inCar: null,
    walkPhase: 0,
    punchTimer: 0,
    invulnerable: 0,
  };
}

// Move on foot, camera-relative: W walks away from the camera, A/D strafe.
export function updatePlayerOnFoot(player, input, camYaw, dt, colliders, cars) {
  const axes = input.axes();
  const running = input.held('run');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  // Forward is away from the camera: (-sin, -cos) in world xz; strafe is right.
  let mx = (-sin) * axes.forward + cos * axes.strafe;
  let mz = (-cos) * axes.forward - sin * axes.strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    player.pos.x += mx * speed * dt;
    player.pos.z += mz * speed * dt;
    const target = Math.atan2(mx, mz);
    let diff = target - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += diff * Math.min(1, dt * 12);
    player.speed = speed;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.speed = 0;
  }
  resolveCircleCollisions(player.pos, PLAYER.radius, colliders);
  // Soft push-out from cars so the player cannot walk through traffic.
  for (const car of cars) {
    if (car.dead) continue;
    const dx = player.pos.x - car.pos.x;
    const dz = player.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.9 && d > 0.01) {
      player.pos.x = car.pos.x + (dx / d) * 1.9;
      player.pos.z = car.pos.z + (dz / d) * 1.9;
    }
  }
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  const swing = player.speed > 0.1 ? Math.sin(player.walkPhase) * 0.55 : 0;
  const u = player.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  if (player.punchTimer > 0) {
    player.punchTimer -= dt;
    u.armR.rotation.x = -1.6;
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

// Nearest stealable car within reach, or null.
export function nearestStealableCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead || car.driver === 'player' || car.driver === 'police') continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
