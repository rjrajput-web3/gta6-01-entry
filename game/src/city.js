// Solmar Bay itself: a sun-soaked coastal grid city built procedurally from one
// seed. Roads on the grid lines, blocks of towers between them, palms and lamps
// along the sidewalks, a beach and ocean to the south, and a marina to the east.
// It also owns the collision boxes and the road lines the traffic drives on.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { makeFacadeTexture, makePavementTexture, makeRoadTexture, makeStripeTexture } from './textures.js';

// Grid-line coordinate of road `i` (0..blocks), measured from the first road centre.
export function roadLine(i) {
  return -CITY.half - CITY.road / 2 + i * CITY.pitch + CITY.road / 2;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const roadLines = [];
  for (let i = 0; i <= CITY.blocks; i += 1) roadLines.push(-CITY.half + i * CITY.pitch);
  const half = CITY.half;
  const pitch = CITY.pitch;
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grass base, sand strip and ocean to the south (negative z is the bay).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bound * 2 + 200, CITY.bound * 2 + 200),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bound * 2 + 200, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0, -(half + 23));
  group.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bound * 2 + 260, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.12, -(half + 46 + 110));
  group.add(ocean);

  // Roads: dark strips along every grid line, with pavement blocks between.
  const roadTex = makeRoadTexture();
  const paveTex = makePavementTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const paveMat = new THREE.MeshLambertMaterial({ map: paveTex });
  const span = half * 2 + CITY.road;
  for (const line of roadLines) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(span, CITY.road), roadMat);
      strip.rotation.x = -Math.PI / 2;
      if (!horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(horizontal ? 0 : line, 0.02, horizontal ? line : 0);
      // Repeat the texture along the strip so dashes stay square.
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(span / CITY.road, 1);
      strip.material = new THREE.MeshLambertMaterial({ map: tex });
      group.add(strip);
    }
  }
  // Sidewalk slabs fill each block's border, under the buildings.
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const cx = -half + bx * pitch + CITY.block / 2;
      const cz = -half + bz * pitch + CITY.block / 2;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block + 2, CITY.block + 2), paveMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.01, cz);
      const tex = paveTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(3, 3);
      slab.material = new THREE.MeshLambertMaterial({ map: tex });
      group.add(slab);
    }
  }

  // Buildings: one to four towers per block, varied heights, warm colours,
  // canvas facades with lit windows. Downtown (centre blocks) goes taller.
  const facadeCache = new Map();
  function facade(color, floors) {
    const key = `${color}:${floors}`;
    if (!facadeCache.has(key)) facadeCache.set(key, makeFacadeTexture(rng, color, floors));
    return facadeCache.get(key);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const districts = ['Downtown', 'Marina', 'Beach Strip', 'Market Quarter', 'The Docks', 'Old Town', 'The Hills', 'Harbour View', 'Palm Row'];
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const cx = -half + bx * pitch + CITY.block / 2;
      const cz = -half + bz * pitch + CITY.block / 2;
      const downtown = Math.abs(bx - 4) <= 1 && Math.abs(bz - 4) <= 1;
      const count = rng.int(1, downtown ? 2 : 4);
      const placed = [];
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(7, 13);
        const d = rng.range(7, 13);
        const h = downtown ? rng.range(22, 58) : rng.range(8, 26);
        const ox = rng.range(-8, 8);
        const oz = rng.range(-8, 8);
        const x = cx + ox;
        const z = cz + oz;
        if (placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 2 && Math.abs(p.z - z) < (p.d + d) / 2 + 2)) continue;
        placed.push({ x, z, w, d });
        const color = rng.pick(PALETTE.buildings);
        const floors = Math.max(3, Math.round(h / 3.2));
        const mat = new THREE.MeshLambertMaterial({ map: facade(color, floors) });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
        tower.position.set(x, h / 2, z);
        group.add(tower);
        // Roof box / water tank so skylines are not flat.
        if (rng.chance(0.5)) {
          const tank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), roofMat);
          tank.position.set(x + rng.range(-2, 2), h + 1.1, z + rng.range(-2, 2));
          group.add(tank);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      // Palms and lamps along the block edges.
      for (let s = 0; s < 3; s += 1) {
        const px = cx + rng.range(-CITY.block / 2, CITY.block / 2);
        const pz = cz + (rng.chance(0.5) ? -1 : 1) * (CITY.block / 2 + 1.2);
        addPalm(group, px, pz, rng);
        const lx = cx + (rng.chance(0.5) ? -1 : 1) * (CITY.block / 2 + 1.2);
        const lz = cz + rng.range(-CITY.block / 2, CITY.block / 2);
        addLamp(group, lx, lz);
      }
    }
  }

  // Beach props: striped umbrellas and loungers along the sand.
  const stripe = makeStripeTexture('#ff5d73', '#ffffff');
  for (let i = 0; i < 10; i += 1) {
    const x = -half + 20 + i * (span / 10) + rng.range(-6, 6);
    const z = -(half + 14 + rng.range(0, 16));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    pole.position.set(x, 1.6, z);
    group.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 10), new THREE.MeshLambertMaterial({ map: stripe }));
    shade.position.set(x, 3.4, z);
    group.add(shade);
  }

  // The marina pier on the east side, where the big score happens.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1.2, 60),
    new THREE.MeshLambertMaterial({ color: 0x7a5c3e }),
  );
  pier.position.set(half + 22, 0.6, -half + 30);
  group.add(pier);
  colliders.push({ minX: half + 17, maxX: half + 27, minZ: -half, maxZ: -half + 60 });

  // District name posts at a few corners, for flavour and orientation.
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  districts.forEach((name, i) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    const x = -half + (i % 3) * pitch * 3 + 8;
    const z = -half + Math.floor(i / 3) * pitch * 3 + 8;
    post.position.set(x, 1.5, z);
    group.add(post);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.15), signMat);
    plate.position.set(x, 3.1, z);
    group.add(plate);
    void name;
  });

  // Landmarks the missions and the spawn logic use, in world coordinates.
  const landmarks = {
    spawn: { x: 0, z: 30 },
    marina: { x: half - 4, z: -half + 30 },
    market: { x: -149, z: -171 },
    docks: { x: -half + 20, z: half - 18 },
    beachLot: { x: -pitch * 2, z: -(half + 2) },
    garage: { x: pitch * 3, z: pitch * 2 },
    hideout: { x: -pitch * 3, z: pitch * 3 },
    downtown: { x: 0, z: 0 },
    hills: { x: pitch * 3, z: -pitch * 3 },
  };

  return { group, colliders, roadLines, landmarks, districts };
}

function addPalm(group, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  trunk.position.set(x, 2.7, z);
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.1, 5.6, z + Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
}

function addLamp(group, x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x2a2e35 }),
  );
  pole.position.set(x, 2.5, z);
  group.add(pole);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  bulb.position.set(x, 5.1, z);
  group.add(bulb);
}

// Circle (x, z, radius) pushed out of every building box it overlaps.
export function resolveCircleCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 0.0001) {
      // Inside the box: push out along the smallest penetration axis.
      const pl = pos.x - c.minX;
      const pr = c.maxX - pos.x;
      const pt = pos.z - c.minZ;
      const pb = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = c.minX - radius;
      else if (m === pr) pos.x = c.maxX + radius;
      else if (m === pt) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
      continue;
    }
    const d = Math.sqrt(d2);
    pos.x = nx + (dx / d) * radius;
    pos.z = nz + (dz / d) * radius;
  }
}
