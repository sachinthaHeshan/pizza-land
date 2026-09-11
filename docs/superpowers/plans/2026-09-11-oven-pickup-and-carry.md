# Oven Pickup and Carrying Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The oven bakes pizzas into a count banner, the player collects them into a carried stack in the oven zone, and customers are only served from that stack at the cashier.

**Architecture:** The rules live in plain modules — `src/sim/ovenStock.js` and a carried count on the player — stepped by `simulation.update`. Visual pieces (a shared zone marker, the carried stack, flying boxes, a count texture) only display those numbers. `simulation.js` wires the rules to the visuals and applies the guidance table.

**Tech Stack:** three r186, vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-11-oven-pickup-and-carry-design.md`

## Global Constraints

- Timings and limits, verbatim from the spec: bake 5 s, oven capacity 10, pickup every 0.3 s, carry max 10, hop 0.3 s, carried box 0.42 wide × 0.1 thick.
- Pickup zone x 4.6–5.5, z −5.5 to −4.1. Oven banner 2.2 × 1.1 at y 3.1, bob 0.08. The sell zone and SELL banner keep their current values.
- Nothing in `src/sim/` hard-codes a coordinate; every value comes from `layout`.
- `src/sim/ovenStock.js` imports nothing — it is plain numbers.
- Every group sets `.name`. Glow meshes (outline, beam) never cast shadows.
- Counts change when a box launches, not when it lands.
- Run tests with `npx vitest run` (append a path to run one file).
- **No commits during this build** (the user's decision, 2026-09-11): skip every "Commit" step. `src/layout.js` and `tests/layout.test.js` also hold the user's uncommitted wall-height edits, and the earlier sell-zone work is uncommitted too — never run `git add`, `git commit`, `git stash`, `git checkout` or `git restore` in this repository.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/layout.js` | Gains `oven.pickupZone`, `oven.banner`, `sim.pizza` |
| `src/textures.js` | Gains `ovenBannerTexture(factory)` — a count banner that redraws itself |
| `src/materials.js` | Gains `ovenBanner`; `sellBeam`/`sellEdge` renamed `markerBeam`/`markerEdge` |
| `tests/helpers/stubs.js` | Stub `ovenBanner` material gets a real count texture |
| `src/sim/ovenStock.js` | Bake timer, stock 0–10, pickup cooldown |
| `src/models/pizzaBox.js` | Gains an optional `thickness` argument |
| `src/models/pizzaStack.js` | Up to 10 carried boxes, one slot per box |
| `src/models/pizzaHops.js` | Reusable boxes flying on arcs to moving targets |
| `src/models/zoneMarker.js` | Outline + beam + banner for any zone; replaces `sellPoint.js` |
| `src/sim/player.js` | Carried count, owns the stack, arms-forward carry pose |
| `src/sim/pedestrian.js` | `showBox()`, `boxPosition(out)`; passes itself to `recordSale` |
| `src/sim/simulation.js` | Wires stock, carrying, hops, sales and the guidance table |

---

### Task 1: Pizza settings, count banner texture, and marker materials

**Files:**
- Modify: `src/layout.js`, `src/textures.js`, `src/materials.js`, `src/models/sellPoint.js`, `tests/helpers/stubs.js`
- Test: `tests/layout.test.js`, `tests/textures.test.js`, `tests/materials.test.js`

**Interfaces:**
- Produces: `layout.oven.pickupZone = { x: [4.6, 5.5], z: [-5.5, -4.1] }`, `layout.oven.banner = { y, width, height, bob }`, `layout.sim.pizza = { bakeSeconds, ovenCapacity, pickupSeconds, carryMax, hopSeconds, carriedBox: { size, thickness } }`.
- Produces: `ovenBannerTexture(factory) -> THREE.CanvasTexture` exported from `src/textures.js`, and `textures.ovenBanner`. The texture has `userData.count` (starts `null`) and `userData.setCount(count, capacity)`, which redraws `"<count>/<capacity>"` and sets `needsUpdate` only when the count changed.
- Produces: materials `ovenBanner` (SpriteMaterial on `textures.ovenBanner`), `markerBeam`, `markerEdge`. The keys `sellBeam` and `sellEdge` no longer exist.

- [ ] **Step 1: Write the failing tests**

In `tests/layout.test.js`, add to the imports:

```js
import { playerObstacles, hitsObstacle, PLAYER_RADIUS } from '../src/sim/obstacles.js';
```

and append at the end of the file:

```js
describe('layout.oven.pickupZone', () => {
  const zone = layout.oven.pickupZone;
  const centre = [(zone.x[0] + zone.x[1]) / 2, (zone.z[0] + zone.z[1]) / 2];

  it('lets the player stand in the middle of the pickup zone', () => {
    expect(hitsObstacle(centre[0], centre[1], PLAYER_RADIUS, playerObstacles(layout))).toBe(false);
  });

  it('sits in front of the oven mouth, clear of the oven and the island', () => {
    expect(zone.x[1]).toBeLessThanOrEqual(layout.oven.base.x[0]);
    expect(zone.x[0]).toBeGreaterThan(layout.kitchen.island.x[1]);
    const mouthZ = layout.oven.dome.center[2];
    expect(mouthZ).toBeGreaterThan(zone.z[0]);
    expect(mouthZ).toBeLessThan(zone.z[1]);
  });

  it('gives every pizza timing and limit a positive value', () => {
    const p = layout.sim.pizza;
    const values = [
      p.bakeSeconds, p.ovenCapacity, p.pickupSeconds, p.carryMax,
      p.hopSeconds, p.carriedBox.size, p.carriedBox.thickness,
    ];
    for (const v of values) expect(v).toBeGreaterThan(0);
  });
});
```

In `tests/textures.test.js`, append inside `describe('createTextures', ...)`:

```js
  it('redraws the oven banner with its count, only when the count changes', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    const textures = createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const banner = textures.ovenBanner;
    const calls = canvases[TEXTURE_KEYS.indexOf('ovenBanner')].__calls;
    const words = () => calls.filter(([m]) => m === 'fillText').map(([, text]) => text);

    const version = banner.version;
    banner.userData.setCount(3, 10);
    expect(words()).toContain('3/10');
    expect(banner.userData.count).toBe(3);
    expect(banner.version).toBeGreaterThan(version);

    const drawn = calls.length;
    const redrawn = banner.version;
    banner.userData.setCount(3, 10);
    expect(calls.length).toBe(drawn);
    expect(banner.version).toBe(redrawn);
  });
```

In `tests/materials.test.js`, replace the `artwork` line in "declares a positive world tile size for every mapped material" with:

```js
    const artwork = ['sign', 'sellBanner', 'ovenBanner'];
```

Replace the whole "keeps the sell marker glow unlit and able to fade" test with:

```js
  // Both pulse by opacity, which only shows on a transparent material.
  it('keeps the zone marker glow unlit and able to fade', () => {
    for (const key of ['markerBeam', 'markerEdge']) {
      expect(materials[key], key).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(materials[key].transparent, key).toBe(true);
      expect(materials[key].depthWrite, key).toBe(false);
    }
    expect(materials.markerBeam.opacity).toBeLessThan(1);
  });

  it('draws the oven banner as a see-through sprite on the count texture', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.ovenBanner).toBeInstanceOf(THREE.SpriteMaterial);
    expect(m.ovenBanner.map).toBe(textures.ovenBanner);
    expect(m.ovenBanner.transparent).toBe(true);
    expect(m.ovenBanner.toneMapped).toBe(false);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/layout.test.js tests/textures.test.js tests/materials.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'x')` for the pickup zone, `Cannot read properties of undefined (reading 'version')` for the banner, and `markerBeam: expected undefined to be an instance of MeshBasicMaterial`.

- [ ] **Step 3: Add the settings to `src/layout.js`**

Inside the `oven: { ... }` block, after `flue: { ... },` add:

```js
    // Where the player stands to collect pizzas. The kitchen island hides
    // the floor from the camera west of x 4.6, and the player cannot stand
    // past x 5.35 against the oven base.
    pickupZone: { x: [4.6, 5.5], z: [-5.5, -4.1] },
    banner: { y: 3.1, width: 2.2, height: 1.1, bob: 0.08 },
```

Inside the `sim: { ... }` block, after `stride: { ... },` add:

```js
    pizza: {
      bakeSeconds: 5,
      ovenCapacity: 10,
      pickupSeconds: 0.3,
      carryMax: 10,
      hopSeconds: 0.3,
      // Thicker than a customer's box so each one in a stack reads at
      // default zoom.
      carriedBox: { size: 0.42, thickness: 0.1 },
    },
```

- [ ] **Step 4: Add the count texture to `src/textures.js`**

Add `'ovenBanner'` as the last entry of `TEXTURE_KEYS`. Add this function directly above `const GENERATORS = {` (it reuses `roundedRect`, `pizzaSlice` and `finish` from the same file):

```js
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
```

Add `ovenBanner: ovenBannerTexture,` as the last entry of `GENERATORS`.

- [ ] **Step 5: Update `src/materials.js`**

In `MATERIAL_KEYS`, replace `'sellBeam',` and `'sellEdge',` with:

```js
  'markerBeam',
  'markerEdge',
  'ovenBanner',
```

In `TILE`, after `sellBanner: null,` add `ovenBanner: null,`.

In the `materials` object, replace the whole `sellBeam: ...` and `sellEdge: ...` entries with:

```js
    markerBeam: new THREE.MeshBasicMaterial({
      name: 'markerBeam',
      color: 0xffd27a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    markerEdge: new THREE.MeshBasicMaterial({
      name: 'markerEdge',
      color: 0xfff0a8,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
```

and add directly after the `sellBanner` entry:

```js
    ovenBanner: new THREE.SpriteMaterial({
      name: 'ovenBanner',
      map: textures.ovenBanner,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
```

- [ ] **Step 6: Point `src/models/sellPoint.js` at the renamed materials**

Replace every `materials.sellBeam` with `materials.markerBeam` and every `materials.sellEdge` with `materials.markerEdge` (three of each).

- [ ] **Step 7: Give the stub oven banner a real count texture**

In `tests/helpers/stubs.js`, add the import:

```js
import { ovenBannerTexture } from '../../src/textures.js';
```

and in `stubMaterials()`, just before `return materials;`:

```js
  // The simulation redraws the oven banner's count every frame, so the stub
  // needs a working count texture rather than a bare material.
  materials.ovenBanner.map = ovenBannerTexture(stubCanvasFactory());
```

- [ ] **Step 8: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 9: Commit (after confirming with the user)**

```bash
git add src/textures.js src/materials.js src/models/sellPoint.js tests/helpers/stubs.js tests/textures.test.js tests/materials.test.js src/layout.js tests/layout.test.js
git commit -m "feat: add pizza settings, oven count banner texture and marker materials"
```

---

### Task 2: Oven stock rules

**Files:**
- Create: `src/sim/ovenStock.js`
- Test: `tests/sim/ovenStock.test.js`

**Interfaces:**
- Consumes: `layout.sim.pizza.{ bakeSeconds, ovenCapacity, pickupSeconds }` from Task 1.
- Produces: `createOvenStock(layout) -> { stock, update(dt, { inZone, room }) -> number }`. `stock` is a getter (0–10). `update` bakes first, then returns how many pizzas left the oven this step (0 or 1). `room` is how many more the player can hold.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/ovenStock.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createOvenStock } from '../../src/sim/ovenStock.js';
import { layout } from '../../src/layout.js';

const dt = 1 / 60;
const away = { inZone: false, room: 10 };
const inZone = { inZone: true, room: 10 };

function run(oven, seconds, state = away) {
  let released = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) released += oven.update(dt, state);
  return released;
}

describe('createOvenStock', () => {
  it('starts empty', () => {
    expect(createOvenStock(layout).stock).toBe(0);
  });

  it('bakes one pizza every 5 seconds', () => {
    const oven = createOvenStock(layout);
    run(oven, 4.9);
    expect(oven.stock).toBe(0);
    run(oven, 0.2);
    expect(oven.stock).toBe(1);
    run(oven, 5);
    expect(oven.stock).toBe(2);
  });

  it('stops at 10 and needs a full bake after one is taken', () => {
    const oven = createOvenStock(layout);
    run(oven, 60);
    expect(oven.stock).toBe(10);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(oven.stock).toBe(9);
    run(oven, 4.8);
    expect(oven.stock).toBe(9);
    run(oven, 0.4);
    expect(oven.stock).toBe(10);
  });

  it('hands out one pizza on entering, then one every 0.3 seconds', () => {
    const oven = createOvenStock(layout);
    run(oven, 55);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(run(oven, 0.25, inZone)).toBe(0);
    expect(run(oven, 0.1, inZone)).toBe(1);
  });

  it('hands out nothing when the oven is empty or the hands are full', () => {
    const empty = createOvenStock(layout);
    expect(empty.update(dt, inZone)).toBe(0);

    const full = createOvenStock(layout);
    run(full, 6);
    expect(full.update(dt, { inZone: true, room: 0 })).toBe(0);
    expect(full.stock).toBe(1);
  });

  it('stops handing out when the player leaves, and starts again at once on return', () => {
    const oven = createOvenStock(layout);
    run(oven, 55);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(run(oven, 2)).toBe(0);
    expect(oven.update(dt, inZone)).toBe(1);
  });

  it('hands a pizza over as soon as it bakes while the player waits', () => {
    const oven = createOvenStock(layout);
    expect(run(oven, 4.9, inZone)).toBe(0);
    expect(run(oven, 0.2, inZone)).toBe(1);
    expect(oven.stock).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/ovenStock.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/ovenStock.js'`.

- [ ] **Step 3: Write `src/sim/ovenStock.js`**

```js
// The oven's side of the pizza economy: it bakes on its own up to capacity
// and hands pizzas to a player standing in its pickup zone. Plain numbers
// only, so the rules step deterministically in tests.
export function createOvenStock(layout) {
  const { bakeSeconds, ovenCapacity, pickupSeconds } = layout.sim.pizza;
  let stock = 0;
  let bake = 0;
  let cooldown = 0;

  return {
    get stock() {
      return stock;
    },

    // Returns how many pizzas left the oven this step (0 or 1).
    update(dt, { inZone, room }) {
      if (stock < ovenCapacity) {
        bake += dt;
        if (bake >= bakeSeconds) {
          stock++;
          bake -= bakeSeconds;
        }
      }
      // A full oven holds its timer at zero, so the pizza after one is taken
      // needs a whole bake.
      if (stock >= ovenCapacity) bake = 0;

      if (!inZone) {
        cooldown = 0;
        return 0;
      }
      cooldown -= dt;
      if (cooldown > 0 || stock < 1 || room < 1) return 0;
      stock--;
      cooldown = pickupSeconds;
      return 1;
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/sim/ovenStock.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit (after confirming with the user)**

```bash
git add src/sim/ovenStock.js tests/sim/ovenStock.test.js
git commit -m "feat: add oven stock that bakes and hands out pizzas"
```

---

### Task 3: Carried stack model

**Files:**
- Modify: `src/models/pizzaBox.js`
- Create: `src/models/pizzaStack.js`
- Test: `tests/models/pizzaBox.test.js`, `tests/models/pizzaStack.test.js`

**Interfaces:**
- Consumes: `layout.sim.pizza.{ carryMax, carriedBox }` from Task 1.
- Produces: `createPizzaBox(materials, size = 0.42, thickness = size * 0.16)` — the new third argument is optional, so existing callers are unchanged.
- Produces: `createPizzaStack(materials, layout) -> THREE.Group` named `'pizzaStack'`, holding `carryMax` boxes built upward from its origin. `group.userData.setCount(n)` shows the bottom `min(n, carryMax)` boxes. `group.userData.slotPosition(index, out: Vector3) -> Vector3` writes the world-space centre of slot `index` into `out`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('createPizzaBox', ...)` in `tests/models/pizzaBox.test.js`:

```js
  it('takes an explicit thickness for chunkier carried boxes', () => {
    const bounds = boundsOf(createPizzaBox(stubMaterials(), 0.42, 0.1));
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.1, 5);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.42, 5);
  });
```

Create `tests/models/pizzaStack.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaStack } from '../../src/models/pizzaStack.js';
import { layout } from '../../src/layout.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const { carryMax, carriedBox } = layout.sim.pizza;
const shown = (stack) => stack.children.filter((box) => box.visible);

describe('createPizzaStack', () => {
  it('returns a named group that starts empty', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    expect(stack).toBeInstanceOf(THREE.Group);
    expect(stack.name).toBe('pizzaStack');
    expect(shown(stack)).toHaveLength(0);
  });

  it('shows exactly as many boxes as it is told, up to the carry limit', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    for (const n of [0, 1, 4, 10]) {
      stack.userData.setCount(n);
      expect(shown(stack), `count ${n}`).toHaveLength(n);
    }
    stack.userData.setCount(carryMax + 3);
    expect(shown(stack)).toHaveLength(carryMax);
  });

  it('stacks the boxes upward without gaps', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    stack.userData.setCount(carryMax);
    const boxes = shown(stack)
      .map((box) => boundsOf(box))
      .sort((a, b) => a.min.y - b.min.y);
    expect(boxes[0].min.y).toBeCloseTo(0, 5);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].min.y).toBeCloseTo(boxes[i - 1].max.y, 5);
    }
    expect(boxes[boxes.length - 1].max.y).toBeCloseTo(carryMax * carriedBox.thickness, 5);
  });

  it('reports the world position of a slot, following the stack as it moves', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    const parent = new THREE.Group();
    parent.add(stack);
    parent.position.set(2, 1, -3);
    const slot = stack.userData.slotPosition(2, new THREE.Vector3());
    expect(slot.x).toBeCloseTo(2, 5);
    expect(slot.y).toBeCloseTo(1 + 2.5 * carriedBox.thickness, 5);
    expect(slot.z).toBeCloseTo(-3, 5);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/models/pizzaBox.test.js tests/models/pizzaStack.test.js`
Expected: FAIL — the box is `0.0672` tall instead of `0.1`, and `Cannot find module '../../src/models/pizzaStack.js'`.

- [ ] **Step 3: Add the thickness argument to `src/models/pizzaBox.js`**

Replace the first three lines of the function:

```js
export function createPizzaBox(materials, size = 0.42, thickness = size * 0.16) {
  const group = new THREE.Group();
  group.name = 'pizzaBox';
  const half = size / 2;
```

and delete the old `const thickness = size * 0.16;` line. The rest is unchanged.

- [ ] **Step 4: Write `src/models/pizzaStack.js`**

```js
import * as THREE from 'three';
import { createPizzaBox } from './pizzaBox.js';

// The boxes a player carries, built bottom-up from the stack's origin. Every
// box exists from the start and is only shown or hidden, so carrying
// allocates nothing.
export function createPizzaStack(materials, layout) {
  const { carryMax, carriedBox } = layout.sim.pizza;
  const group = new THREE.Group();
  group.name = 'pizzaStack';

  for (let i = 0; i < carryMax; i++) {
    const box = createPizzaBox(materials, carriedBox.size, carriedBox.thickness);
    box.position.y = (i + 0.5) * carriedBox.thickness;
    box.visible = false;
    group.add(box);
  }

  group.userData.setCount = (count) => {
    group.children.forEach((box, i) => {
      box.visible = i < count;
    });
  };

  group.userData.slotPosition = (index, out) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(out.set(0, (index + 0.5) * carriedBox.thickness, 0));
  };

  return group;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/models/pizzaBox.test.js tests/models/pizzaStack.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 6: Commit (after confirming with the user)**

```bash
git add src/models/pizzaBox.js src/models/pizzaStack.js tests/models/pizzaBox.test.js tests/models/pizzaStack.test.js
git commit -m "feat: add the carried pizza stack model"
```

---

### Task 4: Flying boxes

**Files:**
- Create: `src/models/pizzaHops.js`
- Test: `tests/models/pizzaHops.test.js`

**Interfaces:**
- Consumes: `createPizzaBox(materials, size, thickness)` from Task 3; `layout.sim.pizza.{ hopSeconds, carriedBox }`.
- Produces: `createPizzaHops(materials, layout) -> { group, launch(from, target, onLand), update(dt) }`. `group` is named `'pizzaHops'` and holds a fixed set of boxes. `from` is a `Vector3` copied at launch; `target` is a function returning the current target `Vector3`, called every frame; `onLand` runs once when the box arrives. With every box busy, `launch` calls `onLand` immediately.

- [ ] **Step 1: Write the failing test**

Create `tests/models/pizzaHops.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaHops } from '../../src/models/pizzaHops.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const dt = 1 / 60;
const { hopSeconds } = layout.sim.pizza;
const flying = (hops) => hops.group.children.filter((box) => box.visible);

function run(hops, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += dt) hops.update(dt);
}

describe('createPizzaHops', () => {
  it('returns a named group with nothing in flight', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    expect(hops.group).toBeInstanceOf(THREE.Group);
    expect(hops.group.name).toBe('pizzaHops');
    expect(flying(hops)).toHaveLength(0);
  });

  it('flies a box from its start to the target and lands it once', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const from = new THREE.Vector3(0, 1, 0);
    let landed = 0;
    hops.launch(from, () => new THREE.Vector3(3, 1, -2), () => landed++);
    const [box] = flying(hops);
    expect(box.position.distanceTo(from)).toBeLessThan(1e-6);

    run(hops, hopSeconds * 0.5);
    expect(landed).toBe(0);
    run(hops, hopSeconds);
    expect(landed).toBe(1);
    expect(flying(hops)).toHaveLength(0);
    run(hops, 1);
    expect(landed).toBe(1);
  });

  it('follows a target that moves while the box is in the air', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const oldTarget = new THREE.Vector3(1, 1, 0);
    const target = oldTarget.clone();
    hops.launch(new THREE.Vector3(0, 1, 0), () => target, () => {});
    const [box] = flying(hops);
    run(hops, hopSeconds * 0.5);
    target.set(4, 1, 4);
    let last = null;
    for (let t = 0; t < hopSeconds; t += dt) {
      hops.update(dt);
      if (box.visible) last = box.position.clone();
    }
    expect(last.distanceTo(target)).toBeLessThan(last.distanceTo(oldTarget));
  });

  it('arcs above the straight line between its ends', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    hops.launch(new THREE.Vector3(0, 1, 0), () => new THREE.Vector3(2, 1, 0), () => {});
    const [box] = flying(hops);
    run(hops, hopSeconds * 0.5);
    expect(box.position.y).toBeGreaterThan(1.3);
  });

  it('reuses its boxes rather than adding new ones', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const count = hops.group.children.length;
    let landed = 0;
    for (let i = 0; i < 40; i++) {
      hops.launch(new THREE.Vector3(), () => new THREE.Vector3(1, 0, 0), () => landed++);
      run(hops, hopSeconds + dt);
    }
    expect(landed).toBe(40);
    expect(hops.group.children.length).toBe(count);
  });

  it('still lands a pizza at once when every box is already flying', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const launches = hops.group.children.length + 1;
    let landed = 0;
    for (let i = 0; i < launches; i++) {
      hops.launch(new THREE.Vector3(), () => new THREE.Vector3(1, 0, 0), () => landed++);
    }
    expect(landed).toBe(1);
    run(hops, hopSeconds + dt);
    expect(landed).toBe(launches);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/models/pizzaHops.test.js`
Expected: FAIL — `Cannot find module '../../src/models/pizzaHops.js'`.

- [ ] **Step 3: Write `src/models/pizzaHops.js`**

```js
import * as THREE from 'three';
import { createPizzaBox } from './pizzaBox.js';

const ARC_HEIGHT = 0.6;
// More than can ever fly at once: pickups launch every 0.3 s and land in
// 0.3 s, and a sale happens far from the oven.
const BOXES = 4;

// Boxes that fly on an arc from a start point to a target that may move,
// re-aiming every frame. The same few boxes are reused for the whole game.
export function createPizzaHops(materials, layout) {
  const { hopSeconds, carriedBox } = layout.sim.pizza;
  const group = new THREE.Group();
  group.name = 'pizzaHops';

  const hops = [];
  for (let i = 0; i < BOXES; i++) {
    const box = createPizzaBox(materials, carriedBox.size, carriedBox.thickness);
    box.visible = false;
    group.add(box);
    hops.push({ box, from: new THREE.Vector3(), target: null, onLand: null, elapsed: 0 });
  }

  return {
    group,

    launch(from, target, onLand) {
      const hop = hops.find((h) => !h.box.visible);
      // Never lose a pizza for want of a box: land it without the flight.
      if (!hop) {
        onLand();
        return;
      }
      hop.from.copy(from);
      hop.target = target;
      hop.onLand = onLand;
      hop.elapsed = 0;
      hop.box.position.copy(from);
      hop.box.visible = true;
    },

    update(dt) {
      for (const hop of hops) {
        if (!hop.box.visible) continue;
        hop.elapsed += dt;
        const s = Math.min(1, hop.elapsed / hopSeconds);
        hop.box.position.lerpVectors(hop.from, hop.target(), s);
        hop.box.position.y += 4 * ARC_HEIGHT * s * (1 - s);
        if (s >= 1) {
          hop.box.visible = false;
          hop.onLand();
        }
      }
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/models/pizzaHops.test.js`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit (after confirming with the user)**

```bash
git add src/models/pizzaHops.js tests/models/pizzaHops.test.js
git commit -m "feat: add reusable flying pizza boxes"
```

---

### Task 5: Shared zone marker

**Files:**
- Create: `src/models/zoneMarker.js`, `tests/models/zoneMarker.test.js`
- Delete: `src/models/sellPoint.js`, `tests/models/sellPoint.test.js` (both untracked, so plain `rm`)
- Modify: `src/sim/simulation.js`, `tests/sim/simulation.test.js`

**Interfaces:**
- Consumes: `materials.markerBeam`, `materials.markerEdge`, `materials.sellBanner` from Task 1; `box` from `src/utils/geometry.js`.
- Produces: `createZoneMarker(materials, { name, zone, outlineY, bannerMaterial, banner }) -> THREE.Group` named `name`. Children: `'zoneEdge'` (group of dash meshes), `'zoneBeam'` (mesh), `'zoneBanner'` (sprite). `group.userData.update(dt, { pulse, showBanner })`. Each marker clones `markerBeam` and `markerEdge`.
- Behaviour kept: the simulation still shows the SELL banner and pulses only while a customer waits and `canServe()` is false, until Task 8 changes the rule.

- [ ] **Step 1: Write the failing test**

Create `tests/models/zoneMarker.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createZoneMarker } from '../../src/models/zoneMarker.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const zone = layout.queue.sellZone;
const banner = layout.queue.sellBanner;
const outlineY = 1.14;
const centreX = (zone.x[0] + zone.x[1]) / 2;
const centreZ = (zone.z[0] + zone.z[1]) / 2;

function marker(materials = stubMaterials(), name = 'sellPoint') {
  return createZoneMarker(materials, {
    name,
    zone,
    outlineY,
    bannerMaterial: materials.sellBanner,
    banner,
  });
}

// Runs the animation and reports how far the beam's and outline's opacity swung.
function glowSwing(point, state, seconds = 2, dt = 1 / 60) {
  const beam = point.getObjectByName('zoneBeam').material;
  const dash = point.getObjectByName('zoneEdge').children[0].material;
  const beamSeen = [];
  const dashSeen = [];
  for (let t = 0; t < seconds; t += dt) {
    point.userData.update(dt, state);
    beamSeen.push(beam.opacity);
    dashSeen.push(dash.opacity);
  }
  const swing = (seen) => Math.max(...seen) - Math.min(...seen);
  return { beam: swing(beamSeen), outline: swing(dashSeen) };
}

describe('createZoneMarker', () => {
  it('returns a group with the requested name and finite bounds', () => {
    const point = marker(stubMaterials(), 'ovenPoint');
    expect(point).toBeInstanceOf(THREE.Group);
    expect(point.name).toBe('ovenPoint');
    expectFinite(boundsOf(point));
  });

  it('keeps every part at or above the outline height', () => {
    expect(boundsOf(marker()).min.y).toBeGreaterThanOrEqual(outlineY - 1e-6);
  });

  it('outlines exactly the zone at the outline height', () => {
    const bounds = boundsOf(marker().getObjectByName('zoneEdge'));
    expect(bounds.min.x).toBeCloseTo(zone.x[0], 5);
    expect(bounds.max.x).toBeCloseTo(zone.x[1], 5);
    expect(bounds.min.z).toBeCloseTo(zone.z[0], 5);
    expect(bounds.max.z).toBeCloseTo(zone.z[1], 5);
    expect(bounds.min.y).toBeCloseTo(outlineY, 5);
    expect(bounds.max.y).toBeLessThan(outlineY + 0.1);
  });

  it('dashes the outline rather than drawing a solid frame', () => {
    const dashes = marker().getObjectByName('zoneEdge').children;
    expect(dashes.length).toBeGreaterThan(4);
    for (const dash of dashes) {
      const b = boundsOf(dash);
      const onX = Math.abs(b.min.x - zone.x[0]) < 0.1 || Math.abs(b.max.x - zone.x[1]) < 0.1;
      const onZ = Math.abs(b.min.z - zone.z[0]) < 0.1 || Math.abs(b.max.z - zone.z[1]) < 0.1;
      expect(onX || onZ).toBe(true);
    }
  });

  it('floats an undistorted banner over the zone using the given material', () => {
    const materials = stubMaterials();
    const sprite = marker(materials).getObjectByName('zoneBanner');
    expect(sprite).toBeInstanceOf(THREE.Sprite);
    expect(sprite.material).toBe(materials.sellBanner);
    expect(sprite.position.x).toBeCloseTo(centreX, 5);
    expect(sprite.position.z).toBeCloseTo(centreZ, 5);
    expect(sprite.position.y).toBeCloseTo(banner.y, 5);
    // The SELL artwork is drawn on a 2:1 canvas.
    expect(sprite.scale.x / sprite.scale.y).toBeCloseTo(2, 5);
  });

  it('runs a beam of light from the outline up to the banner', () => {
    const point = marker();
    const beam = boundsOf(point.getObjectByName('zoneBeam'));
    expect(beam.min.y).toBeCloseTo(outlineY, 5);
    expect(beam.max.y).toBeCloseTo(banner.y - banner.height / 2, 5);
    expect(beam.min.x).toBeGreaterThanOrEqual(zone.x[0] - 1e-6);
    expect(beam.max.x).toBeLessThanOrEqual(zone.x[1] + 1e-6);
    expect(beam.min.z).toBeGreaterThanOrEqual(zone.z[0] - 1e-6);
    expect(beam.max.z).toBeLessThanOrEqual(zone.z[1] + 1e-6);
  });

  it('pulses the outline and beam only when asked', () => {
    const on = glowSwing(marker(), { pulse: true, showBanner: false });
    expect(on.beam).toBeGreaterThan(0.1);
    expect(on.outline).toBeGreaterThan(0.1);
    const off = glowSwing(marker(), { pulse: false, showBanner: true });
    expect(off.beam).toBeLessThan(1e-6);
    expect(off.outline).toBeLessThan(1e-6);
  });

  it('shows the banner only when asked, never hiding the outline or beam', () => {
    const point = marker();
    const sprite = point.getObjectByName('zoneBanner');
    const cases = [
      [{ pulse: true, showBanner: true }, true],
      [{ pulse: true, showBanner: false }, false],
      [{ pulse: false, showBanner: true }, true],
      [{ pulse: false, showBanner: false }, false],
    ];
    for (const [state, shown] of cases) {
      point.userData.update(1 / 60, state);
      const label = JSON.stringify(state);
      expect(sprite.visible, label).toBe(shown);
      expect(point.visible, label).toBe(true);
      expect(point.getObjectByName('zoneEdge').visible, label).toBe(true);
      expect(point.getObjectByName('zoneBeam').visible, label).toBe(true);
    }
  });

  it('never makes another marker pulse, even with shared materials', () => {
    const materials = stubMaterials();
    const pulsing = marker(materials, 'sellPoint');
    const still = marker(materials, 'ovenPoint');
    const seen = [];
    for (let t = 0; t < 2; t += 1 / 60) {
      pulsing.userData.update(1 / 60, { pulse: true, showBanner: true });
      still.userData.update(1 / 60, { pulse: false, showBanner: true });
      seen.push(still.getObjectByName('zoneBeam').material.opacity);
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeLessThan(1e-6);
    expect(materials.markerBeam.opacity).toBe(1);
  });

  it('bobs the banner gently without drifting off', () => {
    const point = marker();
    const sprite = point.getObjectByName('zoneBanner');
    const heights = [];
    for (let t = 0; t < 4; t += 1 / 60) {
      point.userData.update(1 / 60, { pulse: false, showBanner: true });
      heights.push(sprite.position.y);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.02);
    for (const y of heights) expect(Math.abs(y - banner.y)).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/models/zoneMarker.test.js`
Expected: FAIL — `Cannot find module '../../src/models/zoneMarker.js'`.

- [ ] **Step 3: Write `src/models/zoneMarker.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

const PULSE_SPEED = 6;
const BOB_SPEED = 2.2;
const DASH_HEIGHT = 0.04;

// Dash rectangles along each edge of the zone, with their outer edge on the
// zone boundary. The side runs are inset so corners are not drawn twice.
function dashedOutline(zone, { dash = 0.2, gap = 0.12, width = 0.06 } = {}) {
  const dashes = [];
  const along = (from, to, place) => {
    for (let s = from; s < to - 1e-6; s += dash + gap) {
      place([s, Math.min(s + dash, to)]);
    }
  };
  const [x0, x1] = zone.x;
  const [z0, z1] = zone.z;
  along(x0, x1, (x) => {
    dashes.push({ x, z: [z0, z0 + width] });
    dashes.push({ x, z: [z1 - width, z1] });
  });
  along(z0 + width, z1 - width, (z) => {
    dashes.push({ x: [x0, x0 + width], z });
    dashes.push({ x: [x1 - width, x1], z });
  });
  return dashes;
}

// A "go here" marker for a zone: a glowing dashed outline, a beam of light
// rising from it, and a banner that always faces the camera. The caller
// decides when it pulses and when the banner shows. Pulsing changes material
// opacity, so each marker clones its glow materials rather than sharing them.
export function createZoneMarker(materials, { name, zone, outlineY, bannerMaterial, banner: spec }) {
  const group = new THREE.Group();
  group.name = name;

  const centreX = (zone.x[0] + zone.x[1]) / 2;
  const centreZ = (zone.z[0] + zone.z[1]) / 2;
  const beamMaterial = materials.markerBeam.clone();
  const edgeMaterial = materials.markerEdge.clone();

  const edge = new THREE.Group();
  edge.name = 'zoneEdge';
  for (const dash of dashedOutline(zone)) {
    const mesh = box(edgeMaterial, { ...dash, y: [outlineY, outlineY + DASH_HEIGHT] });
    mesh.castShadow = false;
    mesh.renderOrder = 2;
    edge.add(mesh);
  }
  group.add(edge);

  const beamHeight = spec.y - spec.height / 2 - outlineY;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(zone.x[1] - zone.x[0], beamHeight, zone.z[1] - zone.z[0]),
    beamMaterial
  );
  beam.name = 'zoneBeam';
  beam.position.set(centreX, outlineY + beamHeight / 2, centreZ);
  beam.renderOrder = 1;
  group.add(beam);

  const banner = new THREE.Sprite(bannerMaterial);
  banner.name = 'zoneBanner';
  banner.scale.set(spec.width, spec.height, 1);
  banner.position.set(centreX, spec.y, centreZ);
  banner.renderOrder = 3;
  group.add(banner);

  const beamOpacity = beamMaterial.opacity;
  const edgeOpacity = edgeMaterial.opacity;
  let time = 0;

  group.userData.update = (dt, { pulse, showBanner }) => {
    time += dt;
    banner.visible = showBanner;
    banner.position.y = spec.y + Math.sin(time * BOB_SPEED) * spec.bob;
    const glow = pulse ? 0.4 + 0.9 * (0.5 + 0.5 * Math.sin(time * PULSE_SPEED)) : 1;
    beamMaterial.opacity = Math.min(1, beamOpacity * glow);
    edgeMaterial.opacity = Math.min(1, edgeOpacity * glow);
  };

  return group;
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/models/zoneMarker.test.js`
Expected: PASS — 10 passing tests.

- [ ] **Step 5: Switch the simulation to the shared marker**

In `src/sim/simulation.js`, replace the import

```js
import { createSellPoint } from '../models/sellPoint.js';
```

with

```js
import { createZoneMarker } from '../models/zoneMarker.js';
```

Replace

```js
  const sellPoint = createSellPoint(materials, layout);
  group.add(sellPoint);
```

with

```js
  // The outline sits just above the counter top: the counter hides the floor
  // behind it from the game camera.
  const sellPoint = createZoneMarker(materials, {
    name: 'sellPoint',
    zone: sellZone,
    outlineY: layout.counter.topHeight + layout.surfaceEps * 2,
    bannerMaterial: materials.sellBanner,
    banner: layout.queue.sellBanner,
  });
  group.add(sellPoint);
```

and replace the marker update at the end of `update`

```js
      sellPoint.userData.update(dt, {
        occupied: world.canServe(),
        waiting: pedestrians.some((p) => p.state === 'AT_COUNTER'),
      });
```

with

```js
      const waiting = pedestrians.some((p) => p.state === 'AT_COUNTER');
      const calling = waiting && !world.canServe();
      sellPoint.userData.update(dt, { pulse: calling, showBanner: calling });
```

In `tests/sim/simulation.test.js`, change `getObjectByName('sellBeam')` to `getObjectByName('zoneBeam')` and `getObjectByName('sellBanner')` to `getObjectByName('zoneBanner')`.

- [ ] **Step 6: Delete the old marker and its test**

```bash
rm src/models/sellPoint.js tests/models/sellPoint.test.js
```

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 8: Commit (after confirming with the user)**

```bash
git add src/models/zoneMarker.js tests/models/zoneMarker.test.js src/sim/simulation.js tests/sim/simulation.test.js
git commit -m "refactor: replace the sell point with a shared zone marker"
```

---

### Task 6: The player carries pizzas

**Files:**
- Modify: `src/sim/player.js`
- Test: `tests/sim/player.test.js`

**Interfaces:**
- Consumes: `createPizzaStack(materials, layout)` from Task 3; `layout.sim.pizza.carryMax`.
- Produces: `createPlayer` now returns `{ figure, stack, carried, receive(), handOver(), update(dt, keys) }`. `carried` is a getter; `receive()` adds one up to `carryMax`; `handOver()` removes one down to 0. `stack` is the `'pizzaStack'` group, a child of `figure`, held at the hands in front of the chest. Both arm pivots sit at `rotation.x = -Math.PI / 2` whenever `carried > 0`.

- [ ] **Step 1: Write the failing test**

In `tests/sim/player.test.js`, add to the imports:

```js
import * as THREE from 'three';
```

and append at the end of the file:

```js
describe('carrying pizzas', () => {
  const { carryMax } = layout.sim.pizza;

  it('starts empty-handed', () => {
    expect(player().carried).toBe(0);
  });

  it('keeps the carried count between zero and the carry limit', () => {
    const p = player();
    for (let i = 0; i < carryMax + 5; i++) p.receive();
    expect(p.carried).toBe(carryMax);
    for (let i = 0; i < carryMax + 5; i++) p.handOver();
    expect(p.carried).toBe(0);
  });

  it('holds the stack in front of its chest, above the counter top', () => {
    const p = player();
    expect(p.stack.parent).toBe(p.figure);
    const slot = p.stack.userData.slotPosition(0, new THREE.Vector3());
    // The cashier spawns facing +Z, so in front means larger z.
    expect(slot.z).toBeGreaterThan(p.figure.position.z + 0.2);
    expect(slot.y).toBeGreaterThan(layout.counter.topHeight);
  });

  it('holds both arms forward while carrying, even when walking', () => {
    const p = player();
    p.receive();
    hold(p, ['s'], 0.5);
    const { armL, armR, legL } = p.figure.userData.limbs;
    expect(armL.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(armR.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(Math.abs(legL.rotation.x)).toBeGreaterThan(0.05);
  });

  it('swings its arms again once its hands are empty', () => {
    const p = player();
    p.receive();
    hold(p, ['s'], 0.2);
    p.handOver();
    const keys = new Set(['s']);
    let swinging = 0;
    for (let t = 0; t < 0.6; t += 1 / 60) {
      p.update(1 / 60, keys);
      const armR = p.figure.userData.limbs.armR.rotation.x;
      if (Math.abs(armR + Math.PI / 2) > 0.5) swinging++;
    }
    expect(swinging).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/player.test.js`
Expected: FAIL — `expected undefined to be +0` for `carried`, and `p.receive is not a function`.

- [ ] **Step 3: Rewrite `src/sim/player.js`**

```js
import { createFigure } from '../models/figure.js';
import { createPizzaStack } from '../models/pizzaStack.js';
import { playerObstacles, slideMove, PLAYER_RADIUS } from './obstacles.js';

const EMPTY_KEYS = new Set();
const CARRY_ANGLE = -Math.PI / 2;
// Where the hands meet with both arms pointing forward, as fractions of the
// figure's height: figure.js puts the shoulders at 0.72 and arms 0.25 long.
const SHOULDER = 0.72;
const REACH = 0.25;

export function createPlayer(materials, layout) {
  const spec = layout.queue.cashier;
  const figure = createFigure(materials, { ...spec, facing: spec.facing });
  figure.name = 'cashier';

  const { carryMax } = layout.sim.pizza;
  const stack = createPizzaStack(materials, layout);
  stack.position.set(0, spec.height * SHOULDER, spec.height * REACH);
  figure.add(stack);
  let carried = 0;

  const speed = layout.sim.speeds.walk;
  const stride = layout.sim.stride;
  const ground = layout.envelopes.ground;
  const obstacles = playerObstacles(layout);
  const [dirX, , dirZ] = layout.camera.direction;
  const len = Math.hypot(dirX, dirZ);
  const forwardX = -dirX / len;
  const forwardZ = -dirZ / len;
  const rightX = -forwardZ;
  const rightZ = forwardX;

  let stridePhase = 0;

  function animateLegs(dt, moving) {
    const limbs = figure.userData.limbs;
    if (moving) {
      stridePhase += dt * stride.frequency;
      const swing = Math.sin(stridePhase) * stride.amplitude;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * stride.armScale;
      limbs.armR.rotation.x = swing * stride.armScale;
    } else {
      for (const limb of Object.values(limbs)) {
        limb.rotation.x *= Math.max(0, 1 - dt * 8);
      }
    }
    // Carrying overrides the arm swing: both arms hold the stack.
    if (carried > 0) {
      limbs.armL.rotation.x = CARRY_ANGLE;
      limbs.armR.rotation.x = CARRY_ANGLE;
    }
  }

  return {
    figure,
    stack,

    get carried() {
      return carried;
    },

    receive() {
      carried = Math.min(carryMax, carried + 1);
    },

    handOver() {
      carried = Math.max(0, carried - 1);
    },

    update(dt, keys = EMPTY_KEYS) {
      let x = 0;
      let z = 0;
      if (keys.has('w')) {
        x += forwardX;
        z += forwardZ;
      }
      if (keys.has('s')) {
        x -= forwardX;
        z -= forwardZ;
      }
      if (keys.has('d')) {
        x += rightX;
        z += rightZ;
      }
      if (keys.has('a')) {
        x -= rightX;
        z -= rightZ;
      }

      const moving = Math.hypot(x, z) > 1e-6;
      if (moving) {
        const inv = 1 / Math.hypot(x, z);
        x *= inv;
        z *= inv;
        const next = slideMove(
          figure.position.x,
          figure.position.z,
          x * speed * dt,
          z * speed * dt,
          PLAYER_RADIUS,
          obstacles
        );
        figure.position.x = Math.min(
          ground.max[0],
          Math.max(ground.min[0], next.x)
        );
        figure.position.z = Math.min(
          ground.max[2],
          Math.max(ground.min[2], next.z)
        );
        figure.rotation.y = Math.atan2(x, z);
      }
      animateLegs(dt, moving);
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/player.test.js tests/sim/simulation.test.js`
Expected: PASS — the existing movement tests are unchanged and the 5 new carrying tests pass.

- [ ] **Step 5: Commit (after confirming with the user)**

```bash
git add src/sim/player.js tests/sim/player.test.js
git commit -m "feat: let the player carry a stack of pizzas"
```

---

### Task 7: Customers receive their box when it lands

**Files:**
- Modify: `src/sim/pedestrian.js`, `src/sim/simulation.js`
- Test: `tests/sim/pedestrian.test.js`, `tests/sim/simulation.test.js`

**Interfaces:**
- Produces: a pedestrian now has `showBox()` (makes its box visible) and `boxPosition(out: Vector3) -> Vector3` (world position of its hands' box). On a sale it calls `world.recordSale(pedestrian)` with itself and no longer shows the box.
- Produces: `world.recordSale(pedestrian)` in the simulation adds $5 and calls `pedestrian.showBox()` — Task 8 replaces the instant `showBox` with a flying box.

- [ ] **Step 1: Write the failing tests**

In `tests/sim/pedestrian.test.js`, add to the imports:

```js
import * as THREE from 'three';
```

In the `world()` helper, replace `recordSale() {},` with:

```js
    recordSale(pedestrian) {
      pedestrian.showBox();
    },
```

Append inside `describe('createPedestrian', ...)`:

```js
  it('passes itself to the sale and shows its box only when handed one', () => {
    const w = world();
    let buyer = null;
    w.recordSale = (pedestrian) => {
      buyer = pedestrian;
    };
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    for (let t = 0; t < 90 && p.state !== 'WALKING_OUT'; t += 1 / 60) p.update(1 / 60, w);
    expect(p.state).toBe('WALKING_OUT');
    expect(buyer).toBe(p);
    expect(p.hasBox).toBe(false);
    p.showBox();
    expect(p.hasBox).toBe(true);
  });

  it('reports where its hands hold the box', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    const at = p.boxPosition(new THREE.Vector3());
    const feet = p.figurePosition();
    expect(at.y).toBeGreaterThan(0.5);
    expect(Math.hypot(at.x - feet.x, at.z - feet.z)).toBeLessThan(0.5);
  });
```

In `tests/sim/simulation.test.js`, replace the "adds $5 each time a pizza is sold at the counter" test with:

```js
  it('adds $5 each time a pizza is sold at the counter', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const [customer] = sim.pedestrians;
    sim.world.recordSale(customer);
    expect(sim.balance).toBe(5);
    expect(customer.hasBox).toBe(true);
    sim.world.recordSale(customer);
    expect(sim.balance).toBe(10);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/pedestrian.test.js tests/sim/simulation.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'showBox')` from the fake world, `p.boxPosition is not a function`, and `expected false to be true` for `customer.hasBox` in the simulation test.

- [ ] **Step 3: Update `src/sim/pedestrian.js`**

Change `return {` (the object returned at the end of `createPedestrian`) to `const pedestrian = {`, and after that object's closing `};` add:

```js
  return pedestrian;
```

After the `figurePosition()` method, add:

```js
    showBox() {
      pizzaBox.visible = true;
    },

    boxPosition(out) {
      return out.copy(pizzaBox.position);
    },
```

In the `AT_COUNTER` case, replace:

```js
            pizzaBox.visible = true;
            world.recordSale();
```

with:

```js
            // The box appears in the customer's hands when the thrown one lands.
            world.recordSale(pedestrian);
```

- [ ] **Step 4: Update `recordSale` in `src/sim/simulation.js`**

Replace:

```js
    recordSale() {
      balance += PIZZA_PRICE;
    },
```

with:

```js
    recordSale(pedestrian) {
      balance += PIZZA_PRICE;
      pedestrian.showBox();
    },
```

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit (after confirming with the user)**

```bash
git add src/sim/pedestrian.js src/sim/simulation.js tests/sim/pedestrian.test.js tests/sim/simulation.test.js
git commit -m "refactor: hand the customer's box over through the sale"
```

---

### Task 8: Wire the pizza loop into the simulation

**Files:**
- Modify: `src/sim/simulation.js`
- Test: `tests/sim/simulation.test.js`, `tests/scene.test.js`

**Interfaces:**
- Consumes: `createOvenStock` (Task 2), `createPizzaHops` (Task 4), `createZoneMarker` (Task 5), `player.{ carried, receive, handOver, stack }` (Task 6), `pedestrian.{ showBox, boxPosition }` (Task 7), `materials.ovenBanner.map.userData.setCount` (Task 1).
- Produces: `createSimulation` returns `{ group, pedestrians, traffic, player, oven, hops, sellPoint, ovenPoint, world, balance, update(dt, keys) }`. `world.canServe()` is true only in the sell zone with `carried >= 1`. `world.recordSale(pedestrian)` adds $5, takes one pizza from the player, and flies the top box to the customer, calling `showBox()` when it lands.

- [ ] **Step 1: Write the failing tests**

In `tests/sim/simulation.test.js`, add these helpers directly after `leaveCustomerWaiting`:

```js
const STEP = 1 / 60;

function run(sim, seconds, keys) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) sim.update(STEP, keys);
}

function standIn(sim, zone) {
  sim.player.figure.position.set((zone.x[0] + zone.x[1]) / 2, 0, (zone.z[0] + zone.z[1]) / 2);
}

function waitForCustomer(sim) {
  const atCounter = () => sim.pedestrians.find((p) => p.state === 'AT_COUNTER');
  for (let t = 0; t < 90 && !atCounter(); t += STEP) sim.update(STEP);
  expect(atCounter()).toBeTruthy();
  return atCounter();
}

const zoneBanner = (point) => point.getObjectByName('zoneBanner');

// Runs the loop and reports how far a marker's beam opacity swung.
function glowSwing(sim, point, seconds = 2) {
  const beam = point.getObjectByName('zoneBeam');
  const seen = [];
  for (let t = 0; t < seconds; t += STEP) {
    sim.update(STEP);
    seen.push(beam.material.opacity);
  }
  return Math.max(...seen) - Math.min(...seen);
}
```

Replace the "adds $5 each time a pizza is sold at the counter" test with:

```js
  it('takes $5 and one carried pizza for each sale', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const [customer] = sim.pedestrians;
    sim.player.receive();
    sim.player.receive();
    sim.world.recordSale(customer);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(1);
  });
```

Replace "marks the sell zone with a banner in the scene" with:

```js
  it('marks the sell and oven zones in the scene', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.sellPoint.parent).toBe(sim.group);
    expect(sim.ovenPoint.parent).toBe(sim.group);
    expect(sim.hops.group.parent).toBe(sim.group);
  });
```

Replace "lets the cashier serve only from inside the sell zone" with:

```js
  it('serves only from inside the sell zone with a pizza in hand', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.world.canServe()).toBe(false);
    sim.player.receive();
    expect(sim.world.canServe()).toBe(true);
    run(sim, 1, new Set(['w']));
    expect(sim.world.canServe()).toBe(false);
  });
```

Replace "holds every sale until the cashier walks back into the sell zone" with:

```js
  it('holds every sale until the cashier walks back into the sell zone', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    leaveCustomerWaiting(sim);
    run(sim, 10);
    expect(sim.balance).toBe(0);

    standIn(sim, layout.queue.sellZone);
    run(sim, layout.sim.serveSeconds + 0.5);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(0);
  });

  it('never sells from empty hands, even inside the sell zone', () => {
    const sim = createSimulation(stubMaterials(), layout);
    waitForCustomer(sim);
    run(sim, 10);
    expect(sim.balance).toBe(0);
  });

  it('bakes, hands pizzas over one by one, and sells them at the cashier', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const { bakeSeconds, pickupSeconds } = layout.sim.pizza;
    run(sim, bakeSeconds * 2 + 0.5);
    expect(sim.oven.stock).toBe(2);

    standIn(sim, layout.oven.pickupZone);
    sim.update(STEP);
    expect(sim.player.carried).toBe(1);
    run(sim, pickupSeconds + 0.1);
    expect(sim.player.carried).toBe(2);
    expect(sim.oven.stock).toBe(0);

    standIn(sim, layout.queue.sellZone);
    for (let t = 0; t < 90 && sim.balance === 0; t += STEP) sim.update(STEP);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(1);
  });

  it('stops handing pizzas over once the hands are full', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const { carryMax, bakeSeconds } = layout.sim.pizza;
    for (let i = 0; i < carryMax - 1; i++) sim.player.receive();
    standIn(sim, layout.oven.pickupZone);
    run(sim, bakeSeconds * 2 + 0.5);
    expect(sim.player.carried).toBe(carryMax);
    expect(sim.oven.stock).toBe(1);
  });

  it('lands each picked-up pizza on the stack after its hop', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const shown = () => sim.player.stack.children.filter((box) => box.visible).length;
    run(sim, layout.sim.pizza.bakeSeconds + 0.5);
    standIn(sim, layout.oven.pickupZone);
    sim.update(STEP);
    expect(sim.player.carried).toBe(1);
    expect(shown()).toBe(0);
    run(sim, layout.sim.pizza.hopSeconds + 0.05);
    expect(shown()).toBe(1);
  });

  it('flies the sold box to the customer before it reaches their hands', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    const customer = waitForCustomer(sim);
    for (let t = 0; t < 10 && sim.balance === 0; t += STEP) sim.update(STEP);
    expect(sim.balance).toBe(5);
    expect(customer.hasBox).toBe(false);
    run(sim, layout.sim.pizza.hopSeconds + 0.05);
    expect(customer.hasBox).toBe(true);
  });
```

Replace both "pulses the sell zone only while a customer is left waiting" and "raises the sell banner only while a customer waits for an absent cashier" with:

```js
  it('points an empty-handed player at the oven while customers wait', () => {
    const sim = createSimulation(stubMaterials(), layout);
    leaveCustomerWaiting(sim);
    expect(glowSwing(sim, sim.ovenPoint)).toBeGreaterThan(0.1);
    expect(glowSwing(sim, sim.sellPoint)).toBeLessThan(1e-6);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
  });

  it('points a player carrying pizzas at the cashier while customers wait', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    leaveCustomerWaiting(sim);
    expect(zoneBanner(sim.sellPoint).visible).toBe(true);
    expect(glowSwing(sim, sim.sellPoint)).toBeGreaterThan(0.1);
    expect(glowSwing(sim, sim.ovenPoint)).toBeLessThan(1e-6);
  });

  it('calls nobody over when no one waits or the player is already selling', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.update(STEP);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
    expect(glowSwing(sim, sim.ovenPoint, 1)).toBeLessThan(1e-6);

    for (let i = 0; i < 3; i++) sim.player.receive();
    waitForCustomer(sim);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
    expect(glowSwing(sim, sim.sellPoint, 1)).toBeLessThan(1e-6);
    expect(glowSwing(sim, sim.ovenPoint, 1)).toBeLessThan(1e-6);
  });

  it('always shows the oven banner with its current count', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const banner = zoneBanner(sim.ovenPoint);
    run(sim, layout.sim.pizza.bakeSeconds * 2 + 0.5);
    expect(banner.visible).toBe(true);
    expect(sim.oven.stock).toBe(2);
    expect(banner.material.map.userData.count).toBe(2);
  });
```

In `tests/scene.test.js`, append inside `describe('createShop', ...)`:

```js
  // The first sell marker sat on the floor behind the counter, where the
  // fixed camera could not see any of it. This casts a ray from each outline
  // dash toward the camera and fails if anything solid is in the way.
  it('keeps both zone outlines where the game camera can see them', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|cashier|pedestrian-|pizzaHops)/;
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const ray = new THREE.Raycaster();
    const { sellPoint, ovenPoint } = shop.userData.simulation;
    for (const point of [sellPoint, ovenPoint]) {
      for (const dash of point.getObjectByName('zoneEdge').children) {
        const b = new THREE.Box3().setFromObject(dash);
        const top = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
        ray.set(top.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
        ray.far = 200 - 1e-3;
        const label = `${point.name} dash at (${top.x.toFixed(2)}, ${top.z.toFixed(2)})`;
        expect(ray.intersectObjects(blockers, false), label).toHaveLength(0);
      }
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/simulation.test.js tests/scene.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'stock')` for `sim.oven`, `Cannot read properties of undefined (reading 'getObjectByName')` for `ovenPoint`, and `expected true to be false` for serving with empty hands.

- [ ] **Step 3: Rewrite `src/sim/simulation.js`**

```js
import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPool } from './pool.js';
import { createOvenStock } from './ovenStock.js';
import { createZoneMarker } from '../models/zoneMarker.js';
import { createPizzaHops } from '../models/pizzaHops.js';

function inside(position, zone) {
  return (
    position.x >= zone.x[0] && position.x <= zone.x[1] &&
    position.z >= zone.z[0] && position.z <= zone.z[1]
  );
}

export function createSimulation(materials, layout, { horn } = {}) {
  const group = new THREE.Group();
  group.name = 'simulation';
  const silentHorn = { play() {} };

  const pedestrians = [];
  for (let i = 0; i < layout.sim.pedestrians; i++) {
    const pedestrian = createPedestrian(materials, layout, { index: i });
    pedestrians.push(pedestrian);
    group.add(pedestrian.group);
  }

  const PIZZA_PRICE = 5;
  let balance = 0;

  const pizza = layout.sim.pizza;
  const player = createPlayer(materials, layout);
  const oven = createOvenStock(layout);
  const hops = createPizzaHops(materials, layout);
  const sellZone = layout.queue.sellZone;
  const pickupZone = layout.oven.pickupZone;
  const mouth = layout.oven.mouth;
  // Picked-up boxes leave from the middle of the oven's arch.
  const ovenMouth = new THREE.Vector3(mouth.x, mouth.sill + mouth.height / 2, layout.oven.dome.center[2]);
  // Counts change at launch; the stack only shows a box once it has landed.
  let inFlightToPlayer = 0;

  const world = {
    isSlotFree(slotIndex) {
      return !pedestrians.some((p) => p.slot === slotIndex);
    },
    queueLength() {
      return pedestrians.filter((p) => p.slot !== null).length;
    },
    // FIFO: a slot is claimed when the person reaches the line, behind
    // whoever is already standing there.
    enqueueSlot() {
      let last = -1;
      for (const pedestrian of pedestrians) {
        if (pedestrian.slot !== null && pedestrian.slot > last) last = pedestrian.slot;
      }
      return last + 1;
    },
    // Customers are only served by a cashier in the sell zone with a pizza.
    canServe() {
      return inside(player.figure.position, sellZone) && player.carried >= 1;
    },
    recordSale(pedestrian) {
      balance += PIZZA_PRICE;
      const from = player.stack.userData.slotPosition(
        Math.max(0, player.carried - 1),
        new THREE.Vector3()
      );
      player.handOver();
      const aim = new THREE.Vector3();
      hops.launch(from, () => pedestrian.boxPosition(aim), () => pedestrian.showBox());
    },
  };

  function pickUp() {
    const slot = player.carried;
    player.receive();
    inFlightToPlayer++;
    const aim = new THREE.Vector3();
    hops.launch(
      ovenMouth,
      () => player.stack.userData.slotPosition(slot, aim),
      () => {
        inFlightToPlayer--;
      }
    );
  }

  function compactQueue() {
    const holders = pedestrians
      .filter((p) => p.slot !== null)
      .sort((a, b) => a.slot - b.slot);
    holders.forEach((p, i) => p.reassignSlot(i));
  }

  // Pedestrians go through a pool rather than a scan for an IDLE one. A
  // vehicle claims its passenger on approach but only calls start() once it
  // reaches the bay; scanning would hand the same pedestrian to a second
  // vehicle inside that window.
  const pedestrianPool = createPool(pedestrians);

  const traffic = createTraffic(materials, layout, {
    horn: horn || silentHorn,
    bays: createPool(layout.sim.bays),
    takePedestrian: () => pedestrianPool.acquire(),
    releasePedestrian: (pedestrian) => pedestrianPool.release(pedestrian),
  });
  group.add(traffic.group);

  group.add(player.figure);
  group.add(hops.group);

  // The cashier's outline sits just above the counter top, because the
  // counter hides the floor behind it from the game camera. The oven's
  // outline can sit on the floor, where the camera sees it.
  const sellPoint = createZoneMarker(materials, {
    name: 'sellPoint',
    zone: sellZone,
    outlineY: layout.counter.topHeight + layout.surfaceEps * 2,
    bannerMaterial: materials.sellBanner,
    banner: layout.queue.sellBanner,
  });
  const ovenPoint = createZoneMarker(materials, {
    name: 'ovenPoint',
    zone: pickupZone,
    outlineY: layout.ground.floorY.terracotta + layout.surfaceEps,
    bannerMaterial: materials.ovenBanner,
    banner: layout.oven.banner,
  });
  group.add(sellPoint, ovenPoint);

  return {
    group,
    pedestrians,
    traffic,
    player,
    oven,
    hops,
    sellPoint,
    ovenPoint,
    world,
    get balance() {
      return balance;
    },
    update(dt, keys) {
      player.update(dt, keys);
      const released = oven.update(dt, {
        inZone: inside(player.figure.position, pickupZone),
        room: pizza.carryMax - player.carried,
      });
      for (let i = 0; i < released; i++) pickUp();

      traffic.update(dt);
      compactQueue();
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
      hops.update(dt);
      player.stack.userData.setCount(Math.max(0, player.carried - inFlightToPlayer));

      // The guidance table from the spec.
      const waiting = pedestrians.some((p) => p.state === 'AT_COUNTER');
      const carrying = player.carried >= 1;
      const callToSell = waiting && carrying && !inside(player.figure.position, sellZone);
      sellPoint.userData.update(dt, { pulse: callToSell, showBanner: callToSell });
      ovenPoint.userData.update(dt, { pulse: waiting && !carrying, showBanner: true });
      materials.ovenBanner.map.userData.setCount(oven.stock, pizza.ovenCapacity);
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/simulation.test.js tests/scene.test.js`
Expected: PASS — including the unchanged "fills the lot and makes somebody honk over a long run" test.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit (after confirming with the user)**

```bash
git add src/sim/simulation.js tests/sim/simulation.test.js tests/scene.test.js
git commit -m "feat: collect pizzas at the oven and sell them from the carried stack"
```

---

### Task 9: Check both markers in the running game

**Files:**
- Modify only if the screenshot shows a problem: `src/layout.js` (`oven.banner`), `src/textures.js` (`ovenBannerTexture` layout)

**Interfaces:**
- Consumes: the finished game from Tasks 1–8. Produces no code.

The carried stack, pickups and flying boxes need keyboard input, so a still screenshot cannot show them; the simulation tests cover them. This task checks what a screenshot can: both markers render where the camera can see them, and the oven banner shows a count.

- [ ] **Step 1: Start the dev server on a spare port**

Run in the background: `npx vite --port 5199 --strictPort`
Wait until `curl -sf http://localhost:5199 >/dev/null` succeeds (poll in a background loop; macOS has no `timeout`).

- [ ] **Step 2: Take a 2x screenshot with headless Chrome**

Headless Chrome does not exit while the render loop runs, so start it in the background with a throwaway profile, wait for the file, then stop it:

```bash
SHOTS=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --user-data-dir="$SHOTS/oven-profile" --no-first-run --hide-scrollbars \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=2 \
  --window-size=1800,1100 --virtual-time-budget=6000 \
  --screenshot="$SHOTS/scene.png" http://localhost:5199/
```

Once `$SHOTS/scene.png` exists and is non-empty:

```bash
pkill -9 -f '[u]ser-data-dir=.*oven-profile'
```

- [ ] **Step 3: Crop the counter and the oven**

```bash
sips --cropToHeightWidth 520 720 --cropOffset 540 1100 "$SHOTS/scene.png" --out "$SHOTS/counter.png"
sips --cropToHeightWidth 560 760 --cropOffset 300 900 "$SHOTS/scene.png" --out "$SHOTS/oven.png"
```

If the oven is not in `oven.png`, open `scene.png` and move the offset (the `--cropOffset` order is y then x, in 2x pixels).

- [ ] **Step 4: Confirm what the screenshot shows**

1. A glowing dashed outline on the floor in front of the oven mouth, with a faint beam rising from it.
2. The oven banner above it, with a pizza icon and a count such as `1/10` (about 6 s of simulated time has passed), not blank and not overlapping the SELL banner.
3. The cashier's dashed outline just above the counter top, and no SELL banner (nobody is waiting and the cashier's hands are empty).
4. The `$0` balance label and HUD buttons still in place.

If the oven banner crowds the chimney or its text overflows the panel, adjust `layout.oven.banner` or the text position and size in `ovenBannerTexture`, then re-run `npx vitest run tests/textures.test.js tests/models/zoneMarker.test.js tests/sim/simulation.test.js` and repeat Steps 2–4.

- [ ] **Step 5: Stop the dev server**

```bash
lsof -ti:5199 -sTCP:LISTEN | xargs kill
```

- [ ] **Step 6: Commit any tuning (after confirming with the user)**

```bash
git add src/layout.js src/textures.js
git commit -m "fix: tune the oven banner after checking it in the game"
```

Skip this step if nothing needed changing.

---

## Verification

```bash
npx vitest run && npm run build
```

Expected: every test passes and Vite builds with no errors (the existing chunk-size warning for the three.js bundle is expected).
