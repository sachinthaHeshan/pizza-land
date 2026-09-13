# Far-Side Town Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the ground across the road with a seeded low-poly town (shops, houses, trees, street furniture) that faces the camera, blocks the player, merges into a few meshes, and gets shadows from a sun that follows the view.

**Architecture:** A plain function, `planTown(layout)`, turns `layout.town` and a seed into lots, trees, props, lawns and obstacle footprints. Small model builders turn that plan into ordinary meshes, and `createTown` merges them into one mesh per material. The same plan feeds `playerObstacles`, and `followSun` moves the sun's shadow box with the camera target each frame.

**Tech Stack:** three r186 (with `three/addons/utils/BufferGeometryUtils.js`), vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-12-far-side-town-design.md`

## Global Constraints

- Town bands, verbatim from the spec: kerb strip z 41–44, rear yards 44–52, first row 52–61, front lane 61–74, second row 74–83, front gardens 83–88, tree line 89–93; the town runs x −78 to 78.
- Lots are 10–14 m wide; an alley 2–4 m wide follows a lot with chance 0.35. First row: a shop with chance 0.6, a two-storey shop with chance 0.4, houses one storey. Second row: houses, two storeys with chance 0.7.
- Heights, verbatim: shop walls 3.4 / 6.4 m plus a 0.4 m parapet; house walls 3.0 / 6.0 m plus a roof rise of 2.0 / 2.4 m; a chimney adds 0.4 m. First row at most 7 m, second row at most 9 m, tree line at most 6 m.
- Kerb trees every 12 m from x −72; one bus stop at x −6 in place of a lamp. Tree-line trunks at z 90.2–92.8. Seed 20260912.
- Every shopfront, awning, sign and front door faces **+z** (toward the camera).
- Every random choice comes from `mulberry32(layout.town.seed)`. Nothing in `src/town/` calls `Math.random`.
- `src/town/planTown.js` imports only `src/utils/random.js` — no three.js.
- Every group sets `.name`. Merged town meshes are named `town-<materialName>`.
- Glass and glow neither cast nor receive shadows; every other town mesh does both.
- Shadow box: `shadowBounds` 50, `shadowNear` −20, `shadowFar` 120, `shadowMapSize` 4096 (measured: the view's corners at zoom 1 need a 46.2 m half-extent on a 3440×1440 ultrawide and a depth range of −5.9 to 62.6 m; 4096 keeps the texel at today's 2.4 cm).
- Never split or replace the user's far sidewalk strip (`x −80…80, z 40.9…95`); town lawns are separate slabs above it.
- The user edits `src/layout.js`, `src/main.js` and several test files in this tree: change existing files with small targeted edits only, never whole-file rewrites.
- No commits unless the user asks: never run `git add`, `git commit`, `git stash`, `git checkout`, `git restore` or `git reset`.
- Run tests with `npx vitest run` (append a path to run one file).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/layout.js` | Gains the `town` block, `envelopes.town`, and the shadow bounds/map-size/near/far values |
| `src/textures.js` | The stripe generator takes a colour; adds `stripeBlue` and `stripeGreen` |
| `src/materials.js` | Adds wall paints, roof tiles, foliage, pine, bark, hedge and two stripe materials |
| `src/town/planTown.js` | Plain logic: lots, trees, props, lawns and obstacles from the seed |
| `src/town/buildings.js` | `createShop`, `createHouse`, `shopSignCentre`, `houseDoorCentre` |
| `src/town/nature.js` | `createRoundTree`, `createPine` |
| `src/town/props.js` | Lamp, bench, bin, bus stop, hedge, fence and planter builders, and `PROP_BUILDERS` |
| `src/town/createTown.js` | `buildTownParts`, `mergeByMaterial`, `createTown` |
| `src/scene.js` | Adds the `town` part; forwards the sun as `shop.userData.sun` |
| `src/sim/obstacles.js` | `playerObstacles` also returns the town's footprints |
| `src/lighting.js` | Exposes the sun, reads near/far from layout, exports `followSun` |
| `src/main.js` | Calls `followSun` once per frame |

---

### Task 1: Town settings, materials and awning stripes

**Files:**
- Modify: `src/layout.js`, `src/textures.js`, `src/materials.js`
- Test: `tests/layout.test.js`, `tests/textures.test.js`, `tests/materials.test.js`

**Interfaces:**
- Produces: `layout.town` with exactly the shape in Step 3, and `layout.envelopes.town = { min: [-78, 0, 41], max: [78, 9, 95] }`.
- Produces: texture keys `stripeBlue` and `stripeGreen`; material keys `wallMint`, `wallPeach`, `wallSky`, `wallButter`, `roofRed`, `roofSlate`, `foliage`, `pine`, `bark`, `hedge`, `stripeBlue`, `stripeGreen`. `foliage` and `pine` use `flatShading: true`; the stripe materials tile like `stripe`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/layout.test.js`:

```js
describe('layout.town', () => {
  const t = layout.town;
  const farWalk = layout.ground.sidewalk.find((r) => r.z[0] === layout.ground.kerbs[1].z[1]);

  it('lays every town band inside the far sidewalk strip', () => {
    const bands = [
      t.kerbStrip.z,
      [t.firstRow.back, t.firstRow.front],
      t.firstRow.lane,
      [t.secondRow.back, t.secondRow.front],
      t.secondRow.garden,
      t.treeLine.z,
    ];
    for (const [z0, z1] of bands) {
      expect(z0).toBeGreaterThanOrEqual(farWalk.z[0]);
      expect(z1).toBeLessThanOrEqual(farWalk.z[1]);
    }
    expect(t.x[0]).toBeGreaterThanOrEqual(farWalk.x[0]);
    expect(t.x[1]).toBeLessThanOrEqual(farWalk.x[1]);
  });

  it('orders the bands away from the road', () => {
    expect(t.kerbStrip.z[1]).toBeLessThanOrEqual(t.rearFence.z[0]);
    expect(t.rearFence.z[1]).toBe(t.firstRow.back);
    expect(t.firstRow.front).toBe(t.firstRow.lane[0]);
    expect(t.firstRow.lane[1]).toBe(t.secondRow.back);
    expect(t.secondRow.front).toBe(t.secondRow.garden[0]);
    expect(t.secondRow.garden[1]).toBeLessThanOrEqual(t.treeLine.z[0]);
    expect(t.treeLine.treeZ[0]).toBeGreaterThanOrEqual(t.treeLine.z[0]);
    expect(t.treeLine.treeZ[1]).toBeLessThanOrEqual(t.treeLine.z[1]);
  });

  it('caps the tallest possible buildings so the far lane stays in view', () => {
    const rise = layout.camera.direction[1] / layout.camera.direction[2];
    const farLane = Math.max(...layout.ground.lanes.map((l) => l.z));
    const tallestFirst = Math.max(
      t.shopWalls[1] + t.parapet,
      t.houseWalls[0] + t.roofRise[0] + t.chimney.rise
    );
    const tallestSecond = t.houseWalls[1] + t.roofRise[1] + t.chimney.rise;
    expect(tallestFirst).toBeLessThanOrEqual(t.firstRow.maxHeight);
    expect(tallestSecond).toBeLessThanOrEqual(t.secondRow.maxHeight);
    expect(t.firstRow.maxHeight).toBeLessThan((t.firstRow.back - farLane) * rise);
  });

  it('keeps the town envelope inside the ground', () => {
    const env = layout.envelopes.town;
    const ground = layout.envelopes.ground;
    for (const axis of [0, 2]) {
      expect(env.min[axis]).toBeGreaterThanOrEqual(ground.min[axis]);
      expect(env.max[axis]).toBeLessThanOrEqual(ground.max[axis]);
    }
  });
});
```

Append inside `describe('createTextures', ...)` in `tests/textures.test.js`:

```js
  it('draws ten-band blue and green awning stripes alongside the red one', () => {
    expect(TEXTURE_KEYS).toEqual(expect.arrayContaining(['stripe', 'stripeBlue', 'stripeGreen']));
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    for (const key of ['stripe', 'stripeBlue', 'stripeGreen']) {
      const rects = canvases[TEXTURE_KEYS.indexOf(key)].__calls.filter(([m]) => m === 'fillRect');
      expect(rects, key).toHaveLength(10);
    }
  });
```

Append inside `describe('createMaterials', ...)` in `tests/materials.test.js`:

```js
  it('gives the town its wall, roof, foliage and awning materials', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    const flat = ['wallMint', 'wallPeach', 'wallSky', 'wallButter', 'roofRed', 'roofSlate', 'foliage', 'pine', 'bark', 'hedge'];
    for (const key of flat) {
      expect(m[key], key).toBeInstanceOf(THREE.MeshStandardMaterial);
    }
    expect(m.stripeBlue.map).toBe(textures.stripeBlue);
    expect(m.stripeGreen.map).toBe(textures.stripeGreen);
    expect(m.stripeBlue.userData.tile).toBe(m.stripe.userData.tile);
    expect(m.stripeGreen.userData.tile).toBe(m.stripe.userData.tile);
    expect(m.foliage.flatShading).toBe(true);
    expect(m.pine.flatShading).toBe(true);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/layout.test.js tests/textures.test.js tests/materials.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'kerbStrip')` for `layout.town`, `expected [...] to include 'stripeBlue'`, and `wallMint: expected undefined to be an instance of MeshStandardMaterial`.

- [ ] **Step 3: Add the town block to `src/layout.js`**

Insert this block directly above the line `  lighting: {` (a targeted edit; leave every other line alone):

```js
  // A small town across the road. Every choice comes from the seed, so it is
  // the same on every load. The camera sits on the +z, −x side, so fronts face
  // +z, and buildings stay low enough never to hide the road.
  town: {
    seed: 20260912,
    x: [-78, 78],
    kerbStrip: {
      z: [41, 44],
      lampZ: 41.6,
      binZ: 41.6,
      treeZ: 42.6,
      benchZ: 43.2,
      firstTreeX: -72,
      treeSpacing: 12,
      benchOffset: 3,
      binOffset: 3,
      busStopX: -6,
    },
    rearFence: { z: [44.5, 52] },
    firstRow: { back: 52, front: 61, lane: [61, 74], shopChance: 0.6, twoStoreyChance: 0.4, maxHeight: 7 },
    secondRow: { back: 74, front: 83, garden: [83, 88], twoStoreyChance: 0.7, maxHeight: 9 },
    lot: { minWidth: 10, maxWidth: 14, alleyChance: 0.35, alleyWidth: [2, 4] },
    shopWalls: [3.4, 6.4],
    houseWalls: [3.0, 6.0],
    parapet: 0.4,
    roofRise: [2.0, 2.4],
    chimney: { chance: 0.5, rise: 0.4 },
    laneProps: { planterOffset: 1.6, planterZ: 62.2, benchZ: 66 },
    gardenHedge: { z: 87.8, doorGap: 1.6, inset: 0.3 },
    treeLine: { z: [89, 93], treeZ: [90.2, 92.8], firstX: -72, spacing: 12, jitter: 1, pineChance: 0.7 },
    trees: { round: [4.5, 5.2], pine: [5, 6] },
  },

```

Inside `envelopes`, directly after the `traffic: { ... },` line, add:

```js
    town: { min: [-78, 0, 41], max: [78, 9, 95] },
```

- [ ] **Step 4: Add the stripe colours to `src/textures.js`**

Replace the whole `function stripe(factory) { ... }` block with:

```js
function stripes(factory, colour) {
  const width = 256;
  const height = 64;
  const canvas = factory(width, height);
  const ctx = canvas.getContext('2d');
  const bands = 10;
  const w = width / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? colour : '#f6efe4';
    ctx.fillRect(i * w, 0, w, height);
  }
  return finish(canvas);
}

const stripe = (factory) => stripes(factory, '#d8382f');
const stripeBlue = (factory) => stripes(factory, '#2f6fb0');
const stripeGreen = (factory) => stripes(factory, '#3f8a4f');
```

In `TEXTURE_KEYS`, after `'ovenBanner',` add:

```js
  'stripeBlue',
  'stripeGreen',
```

In `GENERATORS`, after `ovenBanner: ovenBannerTexture,` add:

```js
  stripeBlue,
  stripeGreen,
```

- [ ] **Step 5: Add the town materials to `src/materials.js`**

In `MATERIAL_KEYS`, after `'ovenBanner',` add:

```js
  'wallMint',
  'wallPeach',
  'wallSky',
  'wallButter',
  'roofRed',
  'roofSlate',
  'foliage',
  'pine',
  'bark',
  'hedge',
  'stripeBlue',
  'stripeGreen',
```

In `TILE`, after `stripe: 3.5,` add:

```js
  stripeBlue: 3.5,
  stripeGreen: 3.5,
```

Inside the `materials` object, directly before the `  };` that closes it (after the `markerEdge` entry), add:

```js
    // Town palette. Foliage is flat-shaded so the low-poly canopies read as
    // facets rather than blobs.
    wallMint: standard('wallMint', { color: 0xb8dcc3, roughness: 0.9, metalness: 0.0 }),
    wallPeach: standard('wallPeach', { color: 0xf2c4a4, roughness: 0.9, metalness: 0.0 }),
    wallSky: standard('wallSky', { color: 0xb7d3ea, roughness: 0.9, metalness: 0.0 }),
    wallButter: standard('wallButter', { color: 0xf3e2a0, roughness: 0.9, metalness: 0.0 }),
    roofRed: standard('roofRed', { color: 0xb5553a, roughness: 0.8, metalness: 0.02 }),
    roofSlate: standard('roofSlate', { color: 0x5d6570, roughness: 0.75, metalness: 0.05 }),
    foliage: standard('foliage', { color: 0x5f9a4a, roughness: 0.85, metalness: 0.0, flatShading: true }),
    pine: standard('pine', { color: 0x3f6f45, roughness: 0.85, metalness: 0.0, flatShading: true }),
    bark: standard('bark', { color: 0x6b4a33, roughness: 0.9, metalness: 0.0 }),
    hedge: standard('hedge', { color: 0x4a7a3f, roughness: 0.9, metalness: 0.0 }),
    stripeBlue: standard('stripeBlue', { map: textures.stripeBlue, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide }),
    stripeGreen: standard('stripeGreen', { map: textures.stripeGreen, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide }),
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green, including the user's existing ground tests.

- [ ] **Step 7: Commit (only if the user asks)**

```bash
git add src/layout.js src/textures.js src/materials.js tests/layout.test.js tests/textures.test.js tests/materials.test.js
git commit -m "feat: add town settings, palette and awning stripe colours"
```

---

### Task 2: Town plan

**Files:**
- Create: `src/town/planTown.js`
- Test: `tests/town/planTown.test.js`

**Interfaces:**
- Consumes: `layout.town` from Task 1; `mulberry32` from `src/utils/random.js`.
- Produces: `planTown(layout) -> { lots, trees, props, lawns, obstacles }`:
  - `lots[]`: `{ row: 'first' | 'second', kind: 'shop' | 'house', x: [x0, x1], z: [back, front], storeys, walls, rise, height, wall, roof?, awning?, sign?, chimney }`. Shops have `awning`, `sign`, `rise: 0`, `chimney: false`; houses have `roof`. `walls` is the wall height, `rise` the roof rise, and `height` the total including any chimney. Colours are material keys.
  - `trees[]`: `{ kind: 'round' | 'pine', x, z, height }`.
  - `props[]`: `{ kind, x, z, facing, size: { w, d, h } }` where `x, z` is the footprint centre, `w` runs along x, `d` along z, and `facing` is `1` or `-1` (the z direction a bench seat faces).
  - `lawns[]`: `{ x: [x0, x1], z: [z0, z1] }`.
  - `obstacles[]`: `{ x: [x0, x1], z: [z0, z1] }` — every lot, every tree trunk (0.5 m square), and every prop footprint.

- [ ] **Step 1: Write the failing test**

Create `tests/town/planTown.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { planTown } from '../../src/town/planTown.js';
import { layout } from '../../src/layout.js';

const t = layout.town;
const plan = planTown(layout);
const first = plan.lots.filter((lot) => lot.row === 'first');
const second = plan.lots.filter((lot) => lot.row === 'second');
const kerbTrees = plan.trees.filter((tree) => tree.z === t.kerbStrip.treeZ);
const lineTrees = plan.trees.filter((tree) => tree.z >= t.treeLine.z[0]);
const ofKind = (kind) => plan.props.filter((p) => p.kind === kind);

function overlaps(a, b) {
  const eps = 1e-9;
  return a.x[0] < b.x[1] - eps && b.x[0] < a.x[1] - eps && a.z[0] < b.z[1] - eps && b.z[0] < a.z[1] - eps;
}

describe('planTown', () => {
  it('builds the same town every time from the same seed', () => {
    expect(planTown(layout)).toEqual(plan);
  });

  it('builds a different town from a different seed', () => {
    const other = planTown({ ...layout, town: { ...t, seed: t.seed + 1 } });
    expect(other.lots.map((lot) => lot.x)).not.toEqual(plan.lots.map((lot) => lot.x));
  });

  it('fills each row across the town with lots 10 to 14 m wide', () => {
    for (const row of [first, second]) {
      expect(row.length).toBeGreaterThanOrEqual(8);
      for (const lot of row) {
        const width = lot.x[1] - lot.x[0];
        expect(width).toBeGreaterThanOrEqual(t.lot.minWidth - 1e-9);
        expect(width).toBeLessThanOrEqual(t.lot.maxWidth + 1e-9);
        expect(lot.x[0]).toBeGreaterThanOrEqual(t.x[0]);
        expect(lot.x[1]).toBeLessThanOrEqual(t.x[1]);
      }
      // Whatever is left after the last lot is too narrow for another one.
      expect(t.x[1] - row.at(-1).x[1]).toBeLessThan(t.lot.minWidth + t.lot.alleyWidth[1]);
    }
  });

  it('keeps each row in its band, with no two lots overlapping', () => {
    for (const lot of first) expect(lot.z).toEqual([t.firstRow.back, t.firstRow.front]);
    for (const lot of second) expect(lot.z).toEqual([t.secondRow.back, t.secondRow.front]);
    for (let i = 0; i < plan.lots.length; i++) {
      for (let j = i + 1; j < plan.lots.length; j++) {
        expect(overlaps(plan.lots[i], plan.lots[j]), `lots ${i} and ${j}`).toBe(false);
      }
    }
  });

  it('mixes shops and houses in the first row and keeps the second row to houses', () => {
    expect(first.some((lot) => lot.kind === 'shop')).toBe(true);
    expect(first.some((lot) => lot.kind === 'house')).toBe(true);
    expect(second.every((lot) => lot.kind === 'house')).toBe(true);
  });

  it('gives buildings the heights in the spec table', () => {
    const allowed = {
      'shop-1': [3.8],
      'shop-2': [6.8],
      'house-1': [5.0, 5.4],
      'house-2': [8.4, 8.8],
    };
    for (const lot of plan.lots) {
      const options = allowed[`${lot.kind}-${lot.storeys}`];
      const label = `${lot.row} ${lot.kind}, ${lot.storeys} storeys, ${lot.height} m`;
      expect(options.some((h) => Math.abs(h - lot.height) < 1e-9), label).toBe(true);
    }
  });

  it('keeps every building low enough that the road stays in view', () => {
    for (const lot of first) expect(lot.height).toBeLessThanOrEqual(t.firstRow.maxHeight);
    for (const lot of second) expect(lot.height).toBeLessThanOrEqual(t.secondRow.maxHeight);
  });

  it('lines the kerb with trees 12 m apart and a lamp or the bus stop between each pair', () => {
    expect(kerbTrees.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < kerbTrees.length; i++) {
      expect(kerbTrees[i].x - kerbTrees[i - 1].x).toBeCloseTo(t.kerbStrip.treeSpacing, 9);
    }
    const posts = [...ofKind('lamp'), ...ofKind('busStop')];
    expect(posts).toHaveLength(kerbTrees.length - 1);
    for (let i = 1; i < kerbTrees.length; i++) {
      const mid = (kerbTrees[i - 1].x + kerbTrees[i].x) / 2;
      expect(posts.some((p) => Math.abs(p.x - mid) < 1e-9), `post at x ${mid}`).toBe(true);
    }
  });

  it('puts exactly one bus stop at x −6, at least 1.5 m clear of every kerb tree', () => {
    const stops = ofKind('busStop');
    expect(stops).toHaveLength(1);
    const [stop] = stops;
    expect(stop.x).toBeCloseTo(t.kerbStrip.busStopX, 9);
    for (const tree of kerbTrees) {
      const gap = Math.max(stop.x - stop.size.w / 2 - tree.x, tree.x - (stop.x + stop.size.w / 2));
      expect(gap, `tree at x ${tree.x}`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('spaces the tree line at least 10 m apart and at most 6 m tall', () => {
    const xs = lineTrees.map((tree) => tree.x).sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(10 - 1e-9);
    for (const tree of lineTrees) {
      expect(tree.height).toBeLessThanOrEqual(6);
      expect(tree.z).toBeGreaterThanOrEqual(t.treeLine.treeZ[0]);
      expect(tree.z).toBeLessThanOrEqual(t.treeLine.treeZ[1]);
    }
  });

  it('places nothing on the road or the kerb', () => {
    for (const box of plan.obstacles) expect(box.z[0]).toBeGreaterThanOrEqual(t.kerbStrip.z[0]);
    for (const lawn of plan.lawns) expect(lawn.z[0]).toBeGreaterThanOrEqual(t.kerbStrip.z[0]);
  });

  it('gives each second-row house a lawn and a hedge with a gap at its door', () => {
    expect(plan.lawns).toHaveLength(second.length);
    const hedges = ofKind('hedge');
    expect(hedges).toHaveLength(second.length * 2);
    for (const lot of second) {
      const door = (lot.x[0] + lot.x[1]) / 2;
      const own = hedges.filter((h) => h.x > lot.x[0] && h.x < lot.x[1]);
      expect(own).toHaveLength(2);
      for (const h of own) {
        const left = h.x - h.size.w / 2;
        const right = h.x + h.size.w / 2;
        const clear = right <= door - t.gardenHedge.doorGap / 2 + 1e-9 || left >= door + t.gardenHedge.doorGap / 2 - 1e-9;
        expect(clear, `hedge at x ${h.x}`).toBe(true);
      }
    }
  });

  it('turns every lot, tree trunk and prop into an obstacle', () => {
    expect(plan.obstacles).toHaveLength(plan.lots.length + plan.trees.length + plan.props.length);
    for (const lot of plan.lots) expect(plan.obstacles).toContainEqual({ x: lot.x, z: lot.z });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/town/planTown.test.js`
Expected: FAIL — `Cannot find module '../../src/town/planTown.js'`.

- [ ] **Step 3: Write `src/town/planTown.js`**

```js
import { mulberry32 } from '../utils/random.js';

// Plain logic for the town across the road: it turns layout.town and its seed
// into lots, trees, props, lawns and obstacle footprints. The builders draw
// the plan and the player's obstacles read it, so what you see is what blocks
// you. No three.js here, so the rules step deterministically in tests.

const SHOP_WALLS = ['brick', 'wallMint', 'wallPeach', 'wallSky', 'wallButter'];
const HOUSE_WALLS = ['wallMint', 'wallPeach', 'wallSky', 'wallButter'];
const ROOFS = ['roofRed', 'roofSlate'];
const AWNINGS = ['stripe', 'stripeBlue', 'stripeGreen'];
const SIGNS = ['greenPaint', 'roofRed', 'roofSlate', 'woodDark'];

// Footprint (w along x, d along z) and height of each prop, in metres.
const PROP_SIZES = {
  lamp: { w: 0.3, d: 0.3, h: 3.8 },
  bench: { w: 1.6, d: 0.5, h: 0.9 },
  bin: { w: 0.5, d: 0.5, h: 0.9 },
  busStop: { w: 3.2, d: 1.8, h: 2.6 },
  planter: { w: 0.8, d: 0.8, h: 1.1 },
  hedge: { d: 0.4, h: 0.8 },
  fence: { w: 0.1, h: 0.9 },
};
const TRUNK_SIZE = 0.5;

const pick = (list, roll) => list[Math.floor(roll * list.length)];
const between = ([lo, hi], roll) => lo + (hi - lo) * roll;
const footprint = (x, z, w, d) => ({ x: [x - w / 2, x + w / 2], z: [z - d / 2, z + d / 2] });
const prop = (kind, x, z, facing, size) => ({ kind, x, z, facing, size });

// Splits the town's width into lots from left to right, with occasional alleys.
function lotSpans(rng, town) {
  const { minWidth, maxWidth, alleyChance, alleyWidth } = town.lot;
  const spans = [];
  let x = town.x[0];
  while (town.x[1] - x >= minWidth) {
    const width = Math.min(between([minWidth, maxWidth], rng()), town.x[1] - x);
    spans.push([x, x + width]);
    x += width;
    if (rng() < alleyChance) x += between(alleyWidth, rng());
  }
  return spans;
}

export function planTown(layout) {
  const t = layout.town;
  const rng = mulberry32(t.seed);
  const lots = [];
  const trees = [];
  const props = [];
  const lawns = [];

  // First row: shops and one-storey houses. Each lot draws its rolls in a
  // fixed order, so one rule change never reshuffles the rest of the town.
  for (const x of lotSpans(rng, t)) {
    const [kindRoll, storeyRoll, wallRoll, roofRoll, awningRoll, signRoll, chimneyRoll] =
      [rng(), rng(), rng(), rng(), rng(), rng(), rng()];
    const z = [t.firstRow.back, t.firstRow.front];
    if (kindRoll < t.firstRow.shopChance) {
      const storeys = storeyRoll < t.firstRow.twoStoreyChance ? 2 : 1;
      const walls = t.shopWalls[storeys - 1];
      lots.push({
        row: 'first', kind: 'shop', x, z, storeys, walls, rise: 0, height: walls + t.parapet,
        wall: pick(SHOP_WALLS, wallRoll), awning: pick(AWNINGS, awningRoll), sign: pick(SIGNS, signRoll),
        chimney: false,
      });
    } else {
      const walls = t.houseWalls[0];
      const rise = t.roofRise[0];
      const chimney = chimneyRoll < t.chimney.chance;
      lots.push({
        row: 'first', kind: 'house', x, z, storeys: 1, walls, rise,
        height: walls + rise + (chimney ? t.chimney.rise : 0),
        wall: pick(HOUSE_WALLS, wallRoll), roof: pick(ROOFS, roofRoll), chimney,
      });
    }
  }

  // Second row: houses.
  for (const x of lotSpans(rng, t)) {
    const [storeyRoll, wallRoll, roofRoll, chimneyRoll] = [rng(), rng(), rng(), rng()];
    const storeys = storeyRoll < t.secondRow.twoStoreyChance ? 2 : 1;
    const walls = t.houseWalls[storeys - 1];
    const rise = t.roofRise[storeys - 1];
    const chimney = chimneyRoll < t.chimney.chance;
    lots.push({
      row: 'second', kind: 'house', x, z: [t.secondRow.back, t.secondRow.front], storeys, walls, rise,
      height: walls + rise + (chimney ? t.chimney.rise : 0),
      wall: pick(HOUSE_WALLS, wallRoll), roof: pick(ROOFS, roofRoll), chimney,
    });
  }

  // Kerb strip: a tree every 12 m with a bench beside it and a bin at every
  // other tree, then a lamp midway between each pair — or the bus stop.
  const k = t.kerbStrip;
  const kerbTreeXs = [];
  for (let x = k.firstTreeX, i = 0; x + k.benchOffset + PROP_SIZES.bench.w / 2 <= t.x[1]; x += k.treeSpacing, i++) {
    kerbTreeXs.push(x);
    trees.push({ kind: 'round', x, z: k.treeZ, height: between(t.trees.round, rng()) });
    props.push(prop('bench', x + k.benchOffset, k.benchZ, -1, PROP_SIZES.bench));
    if (i % 2 === 0) props.push(prop('bin', x - k.binOffset, k.binZ, -1, PROP_SIZES.bin));
  }
  const stopZ = k.lampZ - PROP_SIZES.lamp.d / 2 + PROP_SIZES.busStop.d / 2;
  for (let i = 1; i < kerbTreeXs.length; i++) {
    const mid = (kerbTreeXs[i - 1] + kerbTreeXs[i]) / 2;
    if (Math.abs(mid - k.busStopX) < 1e-6) {
      props.push(prop('busStop', mid, stopZ, -1, PROP_SIZES.busStop));
    } else {
      props.push(prop('lamp', mid, k.lampZ, -1, PROP_SIZES.lamp));
    }
  }

  // Rear yards: a low fence along every first-row lot edge, shared edges once.
  const firstLots = lots.filter((lot) => lot.row === 'first');
  const fenceXs = [];
  for (const lot of firstLots) {
    for (const x of lot.x) if (!fenceXs.some((f) => Math.abs(f - x) < 1e-6)) fenceXs.push(x);
  }
  const [fenceZ0, fenceZ1] = t.rearFence.z;
  for (const x of fenceXs) {
    const size = { w: PROP_SIZES.fence.w, d: fenceZ1 - fenceZ0, h: PROP_SIZES.fence.h };
    props.push(prop('fence', x, (fenceZ0 + fenceZ1) / 2, 1, size));
  }

  // Front lane: a planter beside each first-row door, a bench at every second lot.
  firstLots.forEach((lot, i) => {
    const cx = (lot.x[0] + lot.x[1]) / 2;
    props.push(prop('planter', cx + t.laneProps.planterOffset, t.laneProps.planterZ, 1, PROP_SIZES.planter));
    if (i % 2 === 1) props.push(prop('bench', cx, t.laneProps.benchZ, 1, PROP_SIZES.bench));
  });

  // Front gardens: a lawn and a hedge with a gap at the door for each house.
  const g = t.gardenHedge;
  for (const lot of lots.filter((l) => l.row === 'second')) {
    lawns.push({ x: [...lot.x], z: [...t.secondRow.garden] });
    const cx = (lot.x[0] + lot.x[1]) / 2;
    const segments = [
      [lot.x[0] + g.inset, cx - g.doorGap / 2],
      [cx + g.doorGap / 2, lot.x[1] - g.inset],
    ];
    for (const [a, b] of segments) {
      const size = { w: b - a, d: PROP_SIZES.hedge.d, h: PROP_SIZES.hedge.h };
      props.push(prop('hedge', (a + b) / 2, g.z, 1, size));
    }
  }

  // Tree line: one tree per slot, nudged a little, mostly pines.
  const tl = t.treeLine;
  for (let x = tl.firstX; x <= t.x[1] - tl.spacing / 2; x += tl.spacing) {
    const [jitterRoll, zRoll, kindRoll, heightRoll] = [rng(), rng(), rng(), rng()];
    const kind = kindRoll < tl.pineChance ? 'pine' : 'round';
    trees.push({
      kind,
      x: x + (jitterRoll * 2 - 1) * tl.jitter,
      z: between(tl.treeZ, zRoll),
      height: between(t.trees[kind], heightRoll),
    });
  }

  const obstacles = [
    ...lots.map((lot) => ({ x: [...lot.x], z: [...lot.z] })),
    ...trees.map((tree) => footprint(tree.x, tree.z, TRUNK_SIZE, TRUNK_SIZE)),
    ...props.map((p) => footprint(p.x, p.z, p.size.w, p.size.d)),
  ];

  return { lots, trees, props, lawns, obstacles };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/town/planTown.test.js`
Expected: PASS — 13 passing tests. If "mixes shops and houses" or a count check fails, the seed produced an unusual town: report it rather than changing the seed or the rules.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/town/planTown.js tests/town/planTown.test.js
git commit -m "feat: plan the far-side town from a seed"
```

---

### Task 3: Shops and houses

**Files:**
- Create: `src/town/buildings.js`
- Test: `tests/town/buildings.test.js`

**Interfaces:**
- Consumes: lot records shaped as Task 2 produces them; `box` and `awning` from `src/utils/geometry.js`; materials `stone`, `glass`, `woodDark`, `brick` plus each lot's `wall`, `roof`, `awning` and `sign` keys.
- Produces:
  - `createShop(materials, lot) -> THREE.Group` named `'shop'`, built in world space from the lot.
  - `createHouse(materials, lot) -> THREE.Group` named `'house'`.
  - `shopSignCentre(lot) -> THREE.Vector3` and `houseDoorCentre(lot) -> THREE.Vector3`: points 1 cm in front of a shop's sign board and a house's door. Task 6's visibility test aims at them.

- [ ] **Step 1: Write the failing test**

Create `tests/town/buildings.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createShop, createHouse, shopSignCentre, houseDoorCentre } from '../../src/town/buildings.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const shopLot = {
  row: 'first', kind: 'shop', x: [10, 22], z: [52, 61], storeys: 2, walls: 6.4, rise: 0, height: 6.8,
  wall: 'wallMint', awning: 'stripeBlue', sign: 'woodDark', chimney: false,
};
const houseLot = {
  row: 'second', kind: 'house', x: [-20, -8], z: [74, 83], storeys: 2, walls: 6.0, rise: 2.4, height: 8.8,
  wall: 'wallPeach', roof: 'roofSlate', chimney: true,
};

function meshesWith(group, materialName) {
  const found = [];
  group.traverse((o) => {
    if (o.isMesh && o.material.name === materialName) found.push(o);
  });
  return found;
}

describe('createShop', () => {
  it('builds a named shop that fills its lot and reaches its planned height', () => {
    const shop = createShop(stubMaterials(), shopLot);
    expect(shop.name).toBe('shop');
    const all = boundsOf(shop);
    expectFinite(all);
    expect(all.min.y).toBeGreaterThanOrEqual(0);
    expect(all.max.y).toBeCloseTo(6.8, 5);
    const walls = boundsOf(meshesWith(shop, 'wallMint')[0]);
    expect(walls.min.x).toBeCloseTo(10.1, 5);
    expect(walls.max.x).toBeCloseTo(21.9, 5);
    expect(walls.min.z).toBeCloseTo(52, 5);
    expect(walls.max.z).toBeCloseTo(61, 5);
    expect(walls.max.y).toBeCloseTo(6.4, 5);
  });

  it('puts the glass front, awning and sign on the +z face', () => {
    const shop = createShop(stubMaterials(), shopLot);
    const glass = meshesWith(shop, 'glass').map(boundsOf);
    expect(glass.some((b) => b.min.z >= 61 - 1e-6 && b.max.y <= 2.6 + 1e-6)).toBe(true);
    for (const b of glass) expect(b.max.z).toBeGreaterThan(52.5);
    const awning = meshesWith(shop, 'stripeBlue').map(boundsOf);
    expect(awning.length).toBeGreaterThan(0);
    for (const b of awning) expect(b.min.z).toBeGreaterThanOrEqual(61 - 1e-6);
    const sign = meshesWith(shop, 'woodDark').map(boundsOf).filter((b) => b.min.y > 2.5);
    expect(sign).toHaveLength(1);
    expect(sign[0].min.z).toBeGreaterThanOrEqual(61);
  });

  it('tops the shop with a stone parapet', () => {
    const shop = createShop(stubMaterials(), shopLot);
    const caps = meshesWith(shop, 'stone').map(boundsOf).filter((b) => Math.abs(b.max.y - 6.8) < 1e-6);
    expect(caps).toHaveLength(1);
    expect(caps[0].min.y).toBeCloseTo(6.4, 5);
  });

  it('gives only a two-storey shop upstairs windows, on the +z and −x faces', () => {
    const upstairs = (lot) => meshesWith(createShop(stubMaterials(), lot), 'glass').map(boundsOf).filter((b) => b.min.y > 3.4);
    const two = upstairs(shopLot);
    expect(two.some((b) => b.min.z >= 61 - 1e-6)).toBe(true);
    expect(two.some((b) => b.max.x <= 10.1 + 1e-6)).toBe(true);
    expect(upstairs({ ...shopLot, storeys: 1, walls: 3.4, height: 3.8 })).toHaveLength(0);
  });

  it('aims the sign centre just in front of the sign board', () => {
    const board = meshesWith(createShop(stubMaterials(), shopLot), 'woodDark').map(boundsOf).find((b) => b.min.y > 2.5);
    const point = shopSignCentre(shopLot);
    expect(point.x).toBeCloseTo(16, 5);
    expect(point.y).toBeGreaterThan(board.min.y);
    expect(point.y).toBeLessThan(board.max.y);
    expect(point.z).toBeGreaterThan(board.max.z);
    expect(point.z).toBeLessThan(board.max.z + 0.05);
  });
});

describe('createHouse', () => {
  it('builds a named house whose roof ridge rises above its walls', () => {
    const house = createHouse(stubMaterials(), houseLot);
    expect(house.name).toBe('house');
    const walls = boundsOf(meshesWith(house, 'wallPeach')[0]);
    expect(walls.max.y).toBeCloseTo(6.0, 5);
    expect(walls.min.z).toBeCloseTo(74, 5);
    expect(walls.max.z).toBeCloseTo(83, 5);
    const roof = boundsOf(meshesWith(house, 'roofSlate')[0]);
    expect(roof.min.y).toBeCloseTo(6.0, 5);
    expect(roof.max.y).toBeCloseTo(8.4, 5);
    expect(roof.min.x).toBeCloseTo(-20, 5);
    expect(roof.max.x).toBeCloseTo(-8, 5);
  });

  it('puts the door and its step on the +z face', () => {
    const house = createHouse(stubMaterials(), houseLot);
    const door = boundsOf(meshesWith(house, 'woodDark')[0]);
    expect(door.min.z).toBeGreaterThanOrEqual(83 - 1e-6);
    const step = meshesWith(house, 'stone').map(boundsOf).filter((b) => b.max.y <= 0.2);
    expect(step).toHaveLength(1);
    expect(step[0].min.z).toBeGreaterThanOrEqual(83 - 1e-6);
  });

  it('gives each storey two front windows and two side windows', () => {
    const glass = meshesWith(createHouse(stubMaterials(), houseLot), 'glass').map(boundsOf);
    expect(glass.filter((b) => b.min.z >= 83 - 1e-6)).toHaveLength(4);
    expect(glass.filter((b) => b.max.x <= -19.9 + 1e-6)).toHaveLength(4);
  });

  it('adds a chimney, topping the planned height, only when the lot has one', () => {
    const withChimney = createHouse(stubMaterials(), houseLot);
    expect(meshesWith(withChimney, 'brick')).toHaveLength(1);
    expect(boundsOf(withChimney).max.y).toBeCloseTo(8.8, 5);
    const without = createHouse(stubMaterials(), { ...houseLot, chimney: false, height: 8.4 });
    expect(meshesWith(without, 'brick')).toHaveLength(0);
    expect(boundsOf(without).max.y).toBeCloseTo(8.4, 5);
  });

  it('aims the door centre just in front of the door', () => {
    const door = boundsOf(meshesWith(createHouse(stubMaterials(), houseLot), 'woodDark')[0]);
    const point = houseDoorCentre(houseLot);
    expect(point.x).toBeCloseTo(-14, 5);
    expect(point.y).toBeGreaterThan(door.min.y);
    expect(point.y).toBeLessThan(door.max.y);
    expect(point.z).toBeGreaterThan(door.max.z);
    expect(point.z).toBeLessThan(door.max.z + 0.05);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/town/buildings.test.js`
Expected: FAIL — `Cannot find module '../../src/town/buildings.js'`.

- [ ] **Step 3: Write `src/town/buildings.js`**

```js
import * as THREE from 'three';
import { box, awning } from '../utils/geometry.js';

// Shops and houses for the far-side town, built straight into world space
// from a planTown lot. Every front faces +z: the fixed camera never sees a
// face that points −z.

const INSET = 0.1; // walls stop short of the lot edge so neighbours don't z-fight
const PROUD = 0.06; // glass sits this far out from a wall
const FLOOR = 0.01; // matches layout.floorContact

const SIGN_Y = 3.35;
const SIGN_FRONT = 0.14;
const STEP_TOP = 0.15;
const DOOR_HEIGHT = 2.1;
const DOOR_DEPTH = 0.08;

// A window on the +z face: a stone frame with a glass pane just proud of it.
function frontWindow(group, materials, x, y, faceZ) {
  group.add(box(materials.stone, { x: [x - 0.75, x + 0.75], y: [y - 0.65, y + 0.65], z: [faceZ, faceZ + 0.04] }));
  group.add(box(materials.glass, { x: [x - 0.6, x + 0.6], y: [y - 0.5, y + 0.5], z: [faceZ + 0.04, faceZ + PROUD] }));
}

// A window on the −x face.
function sideWindow(group, materials, z, y, faceX) {
  group.add(box(materials.stone, { x: [faceX - 0.04, faceX], y: [y - 0.65, y + 0.65], z: [z - 0.75, z + 0.75] }));
  group.add(box(materials.glass, { x: [faceX - PROUD, faceX - 0.04], y: [y - 0.5, y + 0.5], z: [z - 0.6, z + 0.6] }));
}

// A pitched roof with its ridge along x: a triangle extruded across the lot.
function pitchedRoof(material, { x, z, y, rise }) {
  const depth = z[1] - z[0];
  const shape = new THREE.Shape([
    new THREE.Vector2(-depth / 2, 0),
    new THREE.Vector2(depth / 2, 0),
    new THREE.Vector2(0, rise),
  ]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: x[1] - x[0], bevelEnabled: false });
  // The triangle is drawn in XY and extruded along +Z. A quarter turn about Y
  // runs the extrusion along +X, so the ridge runs along the row.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x[0], y, (z[0] + z[1]) / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'roof';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function shopSignCentre(lot) {
  return new THREE.Vector3((lot.x[0] + lot.x[1]) / 2, SIGN_Y, lot.z[1] + SIGN_FRONT + 0.01);
}

export function houseDoorCentre(lot) {
  return new THREE.Vector3((lot.x[0] + lot.x[1]) / 2, STEP_TOP + DOOR_HEIGHT / 2, lot.z[1] + DOOR_DEPTH + 0.01);
}

export function createShop(materials, lot) {
  const group = new THREE.Group();
  group.name = 'shop';
  const [x0, x1] = lot.x;
  const [zBack, zFront] = lot.z;
  const cx = (x0 + x1) / 2;
  const wallX = [x0 + INSET, x1 - INSET];

  group.add(box(materials[lot.wall], { x: wallX, y: [FLOOR, lot.walls], z: [zBack, zFront] }));
  // Parapet: a stone cap standing slightly proud of the roof edge.
  group.add(
    box(materials.stone, {
      x: [wallX[0] - 0.05, wallX[1] + 0.05],
      y: [lot.walls, lot.height],
      z: [zBack - 0.05, zFront + 0.05],
    })
  );

  // Ground-floor glass front and a door, on the face the camera sees.
  group.add(box(materials.glass, { x: [x0 + 0.8, x1 - 0.8], y: [0.4, 2.6], z: [zFront, zFront + PROUD] }));
  group.add(
    box(materials.woodDark, {
      x: [cx - 0.55, cx + 0.55],
      y: [FLOOR, DOOR_HEIGHT],
      z: [zFront + PROUD, zFront + PROUD + 0.04],
    })
  );

  group.add(
    awning(materials[lot.awning], {
      x: [x0 + 0.6, x1 - 0.6],
      wallZ: zFront,
      wallY: 3.0,
      frontZ: zFront + 1.4,
      frontY: 2.6,
      valance: 0.25,
    })
  );

  // Signboard with a stone border, above the awning.
  group.add(box(materials.stone, { x: [cx - 2.3, cx + 2.3], y: [SIGN_Y - 0.4, SIGN_Y + 0.4], z: [zFront, zFront + 0.08] }));
  group.add(
    box(materials[lot.sign], {
      x: [cx - 2.2, cx + 2.2],
      y: [SIGN_Y - 0.3, SIGN_Y + 0.3],
      z: [zFront + 0.08, zFront + SIGN_FRONT],
    })
  );

  if (lot.storeys === 2) {
    for (let wx = x0 + 2; wx <= x1 - 2 + 1e-9; wx += 2.8) frontWindow(group, materials, wx, 4.9, zFront);
    for (let wz = zBack + 2; wz <= zFront - 2 + 1e-9; wz += 2.5) sideWindow(group, materials, wz, 4.9, wallX[0]);
  }

  return group;
}

export function createHouse(materials, lot) {
  const group = new THREE.Group();
  group.name = 'house';
  const [x0, x1] = lot.x;
  const [zBack, zFront] = lot.z;
  const cx = (x0 + x1) / 2;
  const zMid = (zBack + zFront) / 2;
  const wallX = [x0 + INSET, x1 - INSET];

  group.add(box(materials[lot.wall], { x: wallX, y: [FLOOR, lot.walls], z: [zBack, zFront] }));
  // The roof overhangs front and back but stays within the lot's width, so
  // neighbouring roofs never overlap.
  group.add(pitchedRoof(materials[lot.roof], { x: [x0, x1], z: [zBack - 0.3, zFront + 0.3], y: lot.walls, rise: lot.rise }));

  // Front door on a step, on the face the camera sees.
  group.add(box(materials.stone, { x: [cx - 0.8, cx + 0.8], y: [FLOOR, STEP_TOP], z: [zFront, zFront + 0.5] }));
  group.add(
    box(materials.woodDark, {
      x: [cx - 0.5, cx + 0.5],
      y: [STEP_TOP, STEP_TOP + DOOR_HEIGHT],
      z: [zFront, zFront + DOOR_DEPTH],
    })
  );

  for (let storey = 0; storey < lot.storeys; storey++) {
    const wy = 1.6 + storey * 3.0;
    for (const wx of [cx - 2.6, cx + 2.6]) frontWindow(group, materials, wx, wy, zFront);
    for (const wz of [zMid - 2, zMid + 2]) sideWindow(group, materials, wz, wy, wallX[0]);
  }

  if (lot.chimney) {
    // Starts inside the roof and pokes above the ridge to the lot's height.
    group.add(
      box(materials.brick, {
        x: [x1 - 2.2, x1 - 1.6],
        y: [lot.walls + lot.rise * 0.4, lot.height],
        z: [zMid - 1.0, zMid - 0.4],
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/town/buildings.test.js`
Expected: PASS — 10 passing tests.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/town/buildings.js tests/town/buildings.test.js
git commit -m "feat: add town shop and house builders facing the camera"
```

---

### Task 4: Trees and street furniture

**Files:**
- Create: `src/town/nature.js`, `src/town/props.js`
- Test: `tests/town/nature.test.js`, `tests/town/props.test.js`

**Interfaces:**
- Consumes: tree and prop records shaped as Task 2 produces them; `box` from `src/utils/geometry.js`; materials `bark`, `foliage`, `pine`, `metalDark`, `glow`, `wood`, `greenPaint`, `glass`, `stone`, `hedge`.
- Produces:
  - `createRoundTree(materials, tree)` → group `'roundTree'`; `createPine(materials, tree)` → group `'pine'`. Both stand on y = 0, reach `tree.height` exactly, and keep the trunk inside a 0.5 m square.
  - `createLamp`, `createBench`, `createBin`, `createBusStop`, `createHedge`, `createFence`, `createPlanter`, each `(materials, prop)` → a group named after the kind. Every part stays inside the prop's `size` footprint and reaches `size.h` exactly.
  - `PROP_BUILDERS`: `{ lamp, bench, bin, busStop, hedge, fence, planter }` mapping each kind to its builder.

- [ ] **Step 1: Write the failing tests**

Create `tests/town/nature.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRoundTree, createPine } from '../../src/town/nature.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('town trees', () => {
  it('builds a round tree on the ground at its planned height, centred on its spot', () => {
    const tree = createRoundTree(stubMaterials(), { kind: 'round', x: -12, z: 42.6, height: 5 });
    expect(tree.name).toBe('roundTree');
    const b = boundsOf(tree);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(5, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(-12, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(42.6, 5);
  });

  it('builds a pine on the ground at its planned height, centred on its spot', () => {
    const tree = createPine(stubMaterials(), { kind: 'pine', x: 30, z: 91, height: 6 });
    expect(tree.name).toBe('pine');
    const b = boundsOf(tree);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(6, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(30, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(91, 5);
  });

  it('keeps each trunk inside the 0.5 m square the plan blocks', () => {
    for (const [build, height] of [[createRoundTree, 5.2], [createPine, 6]]) {
      const trunks = [];
      build(stubMaterials(), { x: 0, z: 0, height }).traverse((o) => {
        if (o.isMesh && o.material.name === 'bark') trunks.push(boundsOf(o));
      });
      expect(trunks).toHaveLength(1);
      expect(trunks[0].max.x - trunks[0].min.x).toBeLessThanOrEqual(0.5);
      expect(trunks[0].max.z - trunks[0].min.z).toBeLessThanOrEqual(0.5);
    }
  });
});
```

Create `tests/town/props.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PROP_BUILDERS } from '../../src/town/props.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const cases = [
  { kind: 'lamp', x: 2, z: 41.6, facing: -1, size: { w: 0.3, d: 0.3, h: 3.8 } },
  { kind: 'bench', x: -9, z: 43.2, facing: -1, size: { w: 1.6, d: 0.5, h: 0.9 } },
  { kind: 'bin', x: 5, z: 41.6, facing: -1, size: { w: 0.5, d: 0.5, h: 0.9 } },
  { kind: 'busStop', x: -6, z: 42.35, facing: -1, size: { w: 3.2, d: 1.8, h: 2.6 } },
  { kind: 'hedge', x: 30, z: 87.8, facing: 1, size: { w: 4.2, d: 0.4, h: 0.8 } },
  { kind: 'fence', x: 12, z: 48.25, facing: 1, size: { w: 0.1, d: 7.5, h: 0.9 } },
  { kind: 'planter', x: 17.6, z: 62.2, facing: 1, size: { w: 0.8, d: 0.8, h: 1.1 } },
];

function meshBounds(group, materialName) {
  const found = [];
  group.traverse((o) => {
    if (o.isMesh && o.material.name === materialName) found.push(boundsOf(o));
  });
  return found;
}

describe('town props', () => {
  it('has a builder for every prop kind the plan uses', () => {
    expect(Object.keys(PROP_BUILDERS).sort()).toEqual(['bench', 'bin', 'busStop', 'fence', 'hedge', 'lamp', 'planter']);
  });

  for (const prop of cases) {
    it(`builds a ${prop.kind} on the ground, inside its footprint, at its height`, () => {
      const model = PROP_BUILDERS[prop.kind](stubMaterials(), prop);
      expect(model.name).toBe(prop.kind);
      const b = boundsOf(model);
      expect(b.min.y).toBeGreaterThanOrEqual(0);
      expect(b.min.y).toBeLessThanOrEqual(0.02);
      expect(b.max.y).toBeCloseTo(prop.size.h, 5);
      expect(b.min.x).toBeGreaterThanOrEqual(prop.x - prop.size.w / 2 - 1e-6);
      expect(b.max.x).toBeLessThanOrEqual(prop.x + prop.size.w / 2 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(prop.z - prop.size.d / 2 - 1e-6);
      expect(b.max.z).toBeLessThanOrEqual(prop.z + prop.size.d / 2 + 1e-6);
    });
  }

  it('puts a bench backrest on the side away from the way it faces', () => {
    const bench = cases[1];
    for (const facing of [-1, 1]) {
      const rest = meshBounds(PROP_BUILDERS.bench(stubMaterials(), { ...bench, facing }), 'wood').find((b) => b.max.y > 0.6);
      const restZ = (rest.min.z + rest.max.z) / 2;
      expect(Math.sign(restZ - bench.z)).toBe(-facing);
    }
  });

  it('puts the bus stop glass on the side away from the road', () => {
    const stop = cases[3];
    const glass = meshBounds(PROP_BUILDERS.busStop(stubMaterials(), stop), 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0].min.z).toBeGreaterThan(stop.z);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/town/nature.test.js tests/town/props.test.js`
Expected: FAIL — `Cannot find module '../../src/town/nature.js'` and `Cannot find module '../../src/town/props.js'`.

- [ ] **Step 3: Write `src/town/nature.js`**

```js
import * as THREE from 'three';

// Low-poly trees. Canopy and trunk segment counts are even so each tree is
// symmetric about its spot; the flat-shaded materials give the facets.

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRoundTree(materials, { x, z, height }) {
  const group = new THREE.Group();
  group.name = 'roundTree';
  const trunkHeight = height * 0.35;
  const radius = height * 0.3;
  group.add(part(new THREE.CylinderGeometry(0.18, 0.24, trunkHeight, 8), materials.bark, x, trunkHeight / 2, z));
  group.add(part(new THREE.SphereGeometry(radius, 8, 5), materials.foliage, x, height - radius, z));
  return group;
}

export function createPine(materials, { x, z, height }) {
  const group = new THREE.Group();
  group.name = 'pine';
  const trunkHeight = height * 0.2;
  const lower = height * 0.55;
  const upper = height * 0.45;
  group.add(part(new THREE.CylinderGeometry(0.15, 0.2, trunkHeight, 8), materials.bark, x, trunkHeight / 2, z));
  group.add(part(new THREE.ConeGeometry(height * 0.26, lower, 8), materials.pine, x, trunkHeight + lower / 2, z));
  group.add(part(new THREE.ConeGeometry(height * 0.18, upper, 8), materials.pine, x, height - upper / 2, z));
  return group;
}
```

- [ ] **Step 4: Write `src/town/props.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// Street furniture for the town. Each builder keeps every part inside the
// prop's footprint (size.w along x, size.d along z), because the plan blocks
// the player with exactly that footprint. `facing` is the z direction a seat
// or shelter opens toward.

const FLOOR = 0.01;

function named(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function createLamp(materials, { x, z, size }) {
  const lamp = named('lamp');
  const half = size.w / 2;
  lamp.add(box(materials.metalDark, { x: [x - half, x + half], y: [FLOOR, 0.2], z: [z - half, z + half] }));
  lamp.add(box(materials.metalDark, { x: [x - 0.05, x + 0.05], y: [0.2, size.h - 0.2], z: [z - 0.05, z + 0.05] }));
  lamp.add(box(materials.metalDark, { x: [x - half, x + half], y: [size.h - 0.2, size.h], z: [z - half, z + half] }));
  const glow = box(materials.glow, { x: [x - 0.12, x + 0.12], y: [size.h - 0.25, size.h - 0.2], z: [z - 0.12, z + 0.12] });
  glow.castShadow = false;
  lamp.add(glow);
  return lamp;
}

export function createBench(materials, { x, z, facing, size }) {
  const bench = named('bench');
  const hw = size.w / 2;
  const hd = size.d / 2;
  bench.add(box(materials.wood, { x: [x - hw, x + hw], y: [0.42, 0.5], z: [z - hd, z + hd] }));
  for (const lx of [x - hw + 0.1, x + hw - 0.15]) {
    bench.add(box(materials.metalDark, { x: [lx, lx + 0.05], y: [FLOOR, 0.42], z: [z - hd + 0.05, z + hd - 0.05] }));
  }
  // The backrest stands on the side behind the sitter.
  const back = facing < 0 ? [z + hd - 0.08, z + hd] : [z - hd, z - hd + 0.08];
  bench.add(box(materials.wood, { x: [x - hw, x + hw], y: [0.5, size.h], z: back }));
  return bench;
}

export function createBin(materials, { x, z, size }) {
  const bin = named('bin');
  const half = size.w / 2;
  bin.add(box(materials.greenPaint, { x: [x - half + 0.03, x + half - 0.03], y: [FLOOR, size.h - 0.1], z: [z - half + 0.03, z + half - 0.03] }));
  bin.add(box(materials.metalDark, { x: [x - half, x + half], y: [size.h - 0.1, size.h], z: [z - half, z + half] }));
  return bin;
}

export function createBusStop(materials, { x, z, facing, size }) {
  const stop = named('busStop');
  const hw = size.w / 2;
  const hd = size.d / 2;
  // Open toward `facing`; the glass back panel and the bench are on the far side.
  const back = facing < 0 ? [z + hd - 0.08, z + hd] : [z - hd, z - hd + 0.08];
  const seat = facing < 0 ? [z + hd - 0.6, z + hd - 0.1] : [z - hd + 0.1, z - hd + 0.6];
  const front = facing < 0 ? [z - hd, z - hd + 0.08] : [z + hd - 0.08, z + hd];

  stop.add(box(materials.metalDark, { x: [x - hw, x + hw], y: [size.h - 0.1, size.h], z: [z - hd, z + hd] }));
  stop.add(box(materials.glass, { x: [x - hw + 0.1, x + hw - 0.1], y: [0.3, size.h - 0.2], z: back }));
  for (const px of [x - hw, x + hw - 0.08]) {
    stop.add(box(materials.metalDark, { x: [px, px + 0.08], y: [FLOOR, size.h - 0.1], z: back }));
  }
  stop.add(box(materials.wood, { x: [x - hw + 0.4, x + hw - 0.4], y: [0.42, 0.5], z: seat }));
  stop.add(box(materials.metalDark, { x: [x + hw - 0.08, x + hw], y: [FLOOR, size.h - 0.1], z: front }));
  stop.add(box(materials.greenPaint, { x: [x + hw - 0.5, x + hw - 0.08], y: [size.h - 0.6, size.h - 0.15], z: front }));
  return stop;
}

export function createHedge(materials, { x, z, size }) {
  const hedge = named('hedge');
  hedge.add(box(materials.hedge, { x: [x - size.w / 2, x + size.w / 2], y: [FLOOR, size.h], z: [z - size.d / 2, z + size.d / 2] }));
  return hedge;
}

export function createFence(materials, { x, z, size }) {
  const fence = named('fence');
  const hw = size.w / 2;
  const z0 = z - size.d / 2;
  const z1 = z + size.d / 2;
  const posts = Math.max(2, Math.ceil(size.d / 1.2) + 1);
  for (let i = 0; i < posts; i++) {
    const pz = z0 + ((z1 - z0 - 0.1) * i) / (posts - 1);
    fence.add(box(materials.stone, { x: [x - hw, x + hw], y: [FLOOR, size.h], z: [pz, pz + 0.1] }));
  }
  for (const rail of [[0.35, 0.43], [0.7, 0.78]]) {
    fence.add(box(materials.stone, { x: [x - hw * 0.6, x + hw * 0.6], y: rail, z: [z0, z1] }));
  }
  return fence;
}

export function createPlanter(materials, { x, z, size }) {
  const planter = named('planter');
  const half = size.w / 2;
  planter.add(box(materials.stone, { x: [x - half, x + half], y: [FLOOR, 0.5], z: [z - half, z + half] }));
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5), materials.foliage);
  shrub.position.set(x, size.h - 0.3, z);
  shrub.castShadow = true;
  shrub.receiveShadow = true;
  planter.add(shrub);
  return planter;
}

export const PROP_BUILDERS = {
  lamp: createLamp,
  bench: createBench,
  bin: createBin,
  busStop: createBusStop,
  hedge: createHedge,
  fence: createFence,
  planter: createPlanter,
};
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/town/nature.test.js tests/town/props.test.js`
Expected: PASS — 3 tree tests and 10 prop tests.

- [ ] **Step 6: Commit (only if the user asks)**

```bash
git add src/town/nature.js src/town/props.js tests/town/nature.test.js tests/town/props.test.js
git commit -m "feat: add town trees and street furniture"
```

---

### Task 5: The merged town

**Files:**
- Create: `src/town/createTown.js`
- Test: `tests/town/createTown.test.js`

**Interfaces:**
- Consumes: `planTown` (Task 2); `createShop`, `createHouse` (Task 3); `createRoundTree`, `createPine`, `PROP_BUILDERS` (Task 4); `slab` from `src/utils/geometry.js`; `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`; `layout.ground.floorY.paving`, `layout.surfaceEps`, `layout.envelopes.town` (Task 1).
- Produces:
  - `buildTownParts(materials, layout, plan = planTown(layout)) -> THREE.Group` named `'townParts'`: every piece as an ordinary mesh, plus lawns as `planting` slabs `surfaceEps` above the paving.
  - `mergeByMaterial(parts, name) -> THREE.Group` named `name`: one mesh per material, named `${name}-${material.name}`. Transparent or non-depth-writing materials neither cast nor receive shadows.
  - `createTown(materials, layout) -> THREE.Group` named `'town'`.

- [ ] **Step 1: Write the failing test**

Create `tests/town/createTown.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTown, buildTownParts } from '../../src/town/createTown.js';
import { createMaterials } from '../../src/materials.js';
import { createTextures } from '../../src/textures.js';
import { layout } from '../../src/layout.js';
import { stubCanvasFactory } from '../helpers/stubs.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';

// Real materials: which pieces cast shadows depends on glass being transparent
// and glow not writing depth, which stub materials don't model.
const materials = createMaterials(createTextures(stubCanvasFactory()));
const town = createTown(materials, layout);

describe('createTown', () => {
  it('returns a group named town, with finite bounds inside its envelope', () => {
    expect(town).toBeInstanceOf(THREE.Group);
    expect(town.name).toBe('town');
    const bounds = boundsOf(town);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.town);
  });

  it('merges the whole town into one mesh per material', () => {
    const used = new Set();
    buildTownParts(materials, layout).traverse((o) => {
      if (o.isMesh) used.add(o.material);
    });
    expect(town.children.every((child) => child.isMesh)).toBe(true);
    expect(town.children).toHaveLength(used.size);
    expect(new Set(town.children.map((child) => child.material)).size).toBe(town.children.length);
    expect(town.children.length).toBeLessThanOrEqual(30);
  });

  it('moves nothing while merging', () => {
    const before = boundsOf(buildTownParts(materials, layout));
    const after = boundsOf(town);
    for (const corner of ['min', 'max']) {
      for (const axis of ['x', 'y', 'z']) expect(after[corner][axis]).toBeCloseTo(before[corner][axis], 6);
    }
  });

  it('keeps every vertex, so no piece is lost in merging', () => {
    let before = 0;
    buildTownParts(materials, layout).traverse((o) => {
      if (o.isMesh) before += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    });
    let after = 0;
    for (const mesh of town.children) after += mesh.geometry.attributes.position.count;
    expect(after).toBe(before);
  });

  it('casts shadows from solid pieces but not from glass or the lamp glow', () => {
    const byMaterial = Object.fromEntries(town.children.map((mesh) => [mesh.material.name, mesh]));
    expect(byMaterial.glass.castShadow).toBe(false);
    expect(byMaterial.glass.receiveShadow).toBe(false);
    expect(byMaterial.glow.castShadow).toBe(false);
    expect(byMaterial.stone.castShadow).toBe(true);
    expect(byMaterial.metalDark.castShadow).toBe(true);
    expect(byMaterial.foliage.castShadow).toBe(true);
    expect(byMaterial.planting.receiveShadow).toBe(true);
  });

  it('names each merged mesh after its material', () => {
    for (const mesh of town.children) expect(mesh.name).toBe(`town-${mesh.material.name}`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/town/createTown.test.js`
Expected: FAIL — `Cannot find module '../../src/town/createTown.js'`.

- [ ] **Step 3: Write `src/town/createTown.js`**

```js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { slab } from '../utils/geometry.js';
import { planTown } from './planTown.js';
import { createShop, createHouse } from './buildings.js';
import { createRoundTree, createPine } from './nature.js';
import { PROP_BUILDERS } from './props.js';

const KEEP = new Set(['position', 'normal', 'uv']);

// Every town piece as an ordinary mesh, before merging. Exposed so tests can
// check that merging moves and loses nothing.
export function buildTownParts(materials, layout, plan = planTown(layout)) {
  const parts = new THREE.Group();
  parts.name = 'townParts';
  for (const lot of plan.lots) {
    parts.add(lot.kind === 'shop' ? createShop(materials, lot) : createHouse(materials, lot));
  }
  for (const tree of plan.trees) {
    parts.add(tree.kind === 'pine' ? createPine(materials, tree) : createRoundTree(materials, tree));
  }
  for (const prop of plan.props) parts.add(PROP_BUILDERS[prop.kind](materials, prop));
  const lawnY = layout.ground.floorY.paving + layout.surfaceEps;
  for (const lawn of plan.lawns) {
    parts.add(slab(materials.planting, { x: lawn.x, z: lawn.z, y: lawnY, renderOrder: 1 }));
  }
  return parts;
}

// Bakes every mesh into world space and merges them into one mesh per
// material. Geometries are made non-indexed first, because indexed boxes and
// cones cannot otherwise merge with non-indexed extruded roofs.
export function mergeByMaterial(parts, name) {
  parts.updateMatrixWorld(true);
  const buckets = new Map();
  parts.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index !== null ? object.geometry.toNonIndexed() : object.geometry.clone();
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!KEEP.has(attribute)) geometry.deleteAttribute(attribute);
    }
    geometry.applyMatrix4(object.matrixWorld);
    if (!buckets.has(object.material)) buckets.set(object.material, []);
    buckets.get(object.material).push(geometry);
  });

  const group = new THREE.Group();
  group.name = name;
  for (const [material, geometries] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
    for (const geometry of geometries) geometry.dispose();
    mesh.name = `${name}-${material.name}`;
    const glowing = material.transparent || material.depthWrite === false;
    mesh.castShadow = !glowing;
    mesh.receiveShadow = !glowing;
    group.add(mesh);
  }
  return group;
}

export function createTown(materials, layout) {
  const parts = buildTownParts(materials, layout);
  const town = mergeByMaterial(parts, 'town');
  parts.traverse((object) => {
    if (object.isMesh) object.geometry.dispose();
  });
  return town;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/town/createTown.test.js`
Expected: PASS — 6 passing tests. If `mergeGeometries` returns `null`, a piece has an attribute set the others lack: report which builder produced it rather than dropping the piece.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/town/createTown.js tests/town/createTown.test.js
git commit -m "feat: merge the far-side town into one mesh per material"
```

---

### Task 6: The town in the scene

**Files:**
- Modify: `src/scene.js`, `tests/scene.test.js`

**Interfaces:**
- Consumes: `createTown` (Task 5); `planTown` (Task 2); `shopSignCentre`, `houseDoorCentre` (Task 3).
- Produces: `createShop` (the scene builder in `src/scene.js`) adds a `town` child between `queue` and the simulation group. The part order becomes `ground, parking, perimeter, diningWing, storefront, kitchen, oven, counter, sideWing, queue, town, simulation, lighting`.

- [ ] **Step 1: Change the failing tests**

In `tests/scene.test.js`, add `'town'` to the expected list in "assembles every part in order", directly after `'queue'`.

Replace the body of "builds no roof above the tallest wall except the chimney" with a check that measures the shop alone, since the town's houses are taller than the shop's cut-away walls:

```js
  it('builds no roof above the tallest wall except the chimney', () => {
    const chimneyTop = layout.oven.flue.y[1] + 0.1;
    const shopOnly = new THREE.Box3();
    for (const part of shop.children) {
      if (part.name !== 'town') shopOnly.union(boundsOf(part));
    }
    expect(shopOnly.max.y).toBeLessThanOrEqual(chimneyTop + 0.01);
  });
```

Add these imports at the top of the file:

```js
import { planTown } from '../src/town/planTown.js';
import { shopSignCentre, houseDoorCentre } from '../src/town/buildings.js';
```

Append inside `describe('createShop', ...)`:

```js
  // The town faces away from the road on purpose: this camera only ever sees
  // faces pointing +z or −x. A front that ends up hidden is the mistake this
  // catches, the same way the zone outline test catches a hidden marker.
  it('keeps town shop signs and second-row doors where the game camera can see them', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|cashier|pedestrian-|pizzaHops)/;
    // Foliage is exempt. The tree line stands nearer the camera than the second
    // row, so a 6 m tree at z 89 crosses the sight line to a door at y 1.2 — a
    // house glimpsed through a tree is the look we want. Solid building fronts
    // hidden by other buildings are what this test is for.
    const foliage = new Set(['foliage', 'pine', 'bark']);
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh || o.material.transparent || foliage.has(o.material.name)) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const plan = planTown(layout);
    const fronts = [
      ...plan.lots.filter((lot) => lot.kind === 'shop').map(shopSignCentre),
      ...plan.lots.filter((lot) => lot.row === 'second').map(houseDoorCentre),
    ];
    expect(fronts.length).toBeGreaterThan(10);

    const ray = new THREE.Raycaster();
    for (const front of fronts) {
      ray.set(front.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
      // Stop short of the front itself, which sits on the town's own mesh.
      ray.far = 200 - 0.05;
      const label = `front at (${front.x.toFixed(1)}, ${front.z.toFixed(1)})`;
      expect(ray.intersectObjects(blockers, false), label).toHaveLength(0);
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/scene.test.js`
Expected: FAIL — the part order misses `town`, and `Cannot find module '../src/town/planTown.js'` if Tasks 2–5 are not yet in place.

- [ ] **Step 3: Add the town to `src/scene.js`**

Add the import beside the other builders:

```js
import { createTown } from './town/createTown.js';
```

Build it next to the other parts:

```js
  const town = createTown(materials, layout);
```

And add it to the assembly, between `queue` and the simulation group:

```js
  shop.add(
    ground, parking, perimeter, diningWing, storefront, kitchen, oven,
    counter, sideWing, queue, town, simulation.group, lighting
  );
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green. If a front is reported hidden, name the blocking mesh in your report rather than moving the front: the town's heights and bands are the spec's, and a hidden front means a band or height is wrong.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/scene.js tests/scene.test.js
git commit -m "feat: put the far-side town in the scene"
```

---

### Task 7: The town blocks the player

**Files:**
- Modify: `src/sim/obstacles.js`, `tests/sim/obstacles.test.js`

**Interfaces:**
- Consumes: `planTown(layout).obstacles` (Task 2).
- Produces: `playerObstacles(layout)` returns the shop's boxes followed by every town footprint, so the player is stopped by town buildings, tree trunks and props.

- [ ] **Step 1: Write the failing tests**

In `tests/sim/obstacles.test.js`, add the import:

```js
import { planTown } from '../../src/town/planTown.js';
```

Append inside `describe('playerObstacles', ...)`:

```js
  it('stops a walker at a town building', () => {
    const lot = planTown(layout).lots.find((l) => l.row === 'first');
    const middle = (lot.x[0] + lot.x[1]) / 2;
    const end = walk(middle, lot.z[0] - 4, 0, 1, 5);
    expect(end.z).toBeLessThan(lot.z[0]);
    expect(end.z).toBeGreaterThan(lot.z[0] - 0.6);
  });

  it('stops a walker at a kerb tree', () => {
    const tree = planTown(layout).trees.find((t) => t.z === layout.town.kerbStrip.treeZ);
    const end = walk(tree.x, tree.z - 1.5, 0, 1, 2);
    expect(end.z).toBeLessThan(tree.z - 0.25);
  });

  it('stops a walker at a kerb bench', () => {
    const bench = planTown(layout).props.find((p) => p.kind === 'bench' && p.z === layout.town.kerbStrip.benchZ);
    const end = walk(bench.x, bench.z - 1.5, 0, 1, 2);
    expect(end.z).toBeLessThan(bench.z - bench.size.d / 2);
  });

  // x 20 is a deliberate gap in the kerb line: the nearest lamp is at 18, the
  // nearest tree at 24, the nearest bench at 15. Walking the kerb top works
  // because every kerb footprint starts at z 41.35 or beyond, and a walker at
  // z 40.95 only reaches 41.20.
  it('lets a walker cross the road and follow the kerb', () => {
    const kerbTop = layout.ground.kerbs[1].z[1];
    const crossed = walk(20, 30, 0, 1, 11);
    expect(crossed.z).toBeGreaterThan(kerbTop);
    const along = walk(20, kerbTop + 0.05, 1, 0, 20);
    expect(along.x).toBeGreaterThan(39);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/obstacles.test.js`
Expected: FAIL — the walker passes straight through the building, the tree and the bench, so each `end.z` overshoots.

- [ ] **Step 3: Add the town's footprints in `src/sim/obstacles.js`**

Add the import at the top:

```js
import { planTown } from '../town/planTown.js';
```

And directly before `return boxes;` at the end of `playerObstacles`:

```js
  // The town across the road blocks the player exactly where it is drawn:
  // both come from the same plan.
  boxes.push(...planTown(layout).obstacles);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/obstacles.test.js tests/sim/player.test.js tests/sim/simulation.test.js`
Expected: PASS — the new town tests, the existing shop tests, and the walk-to-oven reachability guard all green.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit (only if the user asks)**

```bash
git add src/sim/obstacles.js tests/sim/obstacles.test.js
git commit -m "feat: block the player with the town's buildings, trees and props"
```

---

### Task 8: Shadows that follow the view

**Files:**
- Modify: `src/layout.js`, `src/lighting.js`, `src/scene.js`, `src/main.js`
- Test: `tests/lighting.test.js`, `tests/scene.test.js`, `tests/main.test.js`

**Interfaces:**
- Produces: `layout.lighting.sun.shadowBounds` becomes 50 and `shadowMapSize` 4096, plus `shadowNear: -20` and `shadowFar: 120`.
- Produces: `createLighting(layout, anchors)` sets the shadow camera's near and far from layout and exposes the sun as `group.userData.sun`; `createShop` forwards it as `shop.userData.sun`.
- Produces: `followSun(sun, target, layout)` exported from `src/lighting.js`. It snaps `target` to whole shadow texels across the light's view, puts `sun.target` there and the sun at that point plus `layout.lighting.sun.position`, then updates both world matrices.

- [ ] **Step 1: Write the failing tests**

In `tests/lighting.test.js`, add these imports and helpers below the existing ones:

```js
import { createLighting, followSun } from '../src/lighting.js';
import { panTargetLimits, clampPanTarget } from '../src/ui/panBounds.js';

const c = layout.camera;
const home = new THREE.Vector3(...c.target);
const viewOffset = new THREE.Vector3(...c.direction).normalize().multiplyScalar(c.distance);

function viewCamera(target, aspect) {
  const half = c.frustumSize / 2;
  const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 400);
  camera.position.copy(target).add(viewOffset);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function cornersAt(camera, y) {
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sy]) => {
    const near = new THREE.Vector3(sx, sy, -1).unproject(camera);
    const far = new THREE.Vector3(sx, sy, 1).unproject(camera);
    return near.clone().lerp(far, (y - near.y) / (far.y - near.y));
  });
}

function pannedTarget(wish, aspect) {
  const target = wish.clone();
  const camera = viewCamera(target, aspect);
  const limits = panTargetLimits({
    camera,
    target,
    bounds: layout.envelopes.ground,
    padding: c.panPadding ?? 0,
    preferred: { x: home.x, y: home.y, z: home.z },
  });
  clampPanTarget(target, camera.position, limits);
  return target;
}
```

(The file already imports `createLighting`; merge the two imports rather than repeating one.)

Append inside `describe('createLighting', ...)`:

```js
  it('exposes the sun for the render loop', () => {
    expect(group.userData.sun).toBe(group.children.find((child) => child.isDirectionalLight));
  });

  it('takes its shadow depth range from layout', () => {
    const sun = group.userData.sun;
    expect(sun.shadow.camera.near).toBe(layout.lighting.sun.shadowNear);
    expect(sun.shadow.camera.far).toBe(layout.lighting.sun.shadowFar);
  });
});

describe('followSun', () => {
  it('keeps every corner of the view inside the shadow box while panning', () => {
    const sun = group.userData.sun;
    const { shadowBounds, shadowNear, shadowFar } = layout.lighting.sun;
    const roofHeight = layout.envelopes.town.max[1];
    const wishes = [
      home,
      new THREE.Vector3(0, home.y, 200),
      new THREE.Vector3(-200, home.y, 200),
      new THREE.Vector3(200, home.y, 200),
      new THREE.Vector3(-200, home.y, -200),
      new THREE.Vector3(200, home.y, -200),
    ];
    // 2.389 is a 3440x1440 ultrawide; 2.5 is a window dragged wider still.
    for (const aspect of [16 / 9, 21 / 9, 2.389, 2.5]) {
      for (const wish of wishes) {
        const target = wish === home ? home.clone() : pannedTarget(wish, aspect);
        followSun(sun, target, layout);
        sun.shadow.updateMatrices(sun);
        const camera = viewCamera(target, aspect);
        const label = `aspect ${aspect.toFixed(2)}, target (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`;
        for (const point of [...cornersAt(camera, 0), ...cornersAt(camera, roofHeight)]) {
          const local = point.clone().applyMatrix4(sun.shadow.camera.matrixWorldInverse);
          expect(Math.abs(local.x), label).toBeLessThanOrEqual(shadowBounds);
          expect(Math.abs(local.y), label).toBeLessThanOrEqual(shadowBounds);
          expect(-local.z, label).toBeGreaterThanOrEqual(shadowNear);
          expect(-local.z, label).toBeLessThanOrEqual(shadowFar);
        }
      }
    }
  });

  it('keeps the sun at its configured offset from what it lights', () => {
    const sun = group.userData.sun;
    followSun(sun, new THREE.Vector3(12, 1.2, 60), layout);
    const offset = sun.position.clone().sub(sun.target.position);
    const [ox, oy, oz] = layout.lighting.sun.position;
    expect(offset.x).toBeCloseTo(ox, 6);
    expect(offset.y).toBeCloseTo(oy, 6);
    expect(offset.z).toBeCloseTo(oz, 6);
  });

  it('moves the sun only in whole shadow texels', () => {
    const sun = group.userData.sun;
    const { position, shadowBounds, shadowMapSize } = layout.lighting.sun;
    const texel = (2 * shadowBounds) / shadowMapSize;
    const basis = new THREE.Matrix4().lookAt(
      new THREE.Vector3(...position),
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0)
    );
    const right = new THREE.Vector3().setFromMatrixColumn(basis, 0);

    followSun(sun, home, layout);
    const onGrid = sun.target.position.clone();
    const start = sun.position.clone();

    followSun(sun, onGrid.clone().addScaledVector(right, 0.4 * texel), layout);
    expect(sun.position.distanceTo(start)).toBeLessThan(1e-9);

    followSun(sun, onGrid.clone().addScaledVector(right, 0.6 * texel), layout);
    expect(sun.position.distanceTo(start)).toBeCloseTo(texel, 9);
  });
```

In `tests/scene.test.js`, append inside `describe('createShop', ...)`:

```js
  it('forwards the sun for the render loop', () => {
    expect(shop.userData.sun.isDirectionalLight).toBe(true);
  });
```

In `tests/main.test.js`, append inside `describe('main.js render loop', ...)`:

```js
  it('moves the sun with the camera each frame', () => {
    expect(source).toMatch(/import \{ followSun \} from ["']\.\/lighting\.js["']/);
    expect(source).toMatch(/followSun\(\s*shop\.userData\.sun\s*,\s*controls\.target\s*,\s*layout\s*\)/);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lighting.test.js tests/scene.test.js tests/main.test.js`
Expected: FAIL — `followSun is not a function`, `expected undefined to be ...` for `userData.sun`, and the main.js source checks find no `followSun`.

- [ ] **Step 3: Widen the shadow box in `src/layout.js`**

In the `lighting.sun` block, replace `shadowMapSize: 2048,` with `shadowMapSize: 4096,`
— the wider box below would otherwise nearly double the shadow texel and
coarsen every shadow in the existing shop. Then replace `shadowBounds: 26,` with:

```js
      // Wide enough for the view's corners at zoom 1, panned to any extreme,
      // on screens up to 2.6:1 — a real 3440x1440 ultrawide already needs 46.2.
      shadowBounds: 50,
      // Orthographic shadow cameras accept a negative near plane. The sun sits
      // 34.6 m from what it lights, and tall corners of the view reach 5.9 m
      // past it on the sun's side, so a positive near would clip them away.
      shadowNear: -20,
      shadowFar: 120,
```

- [ ] **Step 4: Expose and steer the sun in `src/lighting.js`**

Replace the two hard-coded shadow depth lines:

```js
  sun.shadow.camera.near = l.sun.shadowNear;
  sun.shadow.camera.far = l.sun.shadowFar;
```

Before `return group;`, add:

```js
  group.userData.sun = sun;
```

And add this export at the end of the file:

```js
const _basis = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _back = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

// Moves the sun so its shadow box follows whatever the camera is looking at.
// The target is snapped to whole shadow texels first: without that, shadow
// edges crawl across every surface while the view pans.
export function followSun(sun, target, layout) {
  const { position, shadowBounds, shadowMapSize } = layout.lighting.sun;
  const texel = (2 * shadowBounds) / shadowMapSize;
  _offset.set(...position);
  _basis.lookAt(_offset, _origin, _worldUp);
  _right.setFromMatrixColumn(_basis, 0);
  _up.setFromMatrixColumn(_basis, 1);
  _back.setFromMatrixColumn(_basis, 2);

  const alongRight = Math.round(target.dot(_right) / texel) * texel;
  const alongUp = Math.round(target.dot(_up) / texel) * texel;
  const alongBack = target.dot(_back);

  sun.target.position
    .copy(_right)
    .multiplyScalar(alongRight)
    .addScaledVector(_up, alongUp)
    .addScaledVector(_back, alongBack);
  sun.position.copy(sun.target.position).add(_offset);
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
}
```

- [ ] **Step 5: Forward the sun in `src/scene.js`**

Beside `shop.userData.fireLight = ...`, add:

```js
  shop.userData.sun = lighting.userData.sun;
```

- [ ] **Step 6: Drive it from `src/main.js`**

Add the import (a targeted edit; the user edits this file too):

```js
import { followSun } from "./lighting.js";
```

And in `animate()`, directly after `clampPan();`, add:

```js
  followSun(shop.userData.sun, controls.target, layout);
```

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green, including the user's existing pan tests.

- [ ] **Step 8: Commit (only if the user asks)**

```bash
git add src/layout.js src/lighting.js src/scene.js src/main.js tests/lighting.test.js tests/scene.test.js tests/main.test.js
git commit -m "feat: move the sun's shadow box with the camera"
```

---

### Task 9: Check the town in the running game

**Files:**
- Modify only if the screenshot shows a problem: `src/layout.js` (`town` band values), `src/town/*`

**Interfaces:**
- Consumes: the finished town from Tasks 1–8. Produces no code.

The default view shows the town's near corner only; seeing the whole town needs panning, which a headless screenshot cannot do. So this task checks what a still can show, and hands the rest to the user.

- [ ] **Step 1: Start the dev server**

Run in the background: `npx vite --port 5199 --strictPort`
Wait until `curl -sf http://localhost:5199 >/dev/null` succeeds (poll in a background loop; macOS has no `timeout`).

- [ ] **Step 2: Screenshot the default view**

```bash
SHOTS=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --user-data-dir="$SHOTS/town-profile" --no-first-run --hide-scrollbars \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=2 \
  --window-size=1800,1100 --virtual-time-budget=6000 \
  --screenshot="$SHOTS/scene.png" http://localhost:5199/
```

Headless Chrome never exits while the render loop runs: start it in the background, poll for the file, then `pkill -9 -f '[u]ser-data-dir=.*town-profile'`.

- [ ] **Step 3: Crop the far side and look at it**

```bash
sips --cropToHeightWidth 700 900 --cropOffset 1300 1500 "$SHOTS/scene.png" --out "$SHOTS/town.png"
```

Open the crop with your file-reading tool and confirm:

1. Shops and houses stand across the road, with their fronts, awnings and signs facing the camera.
2. Kerb trees, lamps and benches show in front of them, and the bus stop is visible near x −6.
3. No building hides the road or the parked cars.
4. Roofs, lawns and the tree line read as a town rather than a wall of boxes.
5. Buildings and trees cast shadows.

If the offsets miss the town, open `scene.png` and adjust them (`--cropOffset` is y then x, in 2x pixels).

- [ ] **Step 4: Stop Chrome and the dev server**

```bash
pkill -9 -f '[u]ser-data-dir=.*town-profile'
lsof -ti:5199 -sTCP:LISTEN | xargs kill
```

- [ ] **Step 5: Hand the panning check to the user**

Report that the whole town, and shadows while panning, need a look in their browser: run `npm run dev`, pan toward the bottom-right, and check that fronts face the camera, that nothing pops in or out at the view's edges, and that shadows follow.

- [ ] **Step 6: Commit any tuning (only if the user asks)**

```bash
git add src/layout.js src/town
git commit -m "fix: tune the town after checking it in the game"
```

Skip this step if nothing needed changing.

---

## Verification

```bash
npx vitest run && npm run build
```

Expected: every test passes and Vite builds with no errors (the existing chunk-size warning for the three.js bundle is expected).
