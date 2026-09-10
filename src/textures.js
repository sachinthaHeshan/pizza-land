import * as THREE from 'three';

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

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(repeat[0], repeat[1]);
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
  return finish(canvas, [3, 3]);
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
  return finish(canvas, [6, 6]);
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
  return finish(canvas, [4, 2]);
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
  return finish(canvas, [1, 1]);
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
  return finish(canvas, [2, 2]);
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
  return finish(canvas, [3, 3]);
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
  return finish(canvas, [10, 10]);
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
  return finish(canvas, [14, 14]);
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
  return finish(canvas, [2, 1]);
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
  return finish(canvas, [1, 1]);
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
};

export function createTextures(canvasFactory = defaultCanvasFactory) {
  const textures = {};
  for (const key of TEXTURE_KEYS) {
    textures[key] = GENERATORS[key](canvasFactory);
  }
  return textures;
}
