// Canvas-generated textures: every surface the city shows is painted at runtime,
// so the game ships no image files and loads nothing over the network.
import * as THREE from 'three';

// A building facade: warm plaster with lit windows and a darker base floor.
export function makeFacadeTexture(rng, baseColor, floors) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, w, h);
  const rows = Math.max(4, floors);
  const cols = 4;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.chance(0.55);
      const wx = 12 + c * 28;
      const wy = 12 + r * ((h - 24) / rows);
      g.fillStyle = lit ? (rng.chance(0.5) ? '#ffe9a8' : '#bfe3ff') : 'rgba(20,30,44,0.85)';
      g.fillRect(wx, wy, 16, 12);
    }
  }
  // Ground floor: darker shopfront band. Roofline: a darker cap at the top.
  g.fillStyle = 'rgba(15,20,30,0.55)';
  g.fillRect(0, h - 26, w, 26);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 8; x < w; x += 24) g.fillRect(x, h - 22, 14, 14);
  g.fillStyle = 'rgba(15,20,30,0.35)';
  g.fillRect(0, 0, w, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Asphalt with a centre line and edge lines, tiled along the road.
export function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2c2f36';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 200; i += 1) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#e8c832';
  g.fillRect(62, 0, 4, 128);
  g.fillStyle = '#d8d8d8';
  g.fillRect(4, 0, 3, 128);
  g.fillRect(121, 0, 3, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pale sidewalk slabs with a grid of seams.
export function makePavementTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#9aa0a8';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A simple two-tone beach towel / umbrella stripe, used on the beach props.
export function makeStripeTexture(colorA, colorB) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i % 2 === 0 ? colorA : colorB;
    g.fillRect(i * 8, 0, 8, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
