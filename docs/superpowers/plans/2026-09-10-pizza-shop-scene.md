# Isometric Pizza Shop Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reference illustration's pizza shop as a Three.js scene — building shell, built-in fixtures, and ground apron, with no props, furniture, vehicles, or people.

**Architecture:** One `layout.js` holds every dimension. Each building part is a pure factory `createX(materials, layout) -> THREE.Group` in `src/building/`, assembled by `scene.js`. Materials come from a shared cache built on runtime-generated `CanvasTexture`s, so no image files ship. `main.js` owns only the renderer, camera and controls.

**Tech Stack:** three, vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-10-pizza-shop-threejs-design.md`

## Global Constraints

- Coordinate system: Y up, `+Z` toward the street, `+X` right, origin at shop floor centre, 1 unit ≈ 1 m.
- No module hard-codes a position. Every dimension is read from `layout`.
- Every `building/*.js` exports exactly one factory `createX(materials, layout) -> THREE.Group`, is pure, and mutates nothing outside itself.
- Every returned group sets `.name`, and every mesh sets `castShadow` and `receiveShadow`.
- No image files, no model files, no CSG library. Textures are generated into a canvas at runtime.
- The building is roofless. Never add roof geometry.
- Scope excludes: food, ingredients, boxes, pots, plants, bins, crates, tables, chairs, stools, registers, monitors, people, vehicles, trees, street lamps, fences.
- Tests run in the Vitest `node` environment. `src/textures.js` takes an injected canvas factory so it is testable without a DOM.

## Spec refinements made while planning

Two clarifications the spec left loose; both stay inside its intent:

1. **Floor regions are non-overlapping rectangles.** The spec described the terracotta floor and plaza as overlapping ranges "minus" a footprint. This plan lists explicit disjoint rectangles that tile the lot exactly, so nothing z-fights and no patch is missing.
2. **`src/scene.js` added.** The spec had `main.js` assemble the groups. Assembly is split into `scene.js` so it can be unit-tested without a WebGL context; `main.js` keeps only renderer, camera and controls.
3. **Textures take an injected canvas factory** rather than being replaced wholesale with `vi.mock`, as the spec suggested. Injection lets the texture tests assert what each generator actually draws instead of only that it was called.

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Vite entry, full-viewport canvas |
| `package.json`, `vite.config.js` | Tooling and scripts |
| `src/layout.js` | Every dimension and envelope — single source of truth |
| `src/textures.js` | Procedural `CanvasTexture` generators, injectable canvas factory |
| `src/materials.js` | Shared `MeshStandardMaterial` cache |
| `src/utils/geometry.js` | `box`, `slab`, `wallRun`, `archFrame`, `awning` helpers |
| `src/building/ground.js` | Road, curb, sidewalk, plaza, floors, parking markings |
| `src/building/perimeter.js` | Brick boundary wall runs, caps, corner pillars |
| `src/building/diningWing.js` | Wing walls, windows, partition, doorway |
| `src/building/storefront.js` | Facade, glazing, door, awning, signboard, lamps |
| `src/building/kitchen.js` | Tiled wall, stainless counters, island, shelving |
| `src/building/oven.js` | Brick base, dome, arched mouth, fire, chimney |
| `src/building/counter.js` | L-shaped service counter |
| `src/building/sideWing.js` | Front-right wing with awning and lit window |
| `src/lighting.js` | Hemisphere fill, sun, warm point lights |
| `src/scene.js` | Assembles all groups into one root group |
| `src/main.js` | Renderer, orthographic camera, controls, render loop |
| `tests/helpers/bounds.js` | Bounding-box assertions shared by module tests |
| `tests/helpers/stubs.js` | Stub materials and stub canvas factory |

---

### Task 1: Project scaffold, layout, and test helpers

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/layout.js`, `tests/helpers/bounds.js`, `tests/helpers/stubs.js`
- Test: `tests/layout.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `layout` (named export from `src/layout.js`) — the object literal shown in Step 3, including `layout.envelopes` keyed by module name with `{ min: [x,y,z], max: [x,y,z] }`. `boundsOf(object3D) -> THREE.Box3`, `expectFinite(box)`, `expectWithin(box, envelope, tol = 0.5)` from `tests/helpers/bounds.js`. `stubCanvasFactory() -> (w, h) => fakeCanvas` from `tests/helpers/stubs.js`, where `fakeCanvas.getContext('2d')` returns a recording context and `fakeCanvas.__calls` is an array of `[methodName, ...args]`. Task 3 adds `stubMaterials()` to this same file.

- [ ] **Step 1: Create the project scaffold**

```bash
npm init -y
npm install three
npm install -D vite vitest
```

Overwrite `package.json` scripts block so it reads:

```json
{
  "name": "pizza-land",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Keep the `dependencies` and `devDependencies` npm wrote — do not hand-edit versions.

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pizza Land</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #cfe0f5; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the failing layout test**

Create `tests/layout.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { layout } from '../src/layout.js';

const rects = [
  ...layout.ground.terracotta,
  ...layout.ground.plaza,
  { x: layout.ground.diningFloor.x, z: layout.ground.diningFloor.z },
];

function area(r) {
  return (r.x[1] - r.x[0]) * (r.z[1] - r.z[0]);
}

function overlaps(a, b) {
  return a.x[0] < b.x[1] && b.x[0] < a.x[1] && a.z[0] < b.z[1] && b.z[0] < a.z[1];
}

describe('layout', () => {
  it('gives every envelope a positive span on all three axes', () => {
    for (const [name, env] of Object.entries(layout.envelopes)) {
      for (let axis = 0; axis < 3; axis++) {
        expect(env.max[axis], `${name} axis ${axis}`).toBeGreaterThan(env.min[axis]);
      }
    }
  });

  it('tiles the lot with floor rectangles that do not overlap', () => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j]), `rect ${i} overlaps rect ${j}`).toBe(false);
      }
    }
  });

  it('covers the whole lot area with floor rectangles', () => {
    const lotArea = (9 - -11) * (8 - -8);
    const covered = rects.reduce((sum, r) => sum + area(r), 0);
    expect(covered).toBeCloseTo(lotArea, 5);
  });

  it('places every perimeter pillar on a lot corner', () => {
    for (const [px, pz] of layout.perimeter.pillars) {
      expect(Math.abs(px) === 11 || px === 9).toBe(true);
      expect(Math.abs(pz) === 8 || pz === 6 || pz === 2).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/layout.js"`.

- [ ] **Step 4: Write `src/layout.js`**

```js
export const layout = {
  units: 'meters',

  ground: {
    road: { x: [-40, 40], z: [14, 40], y: -0.15 },
    curb: { x: [-40, 40], z: [13.6, 14], y: [-0.15, 0] },
    sidewalk: [
      { x: [-40, 40], z: [8, 13.6] },
      { x: [-24, -11], z: [-8, 8] },
    ],
    plaza: [
      { x: [-11, -3], z: [2, 8] },
      { x: [-3, 5], z: [4, 8] },
      { x: [5, 9], z: [6, 8] },
    ],
    terracotta: [
      { x: [-3, 9], z: [-8, 4] },
      { x: [5, 9], z: [4, 6] },
      { x: [-11, -3], z: [-8, -6] },
    ],
    diningFloor: { x: [-11, -3], z: [-6, 2], y: 0.06 },
    floorY: { terracotta: 0.02, paving: 0.0 },
    parking: { stripeWidth: 0.12, stripeLength: 5.0, spacing: 2.6, count: 9, startX: -13, z: [14.2, 19.2] },
    laneDivider: { z: 22, width: 0.14, dash: 2.0, gap: 1.6, x: [-40, 40] },
  },

  wall: { thickness: 0.4, height: 1.2, capHeight: 0.15, capWidth: 0.55 },

  perimeter: {
    runs: [
      { axis: 'x', z: -8, x: [-11, 9] },
      { axis: 'z', x: 9, z: [-8, 2] },
      { axis: 'z', x: -11, z: [-8, -6] },
    ],
    pillars: [[-11, -8], [9, -8], [9, 6], [-11, 2]],
    pillarSize: 0.7,
    pillarHeight: 1.5,
    pillarCapWidth: 0.82,
  },

  kitchen: {
    tileWall: { x: [-3, 6], z: -8, y: [1.2, 3.2], thickness: 0.12 },
    backCounter: { x: [-3, 6], z: [-7.8, -6.8], height: 0.9, lip: 0.04, shelfY: 0.25 },
    island: { x: [-1.5, 3.5], z: [-5.2, -3.6], height: 0.9, shelfY: 0.25 },
    wallShelf: { x: [0, 5], z: -7.9, depth: 0.4, y: 2.0, railY: 1.85, thickness: 0.06 },
  },

  diningWing: {
    footprint: { x: [-11, -3], z: [-6, 2] },
    plinthHeight: 1.1,
    wallHeight: 2.8,
    thickness: 0.3,
    west: { x: -11, z: [-6, 2] },
    north: { z: -6, x: [-11, -3] },
    partition: { x: -3, z: [-6, 2], door: [-1, 0.2], lintelY: 2.1 },
    windows: { sill: 1.1, head: 2.6, bays: [[-5.3, -3.1], [-2.1, 0.1]] },
  },

  storefront: {
    z: 2,
    x: [-11, -3],
    thickness: 0.3,
    plinth: [0, 0.9],
    glass: [0.9, 2.5],
    header: [2.5, 2.8],
    posts: [-10.8, -8.6, -6.2, -4.6, -3.2],
    postSize: 0.22,
    door: { x: [-6.2, -4.6] },
    awning: { x: [-11, -3.4], wallY: 2.9, frontY: 2.45, frontZ: 3.3, valance: 0.25 },
    sign: { x: [-8.8, -4.2], y: [3.0, 4.1], thickness: 0.18, archRise: 0.45 },
    lamps: { xs: [-9.5, -4.0], y: 3.1, reach: 0.55, shadeRadius: 0.28 },
  },

  counter: {
    main: { x: [-1, 5], z: [3.6, 4.4] },
    ret: { x: [4.2, 5], z: [1.5, 4.4] },
    baseHeight: 0.95,
    topHeight: 1.1,
    overhang: 0.12,
  },

  oven: {
    base: { x: [5.6, 8.8], z: [-6.4, -3.2], y: [0, 1.0] },
    cap: [1.0, 1.15],
    dome: { center: [7.2, 1.15, -4.8], radius: 1.55, scaleY: 0.95 },
    mouth: { x: 5.65, width: 1.1, height: 0.85, sill: 1.15, recess: 0.6, frameDepth: 0.22 },
    chimney: { center: [7.9, -5.6], size: 0.7, y: [2.4, 4.3] },
    flue: { radius: 0.28, y: [4.3, 5.0], capRadius: 0.36 },
  },

  sideWing: {
    footprint: { x: [5, 9], z: [2, 6] },
    plinthHeight: 1.0,
    wallHeight: 2.8,
    thickness: 0.3,
    window: { z: 6, width: 2.4, height: 1.4, sill: 1.1, centerX: 7 },
    awning: { x: [5, 9], wallY: 3.0, frontY: 2.55, frontZ: 7.1, valance: 0.22 },
  },

  lighting: {
    hemi: { sky: 0xbcd6ff, ground: 0x6b5a45, intensity: 0.55 },
    sun: {
      color: 0xfff2dd,
      intensity: 2.1,
      position: [-18, 26, 14],
      shadowMapSize: 2048,
      shadowBounds: 26,
      shadowBias: -0.0005,
    },
    warm: { color: 0xffb066, intensity: 12, distance: 9, decay: 2 },
    fire: { color: 0xff7a2a, intensity: 18, distance: 8, decay: 2 },
  },

  camera: {
    frustumSize: 26,
    direction: [1, 0.82, 1],
    distance: 60,
    target: [0, 1.2, -0.5],
  },

  envelopes: {
    ground: { min: [-40, -0.2, -8], max: [40, 0.1, 40] },
    perimeter: { min: [-11.5, 0, -8.5], max: [9.5, 1.7, 6.5] },
    diningWing: { min: [-11.4, 0, -6.4], max: [-2.8, 2.9, 2.2] },
    storefront: { min: [-11.4, 0, 1.7], max: [-2.9, 4.8, 3.6] },
    kitchen: { min: [-3.2, 0, -8.2], max: [6.2, 3.3, -3.5] },
    oven: { min: [5.4, 0, -6.6], max: [9.0, 5.1, -3.0] },
    counter: { min: [-1.2, 0, 1.3], max: [5.2, 1.2, 4.6] },
    sideWing: { min: [4.8, 0, 1.8], max: [9.4, 3.2, 7.3] },
  },
};
```

- [ ] **Step 5: Write the shared test helpers**

Create `tests/helpers/bounds.js`:

```js
import * as THREE from 'three';
import { expect } from 'vitest';

export function boundsOf(object3D) {
  object3D.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object3D);
}

export function expectFinite(box) {
  for (const v of [box.min, box.max]) {
    for (const axis of ['x', 'y', 'z']) {
      expect(Number.isFinite(v[axis]), `${axis} is ${v[axis]}`).toBe(true);
    }
  }
}

export function expectWithin(box, envelope, tol = 0.5) {
  const axes = ['x', 'y', 'z'];
  axes.forEach((axis, i) => {
    expect(box.min[axis], `min ${axis}`).toBeGreaterThanOrEqual(envelope.min[i] - tol);
    expect(box.max[axis], `max ${axis}`).toBeLessThanOrEqual(envelope.max[i] + tol);
  });
}
```

Create `tests/helpers/stubs.js`:

```js
export function stubCanvasFactory() {
  return (width, height) => {
    const calls = [];
    const ctx = new Proxy(
      { calls, canvas: null },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          return (...args) => {
            calls.push([prop, ...args]);
          };
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
      }
    );
    return { width, height, getContext: () => ctx, __calls: calls };
  };
}
```

`stubMaterials()` is deliberately absent here: it depends on `MATERIAL_KEYS`,
which Task 3 creates. Task 3 appends it to this file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 4 passing tests in `tests/layout.test.js`.

- [ ] **Step 7: Commit**

```bash
printf 'node_modules\ndist\n.DS_Store\n' > .gitignore
git add package.json package-lock.json vite.config.js index.html src/layout.js tests/ .gitignore
git commit -m "feat: scaffold vite project and add layout single source of truth"
```

---

### Task 2: Procedural textures

**Files:**
- Create: `src/textures.js`
- Test: `tests/textures.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `createTextures(canvasFactory = defaultCanvasFactory) -> object` and `TEXTURE_KEYS` (array of strings) from `src/textures.js`. The returned object has exactly the keys in `TEXTURE_KEYS`: `brick`, `terracotta`, `wallTile`, `stripe`, `wood`, `plaster`, `paving`, `asphalt`, `metal`, `sign`. Every value is a `THREE.CanvasTexture` with `wrapS === wrapT === THREE.RepeatWrapping` and `colorSpace === THREE.SRGBColorSpace`. `defaultCanvasFactory(width, height)` returns a real DOM canvas.

- [ ] **Step 1: Write the failing test**

Create `tests/textures.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTextures, TEXTURE_KEYS } from '../src/textures.js';
import { stubCanvasFactory } from './helpers/stubs.js';

describe('createTextures', () => {
  it('returns exactly the declared texture keys', () => {
    const textures = createTextures(stubCanvasFactory());
    expect(Object.keys(textures).sort()).toEqual([...TEXTURE_KEYS].sort());
  });

  it('configures every texture for tiling in sRGB', () => {
    const textures = createTextures(stubCanvasFactory());
    for (const [name, texture] of Object.entries(textures)) {
      expect(texture, name).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.wrapS, name).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT, name).toBe(THREE.RepeatWrapping);
      expect(texture.colorSpace, name).toBe(THREE.SRGBColorSpace);
    }
  });

  it('draws a running-bond course for every brick row', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    const recording = (w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    };
    createTextures(recording);
    const brickCanvas = canvases[0];
    const rects = brickCanvas.__calls.filter(([method]) => method === 'fillRect');
    expect(rects.length).toBeGreaterThan(100);
  });

  it('draws alternating stripe bands', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const stripeCanvas = canvases[TEXTURE_KEYS.indexOf('stripe')];
    const rects = stripeCanvas.__calls.filter(([method]) => method === 'fillRect');
    expect(rects.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/textures.test.js`
Expected: FAIL — `Failed to resolve import "../src/textures.js"`.

- [ ] **Step 3: Write `src/textures.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/textures.test.js`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/textures.js tests/textures.test.js
git commit -m "feat: generate brick, tile, stripe and surface textures at runtime"
```

---

### Task 3: Material cache

**Files:**
- Create: `src/materials.js`
- Modify: `tests/helpers/stubs.js` (append `stubMaterials`)
- Test: `tests/materials.test.js`

**Interfaces:**
- Consumes: `createTextures`, `TEXTURE_KEYS` from `src/textures.js`.
- Produces: `createMaterials(textures) -> object` and `MATERIAL_KEYS` (array of strings) from `src/materials.js`. Keys: `brick`, `stone`, `terracotta`, `wallTile`, `stripe`, `wood`, `woodDark`, `plaster`, `paving`, `asphalt`, `roadPaint`, `metal`, `metalDark`, `glass`, `glow`, `greenPaint`, `lampShade`, `sign`, `ember`. Every value is a `THREE.MeshStandardMaterial` except `glow` and `ember`, which are `THREE.MeshBasicMaterial`. Also produces `stubMaterials() -> object` from `tests/helpers/stubs.js`, returning one named `MeshStandardMaterial` per key.

- [ ] **Step 1: Write the failing test**

Create `tests/materials.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMaterials, MATERIAL_KEYS } from '../src/materials.js';
import { createTextures } from '../src/textures.js';
import { stubCanvasFactory } from './helpers/stubs.js';

const materials = createMaterials(createTextures(stubCanvasFactory()));

describe('createMaterials', () => {
  it('returns exactly the declared material keys', () => {
    expect(Object.keys(materials).sort()).toEqual([...MATERIAL_KEYS].sort());
  });

  it('names every material after its key', () => {
    for (const [key, material] of Object.entries(materials)) {
      expect(material.name, key).toBe(key);
    }
  });

  it('makes glass transparent and not fully opaque', () => {
    expect(materials.glass.transparent).toBe(true);
    expect(materials.glass.opacity).toBeLessThan(1);
  });

  it('makes stainless metallic and rough surfaces non-metallic', () => {
    expect(materials.metal.metalness).toBeGreaterThan(0.5);
    expect(materials.brick.metalness).toBeLessThan(0.2);
    expect(materials.brick.roughness).toBeGreaterThan(0.7);
  });

  it('uses unlit materials for emissive glow surfaces', () => {
    expect(materials.glow).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(materials.ember).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('maps the brick material to the brick texture', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.brick.map).toBe(textures.brick);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/materials.test.js`
Expected: FAIL — `Failed to resolve import "../src/materials.js"`.

- [ ] **Step 3: Write `src/materials.js`**

```js
import * as THREE from 'three';

export const MATERIAL_KEYS = [
  'brick',
  'stone',
  'terracotta',
  'wallTile',
  'stripe',
  'wood',
  'woodDark',
  'plaster',
  'paving',
  'asphalt',
  'roadPaint',
  'metal',
  'metalDark',
  'glass',
  'glow',
  'greenPaint',
  'lampShade',
  'sign',
  'ember',
];

export function createMaterials(textures) {
  const standard = (name, options) =>
    new THREE.MeshStandardMaterial({ name, ...options });

  const materials = {
    brick: standard('brick', { map: textures.brick, roughness: 0.92, metalness: 0.02 }),
    stone: standard('stone', { color: 0xe4ddcd, roughness: 0.85, metalness: 0.02 }),
    terracotta: standard('terracotta', { map: textures.terracotta, roughness: 0.85, metalness: 0.02 }),
    wallTile: standard('wallTile', { map: textures.wallTile, roughness: 0.42, metalness: 0.04 }),
    stripe: standard('stripe', { map: textures.stripe, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide }),
    wood: standard('wood', { map: textures.wood, roughness: 0.68, metalness: 0.02 }),
    woodDark: standard('woodDark', { color: 0x5c3a22, roughness: 0.72, metalness: 0.02 }),
    plaster: standard('plaster', { map: textures.plaster, roughness: 0.95, metalness: 0.0 }),
    paving: standard('paving', { map: textures.paving, roughness: 0.9, metalness: 0.02 }),
    asphalt: standard('asphalt', { map: textures.asphalt, roughness: 0.97, metalness: 0.0 }),
    roadPaint: standard('roadPaint', { color: 0xf2efe6, roughness: 0.8, metalness: 0.0 }),
    metal: standard('metal', { map: textures.metal, roughness: 0.32, metalness: 0.82 }),
    metalDark: standard('metalDark', { color: 0x3a3d42, roughness: 0.45, metalness: 0.7 }),
    glass: standard('glass', {
      color: 0xbcd8e8,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
    greenPaint: standard('greenPaint', { color: 0x2f4a35, roughness: 0.6, metalness: 0.04 }),
    lampShade: standard('lampShade', {
      color: 0x2f4a35,
      roughness: 0.6,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    sign: standard('sign', { map: textures.sign, roughness: 0.6, metalness: 0.03 }),
    glow: new THREE.MeshBasicMaterial({ name: 'glow', color: 0xffcf8a }),
    ember: new THREE.MeshBasicMaterial({ name: 'ember', color: 0xff7a2a }),
  };

  return materials;
}
```

- [ ] **Step 4: Append `stubMaterials` to `tests/helpers/stubs.js`**

Add the import at the top of the existing file and the function at the bottom,
leaving `stubCanvasFactory` exactly as it is:

```js
import * as THREE from 'three';
import { MATERIAL_KEYS } from '../../src/materials.js';

// ... existing stubCanvasFactory stays here, unchanged ...

export function stubMaterials() {
  const materials = {};
  for (const key of MATERIAL_KEYS) {
    materials[key] = new THREE.MeshStandardMaterial({ name: key });
  }
  return materials;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/materials.test.js`
Expected: PASS — 6 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/materials.js tests/materials.test.js tests/helpers/stubs.js
git commit -m "feat: build shared material cache over procedural textures"
```

---

### Task 4: Geometry helpers

**Files:**
- Create: `src/utils/geometry.js`
- Test: `tests/geometry.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all from `src/utils/geometry.js`:
  - `box(material, { x, y, z }) -> THREE.Mesh` — an axis-aligned box spanning the given `[min, max]` pairs.
  - `slab(material, { x, z, y }) -> THREE.Mesh` — a horizontal plane at height `y`, receiving but not casting shadows.
  - `wallRun(material, { axis, at, span, y, thickness }) -> THREE.Mesh` — `axis` is `'x'` or `'z'`; the wall runs along `axis` at the other axis's coordinate `at`.
  - `archFrame(material, { width, height, depth, thickness, center }) -> THREE.Group` — two posts and a half-cylinder head, facing `-X`.
  - `awning(material, { x, wallZ, wallY, frontZ, frontY, valance }) -> THREE.Group` — a sloped striped panel plus a hanging valance strip.

- [ ] **Step 1: Write the failing test**

Create `tests/geometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { box, slab, wallRun, archFrame, awning } from '../src/utils/geometry.js';
import { boundsOf, expectFinite } from './helpers/bounds.js';

const mat = new THREE.MeshStandardMaterial();

describe('box', () => {
  it('spans the given ranges and centres itself in them', () => {
    const mesh = box(mat, { x: [-1, 3], y: [0, 2], z: [4, 5] });
    const p = mesh.geometry.parameters;
    expect([p.width, p.height, p.depth]).toEqual([4, 2, 1]);
    expect(mesh.position.toArray()).toEqual([1, 1, 4.5]);
  });

  it('casts and receives shadows', () => {
    const mesh = box(mat, { x: [0, 1], y: [0, 1], z: [0, 1] });
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });
});

describe('slab', () => {
  it('lies flat at the given height', () => {
    const mesh = slab(mat, { x: [-2, 2], z: [0, 6], y: 0.5 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.y).toBeCloseTo(0.5, 5);
    expect(bounds.max.y).toBeCloseTo(0.5, 5);
    expect(bounds.min.x).toBeCloseTo(-2, 5);
    expect(bounds.max.z).toBeCloseTo(6, 5);
  });

  it('receives shadows without casting them', () => {
    const mesh = slab(mat, { x: [0, 1], z: [0, 1], y: 0 });
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.castShadow).toBe(false);
  });
});

describe('wallRun', () => {
  it('runs along x and is thin in z', () => {
    const mesh = wallRun(mat, { axis: 'x', at: -8, span: [-11, 9], y: [0, 1.2], thickness: 0.4 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.x).toBeCloseTo(-11, 5);
    expect(bounds.max.x).toBeCloseTo(9, 5);
    expect(bounds.min.z).toBeCloseTo(-8.2, 5);
    expect(bounds.max.z).toBeCloseTo(-7.8, 5);
    expect(bounds.max.y).toBeCloseTo(1.2, 5);
  });

  it('runs along z and is thin in x', () => {
    const mesh = wallRun(mat, { axis: 'z', at: 9, span: [-8, 2], y: [0, 1.2], thickness: 0.4 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.z).toBeCloseTo(-8, 5);
    expect(bounds.max.z).toBeCloseTo(2, 5);
    expect(bounds.min.x).toBeCloseTo(8.8, 5);
    expect(bounds.max.x).toBeCloseTo(9.2, 5);
  });
});

describe('archFrame', () => {
  it('is as wide and tall as requested', () => {
    const group = archFrame(mat, {
      width: 1.1,
      height: 0.85,
      depth: 0.22,
      thickness: 0.16,
      center: [5.65, 1.15, -4.8],
    });
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(1.1 + 0.32, 1);
    expect(bounds.min.y).toBeCloseTo(1.15, 5);
    // Head radius is width/2 + thickness = 0.71.
    expect(bounds.max.y).toBeCloseTo(1.15 + 0.85 + 0.71, 1);
  });
});

describe('awning', () => {
  it('slopes down and outward from the wall', () => {
    const group = awning(mat, {
      x: [-11, -3.4],
      wallZ: 2,
      wallY: 2.9,
      frontZ: 3.3,
      frontY: 2.45,
      valance: 0.25,
    });
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expect(bounds.min.x).toBeCloseTo(-11, 1);
    expect(bounds.max.x).toBeCloseTo(-3.4, 1);
    expect(bounds.max.z).toBeCloseTo(3.3, 1);
    expect(bounds.max.y).toBeCloseTo(2.9, 1);
    expect(bounds.min.y).toBeCloseTo(2.45 - 0.25, 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/geometry.test.js`
Expected: FAIL — `Failed to resolve import "../src/utils/geometry.js"`.

- [ ] **Step 3: Write `src/utils/geometry.js`**

```js
import * as THREE from 'three';

const mid = (range) => (range[0] + range[1]) / 2;
const size = (range) => range[1] - range[0];

export function box(material, { x, y, z }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size(x), size(y), size(z)), material);
  mesh.position.set(mid(x), mid(y), mid(z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function slab(material, { x, z, y = 0 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size(x), size(z)), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(mid(x), y, mid(z));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export function wallRun(material, { axis, at, span, y, thickness }) {
  const half = thickness / 2;
  if (axis === 'x') {
    return box(material, { x: span, y, z: [at - half, at + half] });
  }
  return box(material, { x: [at - half, at + half], y, z: span });
}

export function archFrame(material, { width, height, depth, thickness, center }) {
  const group = new THREE.Group();
  group.name = 'archFrame';
  const [cx, cy, cz] = center;
  const halfW = width / 2;
  const outer = halfW + thickness;

  for (const side of [-1, 1]) {
    group.add(
      box(material, {
        x: [cx - depth / 2, cx + depth / 2],
        y: [cy, cy + height],
        z: [cz + side * halfW, cz + side * outer],
      })
    );
  }

  const headGeometry = new THREE.CylinderGeometry(outer, outer, depth, 24, 1, false, 0, Math.PI);
  const head = new THREE.Mesh(headGeometry, material);
  head.rotation.z = Math.PI / 2;
  head.position.set(cx, cy + height, cz);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  return group;
}

export function awning(material, { x, wallZ, wallY, frontZ, frontY, valance }) {
  const group = new THREE.Group();
  group.name = 'awning';

  const depth = Math.hypot(frontZ - wallZ, wallY - frontY);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(size(x), depth), material);
  panel.rotation.x = -Math.atan2(wallY - frontY, frontZ - wallZ) - Math.PI / 2;
  panel.position.set(mid(x), (wallY + frontY) / 2, (wallZ + frontZ) / 2);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(size(x), valance), material);
  skirt.position.set(mid(x), frontY - valance / 2, frontZ);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/geometry.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/geometry.js tests/geometry.test.js
git commit -m "feat: add box, slab, wall, arch and awning geometry helpers"
```

---

### Task 5: Ground apron

**Files:**
- Create: `src/building/ground.js`
- Test: `tests/building/ground.test.js`

**Interfaces:**
- Consumes: `box`, `slab` from `src/utils/geometry.js`; `layout.ground`; materials `asphalt`, `stone`, `paving`, `terracotta`, `wood`, `roadPaint`.
- Produces: `createGround(materials, layout) -> THREE.Group` named `'ground'`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/ground.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGround } from '../../src/building/ground.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createGround(stubMaterials(), layout);

describe('createGround', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('ground');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.ground);
  });

  it('draws one stripe per parking bay', () => {
    const painted = group.children.filter((c) => c.material.name === 'roadPaint');
    expect(painted.length).toBeGreaterThanOrEqual(layout.ground.parking.count);
  });

  it('lays the terracotta floor above the paving so it wins the seam', () => {
    expect(layout.ground.floorY.terracotta).toBeGreaterThan(layout.ground.floorY.paving);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/ground.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/ground.js"`.

- [ ] **Step 3: Write `src/building/ground.js`**

```js
import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

export function createGround(materials, layout) {
  const group = new THREE.Group();
  group.name = 'ground';
  const g = layout.ground;

  group.add(slab(materials.asphalt, { x: g.road.x, z: g.road.z, y: g.road.y }));
  group.add(box(materials.stone, { x: g.curb.x, y: g.curb.y, z: g.curb.z }));

  for (const rect of g.sidewalk) {
    group.add(slab(materials.paving, { x: rect.x, z: rect.z, y: g.floorY.paving }));
  }
  for (const rect of g.plaza) {
    group.add(slab(materials.paving, { x: rect.x, z: rect.z, y: g.floorY.paving }));
  }
  for (const rect of g.terracotta) {
    group.add(slab(materials.terracotta, { x: rect.x, z: rect.z, y: g.floorY.terracotta }));
  }
  group.add(
    slab(materials.wood, {
      x: g.diningFloor.x,
      z: g.diningFloor.z,
      y: g.diningFloor.y,
    })
  );

  const paintY = g.road.y + 0.01;
  const p = g.parking;
  for (let i = 0; i < p.count; i++) {
    const x = p.startX + i * p.spacing;
    group.add(
      slab(materials.roadPaint, { x: [x, x + p.stripeWidth], z: p.z, y: paintY })
    );
  }

  const d = g.laneDivider;
  for (let x = d.x[0]; x < d.x[1]; x += d.dash + d.gap) {
    group.add(
      slab(materials.roadPaint, {
        x: [x, Math.min(x + d.dash, d.x[1])],
        z: [d.z, d.z + d.width],
        y: paintY,
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/ground.test.js`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/ground.js tests/building/ground.test.js
git commit -m "feat: add road, sidewalk, plaza, floors and parking markings"
```

---

### Task 6: Perimeter walls

**Files:**
- Create: `src/building/perimeter.js`
- Test: `tests/building/perimeter.test.js`

**Interfaces:**
- Consumes: `box`, `wallRun` from `src/utils/geometry.js`; `layout.wall`, `layout.perimeter`; materials `brick`, `stone`.
- Produces: `createPerimeter(materials, layout) -> THREE.Group` named `'perimeter'`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/perimeter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPerimeter } from '../../src/building/perimeter.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createPerimeter(stubMaterials(), layout);

describe('createPerimeter', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('perimeter');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.perimeter);
  });

  it('builds a wall and a cap for every run', () => {
    const capped = group.children.filter((c) => c.material.name === 'stone');
    expect(capped.length).toBe(layout.perimeter.runs.length + layout.perimeter.pillars.length);
  });

  it('raises pillars above the wall runs', () => {
    expect(layout.perimeter.pillarHeight).toBeGreaterThan(layout.wall.height);
  });

  it('leaves the left wall short so the dining wing owns its own face', () => {
    const left = layout.perimeter.runs.find((r) => r.axis === 'z' && r.x === -11);
    expect(left.z[1]).toBeLessThanOrEqual(layout.diningWing.footprint.z[0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/perimeter.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/perimeter.js"`.

- [ ] **Step 3: Write `src/building/perimeter.js`**

```js
import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

export function createPerimeter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'perimeter';
  const { wall, perimeter } = layout;

  for (const run of perimeter.runs) {
    const along = run.axis === 'x' ? run.x : run.z;
    const at = run.axis === 'x' ? run.z : run.x;

    group.add(
      wallRun(materials.brick, {
        axis: run.axis,
        at,
        span: along,
        y: [0, wall.height],
        thickness: wall.thickness,
      })
    );
    group.add(
      wallRun(materials.stone, {
        axis: run.axis,
        at,
        span: along,
        y: [wall.height, wall.height + wall.capHeight],
        thickness: wall.capWidth,
      })
    );
  }

  const half = perimeter.pillarSize / 2;
  const capHalf = perimeter.pillarCapWidth / 2;
  for (const [px, pz] of perimeter.pillars) {
    group.add(
      box(materials.brick, {
        x: [px - half, px + half],
        y: [0, perimeter.pillarHeight],
        z: [pz - half, pz + half],
      })
    );
    group.add(
      box(materials.stone, {
        x: [px - capHalf, px + capHalf],
        y: [perimeter.pillarHeight, perimeter.pillarHeight + wall.capHeight],
        z: [pz - capHalf, pz + capHalf],
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/perimeter.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/perimeter.js tests/building/perimeter.test.js
git commit -m "feat: add brick perimeter walls, stone caps and corner pillars"
```

---

### Task 7: Dining wing

**Files:**
- Create: `src/building/diningWing.js`
- Test: `tests/building/diningWing.test.js`

**Interfaces:**
- Consumes: `box`, `wallRun` from `src/utils/geometry.js`; `layout.diningWing`; materials `brick`, `plaster`, `greenPaint`, `glass`, `woodDark`.
- Produces: `createDiningWing(materials, layout) -> THREE.Group` named `'diningWing'`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/diningWing.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDiningWing } from '../../src/building/diningWing.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createDiningWing(stubMaterials(), layout);

describe('createDiningWing', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('diningWing');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.diningWing);
  });

  it('glazes one pane per window bay', () => {
    const panes = group.children.filter((c) => c.material.name === 'glass');
    expect(panes.length).toBe(layout.diningWing.windows.bays.length);
  });

  it('stops every wall below the roofline', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeLessThanOrEqual(layout.diningWing.wallHeight + 0.01);
  });

  it('leaves a doorway gap in the partition', () => {
    const door = layout.diningWing.partition.door;
    expect(door[1]).toBeGreaterThan(door[0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/diningWing.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/diningWing.js"`.

- [ ] **Step 3: Write `src/building/diningWing.js`**

```js
import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

export function createDiningWing(materials, layout) {
  const group = new THREE.Group();
  group.name = 'diningWing';
  const d = layout.diningWing;
  const t = d.thickness;

  // West wall: continuous plinth, header band, and piers around the window bays.
  const west = d.west;
  group.add(
    wallRun(materials.brick, {
      axis: 'z',
      at: west.x,
      span: west.z,
      y: [0, d.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'z',
      at: west.x,
      span: west.z,
      y: [d.windows.head, d.wallHeight],
      thickness: t,
    })
  );

  const piers = [];
  let cursor = west.z[0];
  for (const bay of d.windows.bays) {
    piers.push([cursor, bay[0]]);
    cursor = bay[1];
  }
  piers.push([cursor, west.z[1]]);

  for (const pier of piers) {
    if (pier[1] - pier[0] <= 0.001) continue;
    group.add(
      wallRun(materials.plaster, {
        axis: 'z',
        at: west.x,
        span: pier,
        y: [d.plinthHeight, d.windows.head],
        thickness: t,
      })
    );
  }

  for (const bay of d.windows.bays) {
    const pane = box(materials.glass, {
      x: [west.x - 0.02, west.x + 0.02],
      y: [d.windows.sill, d.windows.head],
      z: bay,
    });
    group.add(pane);
    group.add(
      wallRun(materials.greenPaint, {
        axis: 'z',
        at: west.x,
        span: bay,
        y: [d.windows.sill - 0.1, d.windows.sill],
        thickness: t + 0.06,
      })
    );
  }

  // North wall: solid.
  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: d.north.z,
      span: d.north.x,
      y: [0, d.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'x',
      at: d.north.z,
      span: d.north.x,
      y: [d.plinthHeight, d.wallHeight],
      thickness: t,
    })
  );

  // Partition with a doorway.
  const p = d.partition;
  const segments = [
    [p.z[0], p.door[0]],
    [p.door[1], p.z[1]],
  ];
  for (const segment of segments) {
    if (segment[1] - segment[0] <= 0.001) continue;
    group.add(
      wallRun(materials.woodDark, {
        axis: 'z',
        at: p.x,
        span: segment,
        y: [0, d.wallHeight],
        thickness: t,
      })
    );
  }
  group.add(
    wallRun(materials.woodDark, {
      axis: 'z',
      at: p.x,
      span: p.door,
      y: [p.lintelY, d.wallHeight],
      thickness: t,
    })
  );

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/diningWing.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/diningWing.js tests/building/diningWing.test.js
git commit -m "feat: add dining wing walls, window bays and partition doorway"
```

---

### Task 8: Storefront

**Files:**
- Create: `src/building/storefront.js`
- Test: `tests/building/storefront.test.js`

**Interfaces:**
- Consumes: `box`, `wallRun`, `awning` from `src/utils/geometry.js`; `layout.storefront`; materials `brick`, `greenPaint`, `lampShade`, `glass`, `glow`, `stripe`, `sign`, `stone`, `metalDark`.
- Produces: `createStorefront(materials, layout) -> THREE.Group` named `'storefront'`, with `group.userData.lampAnchors` — an array of `THREE.Vector3` marking where `lighting.js` should place the gooseneck point lights.

- [ ] **Step 1: Write the failing test**

Create `tests/building/storefront.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStorefront } from '../../src/building/storefront.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createStorefront(stubMaterials(), layout);

describe('createStorefront', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('storefront');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.storefront);
  });

  it('publishes one lamp anchor per lamp', () => {
    expect(group.userData.lampAnchors).toHaveLength(layout.storefront.lamps.xs.length);
    for (const anchor of group.userData.lampAnchors) {
      expect(anchor).toBeInstanceOf(THREE.Vector3);
    }
  });

  it('raises the signboard above the awning', () => {
    expect(layout.storefront.sign.y[0]).toBeGreaterThanOrEqual(layout.storefront.awning.wallY);
  });

  it('keeps the door bay inside the facade span', () => {
    const { door, x } = layout.storefront;
    expect(door.x[0]).toBeGreaterThan(x[0]);
    expect(door.x[1]).toBeLessThan(x[1]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/storefront.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/storefront.js"`.

- [ ] **Step 3: Write `src/building/storefront.js`**

```js
import * as THREE from 'three';
import { box, wallRun, awning } from '../utils/geometry.js';

export function createStorefront(materials, layout) {
  const group = new THREE.Group();
  group.name = 'storefront';
  const s = layout.storefront;
  const t = s.thickness;

  // Brick plinth and header beam run the full facade.
  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: s.z,
      span: s.x,
      y: s.plinth,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.greenPaint, {
      axis: 'x',
      at: s.z,
      span: s.x,
      y: s.header,
      thickness: t + 0.08,
    })
  );

  // Timber posts.
  const halfPost = s.postSize / 2;
  for (const px of s.posts) {
    group.add(
      box(materials.greenPaint, {
        x: [px - halfPost, px + halfPost],
        y: [0, s.header[1]],
        z: [s.z - t / 2 - 0.04, s.z + t / 2 + 0.04],
      })
    );
  }

  // Glazing between the posts, with a warm glow plane just inside.
  for (let i = 0; i < s.posts.length - 1; i++) {
    const bay = [s.posts[i] + halfPost, s.posts[i + 1] - halfPost];
    if (bay[1] - bay[0] <= 0.001) continue;

    const isDoor = bay[0] >= s.door.x[0] - 0.3 && bay[1] <= s.door.x[1] + 0.3;
    const glassBottom = isDoor ? 0.15 : s.glass[0];

    group.add(
      box(materials.glass, {
        x: bay,
        y: [glassBottom, s.glass[1]],
        z: [s.z - 0.03, s.z + 0.03],
      })
    );
    group.add(
      box(materials.glow, {
        x: [bay[0] + 0.06, bay[1] - 0.06],
        y: [glassBottom + 0.06, s.glass[1] - 0.06],
        z: [s.z - 0.12, s.z - 0.09],
      })
    );

    if (isDoor) {
      group.add(
        box(materials.greenPaint, {
          x: [bay[0] - 0.06, bay[0] + 0.06],
          y: [0, s.glass[1] + 0.12],
          z: [s.z - 0.09, s.z + 0.09],
        })
      );
      group.add(
        box(materials.greenPaint, {
          x: [bay[1] - 0.06, bay[1] + 0.06],
          y: [0, s.glass[1] + 0.12],
          z: [s.z - 0.09, s.z + 0.09],
        })
      );
    }
  }

  // Striped awning.
  group.add(
    awning(materials.stripe, {
      x: s.awning.x,
      wallZ: s.z + t / 2,
      wallY: s.awning.wallY,
      frontZ: s.awning.frontZ,
      frontY: s.awning.frontY,
      valance: s.awning.valance,
    })
  );

  // Arched signboard: a cream surround, a green board, and the pizza motif.
  group.add(
    box(materials.stone, {
      x: [s.sign.x[0] - 0.18, s.sign.x[1] + 0.18],
      y: [s.sign.y[0] - 0.12, s.sign.y[1] + 0.12],
      z: [s.z - s.sign.thickness / 2 - 0.06, s.z + s.sign.thickness / 2 + 0.06],
    })
  );

  // thetaStart PI/2 selects the half that lands *above* the board once the
  // cylinder axis is rotated onto Z; scale.z squashes the semicircle into the
  // shallow semi-ellipse the reference shows.
  const archRadius = (s.sign.x[1] - s.sign.x[0]) / 2 + 0.18;
  const archGeometry = new THREE.CylinderGeometry(
    archRadius,
    archRadius,
    s.sign.thickness + 0.12,
    32,
    1,
    false,
    Math.PI / 2,
    Math.PI
  );
  const arch = new THREE.Mesh(archGeometry, materials.stone);
  arch.rotation.x = Math.PI / 2;
  arch.scale.z = s.sign.archRise / archRadius;
  arch.position.set((s.sign.x[0] + s.sign.x[1]) / 2, s.sign.y[1] + 0.12, s.z);
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  group.add(
    box(materials.sign, {
      x: s.sign.x,
      y: s.sign.y,
      z: [s.z + s.sign.thickness / 2, s.z + s.sign.thickness / 2 + 0.04],
    })
  );

  // Gooseneck lamps: an arm, a shade, and an anchor for the light rig.
  const anchors = [];
  for (const lx of s.lamps.xs) {
    group.add(
      box(materials.metalDark, {
        x: [lx - 0.03, lx + 0.03],
        y: [s.lamps.y, s.lamps.y + 0.26],
        z: [s.z, s.z + s.lamps.reach],
      })
    );

    const shadeGeometry = new THREE.ConeGeometry(s.lamps.shadeRadius, 0.24, 16, 1, true);
    const shade = new THREE.Mesh(shadeGeometry, materials.lampShade);
    shade.position.set(lx, s.lamps.y - 0.06, s.z + s.lamps.reach);
    shade.castShadow = true;
    group.add(shade);

    anchors.push(new THREE.Vector3(lx, s.lamps.y - 0.22, s.z + s.lamps.reach));
  }
  group.userData.lampAnchors = anchors;

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/storefront.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/storefront.js tests/building/storefront.test.js
git commit -m "feat: add storefront facade, awning, signboard and lamps"
```

---

### Task 9: Kitchen

**Files:**
- Create: `src/building/kitchen.js`
- Test: `tests/building/kitchen.test.js`

**Interfaces:**
- Consumes: `box`, `wallRun` from `src/utils/geometry.js`; `layout.kitchen`; materials `wallTile`, `metal`, `metalDark`.
- Produces: `createKitchen(materials, layout) -> THREE.Group` named `'kitchen'`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/kitchen.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createKitchen } from '../../src/building/kitchen.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createKitchen(stubMaterials(), layout);

describe('createKitchen', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('kitchen');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.kitchen);
  });

  it('raises the tiled wall above the perimeter wall it sits on', () => {
    expect(layout.kitchen.tileWall.y[0]).toBeGreaterThanOrEqual(layout.wall.height);
    expect(layout.kitchen.tileWall.y[1]).toBeGreaterThan(layout.kitchen.tileWall.y[0]);
  });

  it('keeps the prep island clear of the back counter', () => {
    expect(layout.kitchen.island.z[0]).toBeGreaterThan(layout.kitchen.backCounter.z[1]);
  });

  it('hangs the wall shelf above the counter tops', () => {
    expect(layout.kitchen.wallShelf.y).toBeGreaterThan(layout.kitchen.backCounter.height);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/kitchen.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/kitchen.js"`.

- [ ] **Step 3: Write `src/building/kitchen.js`**

```js
import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

function stainlessRun(materials, { x, z, height, lip, shelfY }) {
  const parts = [];

  parts.push(
    box(materials.metalDark, {
      x: [x[0] + 0.04, x[1] - 0.04],
      y: [0.12, height - 0.06],
      z: [z[0] + 0.04, z[1] - 0.04],
    })
  );
  parts.push(box(materials.metal, { x, y: [height - 0.06, height], z }));
  parts.push(
    box(materials.metal, {
      x,
      y: [height, height + lip],
      z: [z[0], z[0] + 0.06],
    })
  );
  parts.push(
    box(materials.metal, {
      x: [x[0] + 0.1, x[1] - 0.1],
      y: [shelfY, shelfY + 0.05],
      z: [z[0] + 0.1, z[1] - 0.1],
    })
  );

  return parts;
}

export function createKitchen(materials, layout) {
  const group = new THREE.Group();
  group.name = 'kitchen';
  const k = layout.kitchen;

  group.add(
    wallRun(materials.wallTile, {
      axis: 'x',
      at: k.tileWall.z + k.tileWall.thickness,
      span: k.tileWall.x,
      y: k.tileWall.y,
      thickness: k.tileWall.thickness,
    })
  );

  for (const part of stainlessRun(materials, {
    x: k.backCounter.x,
    z: k.backCounter.z,
    height: k.backCounter.height,
    lip: k.backCounter.lip,
    shelfY: k.backCounter.shelfY,
  })) {
    group.add(part);
  }

  for (const part of stainlessRun(materials, {
    x: k.island.x,
    z: k.island.z,
    height: k.island.height,
    lip: 0.03,
    shelfY: k.island.shelfY,
  })) {
    group.add(part);
  }

  const shelf = k.wallShelf;
  group.add(
    box(materials.metal, {
      x: shelf.x,
      y: [shelf.y, shelf.y + shelf.thickness],
      z: [shelf.z, shelf.z + shelf.depth],
    })
  );
  group.add(
    box(materials.metalDark, {
      x: shelf.x,
      y: [shelf.railY, shelf.railY + 0.04],
      z: [shelf.z + shelf.depth - 0.08, shelf.z + shelf.depth - 0.04],
    })
  );

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/kitchen.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/kitchen.js tests/building/kitchen.test.js
git commit -m "feat: add tiled kitchen wall, stainless counters and shelving"
```

---

### Task 10: Pizza oven

**Files:**
- Create: `src/building/oven.js`
- Test: `tests/building/oven.test.js`

**Interfaces:**
- Consumes: `box`, `archFrame` from `src/utils/geometry.js`; `layout.oven`, `layout.lighting.fire`; materials `brick`, `stone`, `metalDark`, `ember`.
- Produces: `createOven(materials, layout) -> THREE.Group` named `'oven'`, with `group.userData.fireLight` — a `THREE.PointLight` already added to the group, which `main.js` flickers.

- [ ] **Step 1: Write the failing test**

Create `tests/building/oven.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOven } from '../../src/building/oven.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createOven(stubMaterials(), layout);

describe('createOven', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('oven');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.oven);
  });

  it('exposes a fire light that is part of the group', () => {
    const light = group.userData.fireLight;
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(group.children).toContain(light);
    expect(light.userData.baseIntensity).toBe(layout.lighting.fire.intensity);
  });

  it('carries the flue above the dome', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeGreaterThan(layout.oven.dome.center[1] + layout.oven.dome.radius);
  });

  it('faces the mouth toward the shop interior', () => {
    expect(layout.oven.mouth.x).toBeLessThan(layout.oven.dome.center[0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/oven.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/oven.js"`.

- [ ] **Step 3: Write `src/building/oven.js`**

```js
import * as THREE from 'three';
import { box, archFrame } from '../utils/geometry.js';

export function createOven(materials, layout) {
  const group = new THREE.Group();
  group.name = 'oven';
  const o = layout.oven;

  group.add(box(materials.brick, { x: o.base.x, y: o.base.y, z: o.base.z }));
  group.add(
    box(materials.stone, {
      x: [o.base.x[0] - 0.1, o.base.x[1] + 0.1],
      y: o.cap,
      z: [o.base.z[0] - 0.1, o.base.z[1] + 0.1],
    })
  );

  const [dx, dy, dz] = o.dome.center;
  const domeGeometry = new THREE.SphereGeometry(o.dome.radius, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeometry, materials.brick);
  dome.position.set(dx, dy, dz);
  dome.scale.y = o.dome.scaleY;
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  const m = o.mouth;
  group.add(
    archFrame(materials.stone, {
      width: m.width,
      height: m.height,
      depth: m.frameDepth,
      thickness: 0.16,
      center: [m.x, m.sill, dz],
    })
  );

  const recessGeometry = new THREE.CylinderGeometry(m.width / 2, m.width / 2, m.recess, 20, 1, false, 0, Math.PI);
  const recess = new THREE.Mesh(recessGeometry, materials.metalDark);
  recess.rotation.z = Math.PI / 2;
  recess.position.set(m.x + m.recess / 2, m.sill, dz);
  recess.castShadow = true;
  recess.receiveShadow = true;
  group.add(recess);

  group.add(
    box(materials.ember, {
      x: [m.x + m.recess - 0.06, m.x + m.recess - 0.02],
      y: [m.sill + 0.02, m.sill + 0.34],
      z: [dz - m.width / 2 + 0.1, dz + m.width / 2 - 0.1],
    })
  );

  const fire = layout.lighting.fire;
  const fireLight = new THREE.PointLight(fire.color, fire.intensity, fire.distance, fire.decay);
  fireLight.position.set(m.x + m.recess * 0.6, m.sill + 0.3, dz);
  fireLight.userData.baseIntensity = fire.intensity;
  group.add(fireLight);
  group.userData.fireLight = fireLight;

  const [cx, cz] = o.chimney.center;
  const half = o.chimney.size / 2;
  group.add(
    box(materials.brick, {
      x: [cx - half, cx + half],
      y: o.chimney.y,
      z: [cz - half, cz + half],
    })
  );

  const flueGeometry = new THREE.CylinderGeometry(
    o.flue.radius,
    o.flue.radius,
    o.flue.y[1] - o.flue.y[0],
    16
  );
  const flue = new THREE.Mesh(flueGeometry, materials.metalDark);
  flue.position.set(cx, (o.flue.y[0] + o.flue.y[1]) / 2, cz);
  flue.castShadow = true;
  group.add(flue);

  const capGeometry = new THREE.CylinderGeometry(o.flue.capRadius, o.flue.capRadius, 0.08, 16);
  const flueCap = new THREE.Mesh(capGeometry, materials.metalDark);
  flueCap.position.set(cx, o.flue.y[1] + 0.04, cz);
  flueCap.castShadow = true;
  group.add(flueCap);

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/oven.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/oven.js tests/building/oven.test.js
git commit -m "feat: add brick dome oven with arched mouth, fire glow and flue"
```

---

### Task 11: Service counter

**Files:**
- Create: `src/building/counter.js`
- Test: `tests/building/counter.test.js`

**Interfaces:**
- Consumes: `box` from `src/utils/geometry.js`; `layout.counter`; materials `brick`, `wood`, `woodDark`.
- Produces: `createCounter(materials, layout) -> THREE.Group` named `'counter'`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/counter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCounter } from '../../src/building/counter.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createCounter(stubMaterials(), layout);

describe('createCounter', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('counter');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.counter);
  });

  it('overhangs the wooden top past the brick base', () => {
    const bounds = boundsOf(group);
    expect(bounds.min.x).toBeLessThan(layout.counter.main.x[0]);
    expect(bounds.max.z).toBeGreaterThan(layout.counter.main.z[1]);
  });

  it('tops out at counter height', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeCloseTo(layout.counter.topHeight, 5);
  });

  it('joins the return leg to the main run', () => {
    const { main, ret } = layout.counter;
    expect(ret.z[1]).toBeCloseTo(main.z[1], 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/counter.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/counter.js"`.

- [ ] **Step 3: Write `src/building/counter.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

export function createCounter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'counter';
  const c = layout.counter;
  const o = c.overhang;

  for (const run of [c.main, c.ret]) {
    group.add(
      box(materials.brick, {
        x: run.x,
        y: [0, c.baseHeight],
        z: run.z,
      })
    );
    group.add(
      box(materials.wood, {
        x: [run.x[0] - o, run.x[1] + o],
        y: [c.baseHeight, c.topHeight],
        z: [run.z[0] - o, run.z[1] + o],
      })
    );
  }

  // Vertical wood slats dress the customer-facing side of the main run.
  const slatWidth = 0.16;
  const gap = 0.06;
  for (let x = c.main.x[0]; x < c.main.x[1] - slatWidth; x += slatWidth + gap) {
    group.add(
      box(materials.woodDark, {
        x: [x, x + slatWidth],
        y: [0.06, c.baseHeight - 0.04],
        z: [c.main.z[1], c.main.z[1] + 0.05],
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/counter.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/counter.js tests/building/counter.test.js
git commit -m "feat: add L-shaped service counter with brick base and wood top"
```

---

### Task 12: Front-right wing

**Files:**
- Create: `src/building/sideWing.js`
- Test: `tests/building/sideWing.test.js`

**Interfaces:**
- Consumes: `box`, `wallRun`, `awning` from `src/utils/geometry.js`; `layout.sideWing`; materials `brick`, `plaster`, `glass`, `glow`, `stripe`, `greenPaint`.
- Produces: `createSideWing(materials, layout) -> THREE.Group` named `'sideWing'`, with `group.userData.windowAnchor` — a `THREE.Vector3` where `lighting.js` places the warm interior light.

- [ ] **Step 1: Write the failing test**

Create `tests/building/sideWing.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSideWing } from '../../src/building/sideWing.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createSideWing(stubMaterials(), layout);

describe('createSideWing', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('sideWing');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.sideWing);
  });

  it('publishes a window anchor for the interior light', () => {
    expect(group.userData.windowAnchor).toBeInstanceOf(THREE.Vector3);
  });

  it('projects the awning past the front face', () => {
    expect(layout.sideWing.awning.frontZ).toBeGreaterThan(layout.sideWing.window.z);
  });

  it('glazes exactly one window', () => {
    const panes = group.children.filter((c) => c.material && c.material.name === 'glass');
    expect(panes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/building/sideWing.test.js`
Expected: FAIL — `Failed to resolve import "../../src/building/sideWing.js"`.

- [ ] **Step 3: Write `src/building/sideWing.js`**

```js
import * as THREE from 'three';
import { box, wallRun, awning } from '../utils/geometry.js';

export function createSideWing(materials, layout) {
  const group = new THREE.Group();
  group.name = 'sideWing';
  const s = layout.sideWing;
  const t = s.thickness;
  const w = s.window;

  // East face: solid.
  group.add(
    wallRun(materials.brick, {
      axis: 'z',
      at: s.footprint.x[1],
      span: s.footprint.z,
      y: [0, s.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'z',
      at: s.footprint.x[1],
      span: s.footprint.z,
      y: [s.plinthHeight, s.wallHeight],
      thickness: t,
    })
  );

  // Front face: plinth, header, and piers either side of the window.
  const bay = [w.centerX - w.width / 2, w.centerX + w.width / 2];
  const head = w.sill + w.height;

  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: w.z,
      span: s.footprint.x,
      y: [0, s.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'x',
      at: w.z,
      span: s.footprint.x,
      y: [head, s.wallHeight],
      thickness: t,
    })
  );
  for (const pier of [[s.footprint.x[0], bay[0]], [bay[1], s.footprint.x[1]]]) {
    if (pier[1] - pier[0] <= 0.001) continue;
    group.add(
      wallRun(materials.plaster, {
        axis: 'x',
        at: w.z,
        span: pier,
        y: [s.plinthHeight, head],
        thickness: t,
      })
    );
  }

  group.add(
    box(materials.glass, {
      x: bay,
      y: [w.sill, head],
      z: [w.z - 0.03, w.z + 0.03],
    })
  );
  group.add(
    box(materials.glow, {
      x: [bay[0] + 0.08, bay[1] - 0.08],
      y: [w.sill + 0.08, head - 0.08],
      z: [w.z - 0.14, w.z - 0.11],
    })
  );
  group.add(
    box(materials.greenPaint, {
      x: [bay[0] - 0.08, bay[1] + 0.08],
      y: [w.sill - 0.1, w.sill],
      z: [w.z - t / 2 - 0.06, w.z + t / 2 + 0.06],
    })
  );

  group.add(
    awning(materials.stripe, {
      x: s.awning.x,
      wallZ: w.z + t / 2,
      wallY: s.awning.wallY,
      frontZ: s.awning.frontZ,
      frontY: s.awning.frontY,
      valance: s.awning.valance,
    })
  );

  group.userData.windowAnchor = new THREE.Vector3(w.centerX, (w.sill + head) / 2, w.z - 0.6);

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/building/sideWing.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/sideWing.js tests/building/sideWing.test.js
git commit -m "feat: add front-right wing with lit window and striped awning"
```

---

### Task 13: Lighting rig

**Files:**
- Create: `src/lighting.js`
- Test: `tests/lighting.test.js`

**Interfaces:**
- Consumes: `layout.lighting`.
- Produces: `createLighting(layout, anchors) -> THREE.Group` named `'lighting'` from `src/lighting.js`. `anchors` is `{ lamps: THREE.Vector3[], storefront: THREE.Vector3[], sideWindow: THREE.Vector3 }`. The returned group contains one `HemisphereLight`, one shadow-casting `DirectionalLight` (plus its `target`), and one warm `PointLight` per anchor.

- [ ] **Step 1: Write the failing test**

Create `tests/lighting.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLighting } from '../src/lighting.js';
import { layout } from '../src/layout.js';

const anchors = {
  lamps: [new THREE.Vector3(-9.5, 2.9, 2.5), new THREE.Vector3(-4, 2.9, 2.5)],
  storefront: [new THREE.Vector3(-8, 1.8, 1.2), new THREE.Vector3(-5, 1.8, 1.2)],
  sideWindow: new THREE.Vector3(7, 1.8, 5.4),
};

const group = createLighting(layout, anchors);

describe('createLighting', () => {
  it('returns a named group', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('lighting');
  });

  it('adds exactly one hemisphere light and one sun', () => {
    expect(group.children.filter((c) => c.isHemisphereLight)).toHaveLength(1);
    expect(group.children.filter((c) => c.isDirectionalLight)).toHaveLength(1);
  });

  it('makes the sun cast shadows with the configured bounds', () => {
    const sun = group.children.find((c) => c.isDirectionalLight);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.width).toBe(layout.lighting.sun.shadowMapSize);
    expect(sun.shadow.camera.right).toBe(layout.lighting.sun.shadowBounds);
    expect(sun.shadow.camera.bottom).toBe(-layout.lighting.sun.shadowBounds);
  });

  it('adds one warm point light per anchor', () => {
    const points = group.children.filter((c) => c.isPointLight);
    expect(points).toHaveLength(anchors.lamps.length + anchors.storefront.length + 1);
    for (const light of points) {
      expect(light.decay).toBe(layout.lighting.warm.decay);
      expect(light.distance).toBe(layout.lighting.warm.distance);
    }
  });

  it('places a point light at each supplied anchor', () => {
    const points = group.children.filter((c) => c.isPointLight);
    const at = points.some((l) => l.position.equals(anchors.sideWindow));
    expect(at).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lighting.test.js`
Expected: FAIL — `Failed to resolve import "../src/lighting.js"`.

- [ ] **Step 3: Write `src/lighting.js`**

```js
import * as THREE from 'three';

export function createLighting(layout, anchors) {
  const group = new THREE.Group();
  group.name = 'lighting';
  const l = layout.lighting;

  group.add(new THREE.HemisphereLight(l.hemi.sky, l.hemi.ground, l.hemi.intensity));

  const sun = new THREE.DirectionalLight(l.sun.color, l.sun.intensity);
  sun.position.set(...l.sun.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(l.sun.shadowMapSize, l.sun.shadowMapSize);
  sun.shadow.bias = l.sun.shadowBias;

  const b = l.sun.shadowBounds;
  sun.shadow.camera.left = -b;
  sun.shadow.camera.right = b;
  sun.shadow.camera.top = b;
  sun.shadow.camera.bottom = -b;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.updateProjectionMatrix();

  group.add(sun);
  group.add(sun.target);

  const warmAnchors = [...anchors.lamps, ...anchors.storefront, anchors.sideWindow];
  for (const anchor of warmAnchors) {
    const light = new THREE.PointLight(l.warm.color, l.warm.intensity, l.warm.distance, l.warm.decay);
    light.position.copy(anchor);
    group.add(light);
  }

  return group;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lighting.test.js`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lighting.js tests/lighting.test.js
git commit -m "feat: add hemisphere fill, shadowed sun and warm point lights"
```

---

### Task 14: Scene assembly

**Files:**
- Create: `src/scene.js`
- Test: `tests/scene.test.js`

**Interfaces:**
- Consumes: every `create*` factory, `createLighting`, `createMaterials`, `createTextures`.
- Produces: `createShop(materials, layout) -> THREE.Group` named `'shop'` from `src/scene.js`, with `group.userData.fireLight` forwarded from the oven group. Children appear in this order: `ground`, `perimeter`, `diningWing`, `storefront`, `kitchen`, `oven`, `counter`, `sideWing`, `lighting`.

- [ ] **Step 1: Write the failing test**

Create `tests/scene.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShop } from '../src/scene.js';
import { createMaterials } from '../src/materials.js';
import { createTextures } from '../src/textures.js';
import { layout } from '../src/layout.js';
import { stubCanvasFactory } from './helpers/stubs.js';
import { boundsOf, expectFinite } from './helpers/bounds.js';

const materials = createMaterials(createTextures(stubCanvasFactory()));
const shop = createShop(materials, layout);

describe('createShop', () => {
  it('assembles every part in order', () => {
    expect(shop.children.map((c) => c.name)).toEqual([
      'ground',
      'perimeter',
      'diningWing',
      'storefront',
      'kitchen',
      'oven',
      'counter',
      'sideWing',
      'lighting',
    ]);
  });

  it('has finite bounds', () => {
    expectFinite(boundsOf(shop));
  });

  it('forwards the oven fire light for the flicker loop', () => {
    expect(shop.userData.fireLight).toBeInstanceOf(THREE.PointLight);
  });

  it('builds no roof above the tallest wall except the chimney', () => {
    const chimneyTop = layout.oven.flue.y[1] + 0.1;
    expect(boundsOf(shop).max.y).toBeLessThanOrEqual(chimneyTop + 0.01);
  });

  it('keeps every part inside the lot plus its street apron', () => {
    const bounds = boundsOf(shop);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-40.01);
    expect(bounds.max.x).toBeLessThanOrEqual(40.01);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/scene.test.js`
Expected: FAIL — `Failed to resolve import "../src/scene.js"`.

- [ ] **Step 3: Write `src/scene.js`**

```js
import * as THREE from 'three';
import { createGround } from './building/ground.js';
import { createPerimeter } from './building/perimeter.js';
import { createDiningWing } from './building/diningWing.js';
import { createStorefront } from './building/storefront.js';
import { createKitchen } from './building/kitchen.js';
import { createOven } from './building/oven.js';
import { createCounter } from './building/counter.js';
import { createSideWing } from './building/sideWing.js';
import { createLighting } from './lighting.js';

export function createShop(materials, layout) {
  const shop = new THREE.Group();
  shop.name = 'shop';

  const ground = createGround(materials, layout);
  const perimeter = createPerimeter(materials, layout);
  const diningWing = createDiningWing(materials, layout);
  const storefront = createStorefront(materials, layout);
  const kitchen = createKitchen(materials, layout);
  const oven = createOven(materials, layout);
  const counter = createCounter(materials, layout);
  const sideWing = createSideWing(materials, layout);

  const s = layout.storefront;
  const lighting = createLighting(layout, {
    lamps: storefront.userData.lampAnchors,
    storefront: [
      new THREE.Vector3(-8.6, 1.8, s.z - 1.0),
      new THREE.Vector3(-4.6, 1.8, s.z - 1.0),
    ],
    sideWindow: sideWing.userData.windowAnchor,
  });

  shop.add(ground, perimeter, diningWing, storefront, kitchen, oven, counter, sideWing, lighting);
  shop.userData.fireLight = oven.userData.fireLight;

  return shop;
}
```

- [ ] **Step 4: Run the whole suite to verify everything passes**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 5: Commit**

```bash
git add src/scene.js tests/scene.test.js
git commit -m "feat: assemble every building part into one shop group"
```

---

### Task 15: Renderer, camera and visual verification

**Files:**
- Create: `src/main.js`
- Modify: `index.html` (already created in Task 1 — verify the script tag resolves)

**Interfaces:**
- Consumes: `createShop` from `src/scene.js`; `createMaterials`, `createTextures`; `layout.camera`.
- Produces: nothing importable. `main.js` is the browser entry point.

- [ ] **Step 1: Write `src/main.js`**

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { createShop } from './scene.js';
import { layout } from './layout.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe0f5);

const textures = createTextures();
for (const texture of Object.values(textures)) {
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
}
const materials = createMaterials(textures);
const shop = createShop(materials, layout);
scene.add(shop);

const c = layout.camera;
const target = new THREE.Vector3(...c.target);
const offset = new THREE.Vector3(...c.direction).normalize().multiplyScalar(c.distance);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
camera.position.copy(target).add(offset);
camera.lookAt(target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.copy(target);
controls.maxPolarAngle = Math.PI / 2.05;

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const half = c.frustumSize / 2;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener('resize', resize);

function resetView() {
  camera.position.copy(target).add(offset);
  controls.target.copy(target);
  controls.update();
}
window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') resetView();
});

const fireLight = shop.userData.fireLight;
const baseIntensity = fireLight.userData.baseIntensity;
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  fireLight.intensity =
    baseIntensity * (0.86 + 0.14 * Math.sin(t * 9.3) * Math.sin(t * 3.1));
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

- [ ] **Step 2: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS — all test files green. `main.js` has no test; it is verified visually.

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: Vite writes `dist/` with no errors. This is the check that every import resolves, including `three/addons/controls/OrbitControls.js`.

- [ ] **Step 4: Verify visually in the browser**

Run: `npm run dev`

Open the served URL and confirm each of these against the reference:

1. The view is isometric, the building is roofless, and the interior is visible.
2. Brick coursing is visible on the perimeter walls, oven and plinths.
3. The terracotta floor and the dining wing's wood floor meet without gaps or z-fighting.
4. The storefront shows green framing, glowing glass, the striped awning and the arched sign.
5. The oven dome sits on its brick base with a lit mouth and the flue rising clear above it.
6. The service counter reads as an L facing the plaza.
7. Sidewalk, curb, road and parking stripes surround the lot.
8. Dragging orbits the scene and `R` snaps back to the reference framing.

If any of these fail, fix the responsible module and re-run its test file before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: add renderer, isometric camera, controls and fire flicker"
```

---

## Verification

Final state check, run from the project root:

```bash
npm test && npm run build
```

Expected: every test file passes and `dist/` builds clean.
