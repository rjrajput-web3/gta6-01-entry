// Small particle effects: muzzle flashes, impact bursts, smoke and the cash
// sparkle. One pool of cheap meshes, reused so the game never allocates mid-fight.
import * as THREE from 'three';

export function createEffects(scene) {
  const POOL = 240;
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pool = [];
  for (let i = 0; i < POOL; i += 1) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, life: 0, max: 1, vel: new THREE.Vector3(), gravity: 0, fade: true });
  }
  let cursor = 0;

  function spawn(pos, vel, life, color, size, gravity) {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(color);
    p.mesh.scale.setScalar(size || 1);
    p.vel.copy(vel);
    p.life = life;
    p.max = life;
    p.gravity = gravity || 0;
  }

  return {
    burst(pos, color, count, speed, life) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const b = (Math.random() - 0.4) * Math.PI;
        const v = new THREE.Vector3(
          Math.cos(a) * Math.cos(b) * speed,
          Math.abs(Math.sin(b)) * speed + 1.5,
          Math.sin(a) * Math.cos(b) * speed,
        );
        spawn(pos, v, (life || 0.7) * (0.6 + Math.random() * 0.7), color, 0.7 + Math.random() * 0.9, 9);
      }
    },
    muzzle(pos, dir) {
      for (let i = 0; i < 5; i += 1) {
        const v = dir.clone().multiplyScalar(8 + Math.random() * 6);
        v.x += (Math.random() - 0.5) * 3;
        v.y += (Math.random() - 0.5) * 3;
        v.z += (Math.random() - 0.5) * 3;
        spawn(pos, v, 0.09 + Math.random() * 0.06, 0xffd23e, 1.4, 0);
      }
    },
    smoke(pos, count) {
      for (let i = 0; i < (count || 3); i += 1) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2 + Math.random(), (Math.random() - 0.5) * 1.5);
        spawn(pos, v, 1.1 + Math.random() * 0.6, 0x555a60, 1.6 + Math.random(), -1.5);
      }
    },
    sparkle(pos) {
      for (let i = 0; i < 8; i += 1) {
        const a = Math.random() * Math.PI * 2;
        spawn(pos, new THREE.Vector3(Math.cos(a) * 2, 2 + Math.random() * 2, Math.sin(a) * 2), 0.6, 0x7dff9b, 0.8, 6);
      }
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.vel.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += dt * 3;
        p.mesh.rotation.y += dt * 2;
        const s = p.mesh.scale.x * (1 - dt * 0.4);
        p.mesh.scale.setScalar(Math.max(0.05, s));
        p.mesh.material.opacity = Math.max(0.15, p.life / p.max);
        p.mesh.material.transparent = true;
      }
    },
  };
}
