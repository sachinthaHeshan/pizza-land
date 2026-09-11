import * as THREE from 'three';
import { mulberry32 } from './utils/random.js';

export const TEXTURE_KEYS = [
  'brick',
  'terracotta',
  'wallTile',
  'stripe',
  'wood',
  'plaster',
  'paving',
  'asphalt',
  'metal',
  'sign',
  'sellBanner',
  'ovenBanner',
];

export function defaultCanvasFactory(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function jitter(hex, amount, rng) {
  const c = new THREE.Color(hex);
  const d = (rng() - 0.5) * amount;
  c.offsetHSL(0, 0, d);
  return c.getStyle();
}


// Tiling density is carried by per-mesh UVs (see materials' userData.tile and
// the geometry helpers), so every texture repeats exactly once per UV unit.
function finish(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function brick(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(1);
  const rows = 16;
  const cols = 8;
  const h = size / rows;
  const w = size / cols;
  ctx.fillStyle = '#c9b7a4';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -w / 2;
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = jitter('#b4552f', 0.16, rng);
      ctx.fillRect(c * w + offset + 3, r * h + 3, w - 6, h - 6);
    }
  }
  return finish(canvas);
}

function terracotta(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(2);
  const n = 6;
  const step = size / n;
  ctx.fillStyle = '#a8724c';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = jitter('#d98b52', 0.12, rng);
      ctx.fillRect(c * step + 4, r * step + 4, step - 8, step - 8);
    }
  }
  return finish(canvas);
}

function wallTile(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(3);
  const rows = 12;
  const cols = 6;
  const h = size / rows;
  const w = size / cols;
  ctx.fillStyle = '#cfc4b4';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : -w / 2;
    for (let c = -1; c <= cols; c++) {
      ctx.fillStyle = jitter('#f2ece0', 0.05, rng);
      ctx.fillRect(c * w + offset + 3, r * h + 3, w - 6, h - 6);
    }
  }
  return finish(canvas);
}

function stripe(factory) {
  const width = 256;
  const height = 64;
  const canvas = factory(width, height);
  const ctx = canvas.getContext('2d');
  const bands = 10;
  const w = width / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d8382f' : '#f6efe4';
    ctx.fillRect(i * w, 0, w, height);
  }
  return finish(canvas);
}

function wood(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(4);
  const planks = 8;
  const h = size / planks;
  ctx.fillStyle = '#6b4426';
  ctx.fillRect(0, 0, size, size);
  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = jitter('#9c6437', 0.14, rng);
    ctx.fillRect(0, p * h + 2, size, h - 4);
    for (let g = 0; g < 14; g++) {
      ctx.fillStyle = jitter('#7d4e2a', 0.1, rng);
      ctx.fillRect(rng() * size, p * h + 4 + rng() * (h - 10), 40 + rng() * 90, 1.5);
    }
  }
  return finish(canvas);
}

function plaster(factory) {
  const size = 256;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(5);
  ctx.fillStyle = '#e8dcc6';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = jitter('#e0d2b8', 0.06, rng);
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }
  return finish(canvas);
}

function paving(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(6);
  const n = 4;
  const step = size / n;
  ctx.fillStyle = '#9c968c';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = jitter('#cbc5b8', 0.07, rng);
      ctx.fillRect(c * step + 5, r * step + 5, step - 10, step - 10);
    }
  }
  return finish(canvas);
}

function asphalt(factory) {
  const size = 256;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(7);
  ctx.fillStyle = '#4b4a4d';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = jitter('#565559', 0.12, rng);
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }
  return finish(canvas);
}

function metal(factory) {
  const size = 256;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(8);
  ctx.fillStyle = '#b9bec4';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = jitter('#c9ced4', 0.08, rng);
    ctx.fillRect(0, rng() * size, size, 1);
  }
  return finish(canvas);
}

function sign(factory) {
  const size = 512;
  const canvas = factory(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f4a35';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#f6efe4';
  ctx.fillRect(24, 24, size - 48, size - 48);
  ctx.fillStyle = '#2f4a35';
  ctx.fillRect(36, 36, size - 72, size - 72);
  ctx.fillStyle = '#e8c15c';
  ctx.beginPath();
  ctx.moveTo(size / 2, 120);
  ctx.lineTo(size / 2 - 130, 380);
  ctx.lineTo(size / 2 + 130, 380);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8382f';
  for (const [cx, cy] of [[size / 2, 250], [size / 2 - 60, 330], [size / 2 + 62, 336]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

// Drawn with plain path calls rather than ctx.roundRect so it needs nothing
// beyond the basic canvas API.
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pizzaSlice(ctx, cx, cy, size) {
  const half = size * 0.36;
  const top = -size * 0.36;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3b2314';
  ctx.lineWidth = size * 0.05;

  ctx.fillStyle = '#ffc53d';
  ctx.beginPath();
  ctx.moveTo(-half, top);
  ctx.lineTo(half, top);
  ctx.lineTo(0, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d9822b';
  roundedRect(ctx, -half - size * 0.06, top - size * 0.14, (half + size * 0.06) * 2, size * 0.18, size * 0.09);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d63a2a';
  ctx.lineWidth = size * 0.025;
  for (const [px, py, r] of [[-0.12, -0.12, 0.08], [0.13, -0.05, 0.07], [0, 0.18, 0.065]]) {
    ctx.beginPath();
    ctx.arc(px * size, py * size, r * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// A glassy panel with a glowing rim, like a mobile-game "go here" marker.
// The canvas is 2:1 and the banner sprite keeps that aspect.
function sellBanner(factory) {
  const width = 1024;
  const height = 512;
  const canvas = factory(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const inset = 44;
  roundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 84);
  ctx.fillStyle = 'rgba(255, 214, 150, 0.32)';
  ctx.fill();
  ctx.shadowColor = '#ffb13b';
  ctx.shadowBlur = 36;
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffd772';
  ctx.stroke();
  ctx.shadowBlur = 0;

  const inner = inset + 16;
  roundedRect(ctx, inner, inner, width - inner * 2, height - inner * 2, 70);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  pizzaSlice(ctx, 290, 262, 300);

  ctx.font = '900 150px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#3b2314';
  for (const [word, fill, y] of [['SELL', '#ffd23a', 190], ['PIZZA', '#ffffff', 340]]) {
    ctx.strokeText(word, 660, y);
    ctx.fillStyle = fill;
    ctx.fillText(word, 660, y);
  }
  return finish(canvas);
}

// The oven's count banner. It redraws in place when the count changes, and
// stays blank until the simulation first sets a count.
export function ovenBannerTexture(factory = defaultCanvasFactory) {
  const width = 512;
  const height = 256;
  const canvas = factory(width, height);
  const ctx = canvas.getContext('2d');
  const texture = finish(canvas);
  texture.userData.count = null;

  texture.userData.setCount = (count, capacity) => {
    if (count === texture.userData.count) return;
    texture.userData.count = count;

    ctx.clearRect(0, 0, width, height);
    const inset = 22;
    roundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 42);
    ctx.fillStyle = 'rgba(255, 214, 150, 0.32)';
    ctx.fill();
    ctx.shadowColor = '#ffb13b';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#ffd772';
    ctx.stroke();
    ctx.shadowBlur = 0;

    pizzaSlice(ctx, 120, 131, 150);

    const text = `${count}/${capacity}`;
    ctx.font = '900 96px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3b2314';
    ctx.strokeText(text, 340, 134);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 340, 134);
    texture.needsUpdate = true;
  };

  return texture;
}

const GENERATORS = {
  brick,
  terracotta,
  wallTile,
  stripe,
  wood,
  plaster,
  paving,
  asphalt,
  metal,
  sign,
  sellBanner,
  ovenBanner: ovenBannerTexture,
};

export function createTextures(canvasFactory = defaultCanvasFactory) {
  const textures = {};
  for (const key of TEXTURE_KEYS) {
    textures[key] = GENERATORS[key](canvasFactory);
  }
  return textures;
}
