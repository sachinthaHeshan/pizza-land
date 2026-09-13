# Dine-in Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put four tables in the shop's empty dining wing, let arriving customers sit at them, and let the player deliver a pizza to a table by standing in its dashed zone — the table eats for 40 seconds and leaves.

**Architecture:** A plain state machine, `createDiningRoom(layout)`, owns four tables and every timer, with no three.js. A furniture model draws a table and two chairs; the dining wing places four of them. Pedestrians gain two states and a seated pose built from the figure's existing hip pivots. The simulation wires the room to four zone markers, serves a table when the player stands in its zone carrying a pizza, and sends diners home when their table empties.

**Tech Stack:** three r186, vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-13-dine-in-tables-design.md`

## Global Constraints

- Table centres, verbatim from the spec: (−8.4, −2.6), (−5.2, −2.6), (−8.4, −4.8), (−5.2, −4.8). Chairs sit at z ± 0.75. Delivery zones are x −7.70…−7.00 for the left column and x −6.60…−5.90 for the right, each z ± 0.45 about its table.
- Every zone outline sits at tabletop height (`top.height + top.thickness + surfaceEps` = 0.86), never on the floor. Measured with the furniture in place: a floor outline beside a table is hidden by that table, because the sight line to this camera runs −x and +z, straight under the top.
- Every one of those numbers was measured by raycasting the built scene along `layout.camera.direction`. Do not "tidy" them: this camera only sees faces pointing +z or −x, and the west wall, storefront plinth and sign each cast a blind spot across the dining floor.
- Timings, verbatim: `eatSeconds` 40, `patienceSeconds` 60, `dineInChance` 0.5, `tablePrice` 8, `seatsPerTable` 2, `seed` 20260913.
- `src/sim/dining.js` imports only `src/utils/random.js`. No three.js, no `Math.random` — every draw comes from `mulberry32(layout.dining.seed)`.
- All timers run on simulation time, so the existing 1×/2×/5× speed control scales them.
- At most one table is served per frame.
- Banners and the zone pulse show only while that table wants a pizza, matching the cashier rule.
- The user edits `src/layout.js`, `src/main.js` and several test files in this tree: change existing files with small targeted edits only, never whole-file rewrites.
- No commits unless the user asks: never run `git add`, `git commit`, `git stash`, `git checkout`, `git restore` or `git reset`.
- Run tests with `npx vitest run` (append a path to run one file).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/layout.js` | the `dining` block: tables, zones, furniture sizes, timings |
| `src/textures.js` | `tableBanner` art |
| `src/materials.js` | `tableBanner` sprite material |
| `src/sim/dining.js` | the four-table state machine, no three.js |
| `src/models/diningTable.js` | one table and two chairs, furniture only |
| `src/models/figure.js` | exports `LEG_PROPORTIONS` so the seated height is derived |
| `src/building/diningWing.js` | places the four tables |
| `src/sim/paths.js` | `seatPosition`, `walkToSeatPath`, `walkFromSeatPath` |
| `src/sim/pedestrian.js` | `WALKING_TO_TABLE` and `SEATED`, the seated pose, `leaveTable()` |
| `src/sim/simulation.js` | wires the room, markers, serving, payment and the table boxes |
| `src/sim/obstacles.js` | table footprints block the player |

---

### Task 1: Dining settings, banner art and material

**Files:**
- Modify: `src/layout.js`, `src/textures.js`, `src/materials.js`
- Test: `tests/layout.test.js`, `tests/textures.test.js`, `tests/materials.test.js`

**Interfaces:**
- Produces: `layout.dining` with exactly the shape in Step 3.
- Produces: texture key `tableBanner` and material `tableBanner` (a `THREE.SpriteMaterial`, like `sellBanner`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/layout.test.js`:

```js
describe('layout.dining', () => {
  const d = layout.dining;
  const f = layout.diningWing.footprint;
  const inner = layout.diningWing.thickness / 2;
  const half = d.top.size / 2;

  it('seats four tables well inside the dining wing', () => {
    expect(d.tables).toHaveLength(4);
    for (const table of d.tables) {
      expect(table.x - half).toBeGreaterThan(f.x[0] + inner);
      expect(table.x + half).toBeLessThan(f.x[1] - inner);
      expect(table.z - half).toBeGreaterThan(f.z[0] + inner);
      expect(table.z + half).toBeLessThan(f.z[1] - inner);
    }
  });

  it('keeps the back chairs clear of the north wall', () => {
    for (const table of d.tables) {
      const backEdge = table.z - d.chair.offset - d.chair.size / 2;
      expect(backEdge, `table at z ${table.z}`).toBeGreaterThan(f.z[0] + inner);
    }
  });

  it('never lets two delivery zones overlap', () => {
    const zones = d.tables.map((table) => table.zone);
    for (let a = 0; a < zones.length; a++) {
      for (let b = a + 1; b < zones.length; b++) {
        const hit =
          zones[a].x[0] < zones[b].x[1] && zones[b].x[0] < zones[a].x[1] &&
          zones[a].z[0] < zones[b].z[1] && zones[b].z[0] < zones[a].z[1];
        expect(hit, `zones ${a} and ${b}`).toBe(false);
      }
    }
  });

  it('keeps every delivery zone off every table', () => {
    for (const zone of d.tables.map((table) => table.zone)) {
      for (const table of d.tables) {
        const hit =
          zone.x[0] < table.x + half && table.x - half < zone.x[1] &&
          zone.z[0] < table.z + half && table.z - half < zone.z[1];
        expect(hit, `zone over table at (${table.x}, ${table.z})`).toBe(false);
      }
    }
  });

  it('gives the tables timings that leave the room recoverable', () => {
    expect(d.eatSeconds).toBe(40);
    expect(d.patienceSeconds).toBeGreaterThan(d.eatSeconds / 2);
    expect(d.dineInChance).toBeGreaterThan(0);
    expect(d.dineInChance).toBeLessThan(1);
    expect(d.tablePrice).toBeGreaterThan(5);
  });
});
```

Append inside `describe('createTextures', ...)` in `tests/textures.test.js`:

```js
  it('letters SERVE onto the table banner', () => {
    expect(TEXTURE_KEYS).toContain('tableBanner');
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const banner = canvases[TEXTURE_KEYS.indexOf('tableBanner')];
    const words = banner.__calls
      .filter(([method]) => method === 'fillText')
      .map(([, text]) => text);
    expect(words).toEqual(expect.arrayContaining(['SERVE']));
    expect(layout.dining.banner.width / layout.dining.banner.height).toBeCloseTo(
      banner.width / banner.height
    );
  });
```

Append inside `describe('createMaterials', ...)` in `tests/materials.test.js`:

```js
  it('gives the tables an unlit banner sprite material', () => {
    const materials = createMaterials(createTextures(stubCanvasFactory()));
    const banner = materials.tableBanner;
    expect(banner).toBeInstanceOf(THREE.SpriteMaterial);
    expect(banner.transparent).toBe(true);
    expect(banner.toneMapped).toBe(false);
    expect(banner.depthWrite).toBe(false);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/layout.test.js tests/textures.test.js tests/materials.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'tables')` for the layout tests, `expected [ … ] to contain 'tableBanner'` for the texture test, and `expected undefined to be an instance of SpriteMaterial` for the material test.

- [ ] **Step 3: Add the `dining` block to `src/layout.js`**

Insert directly above the `  lighting: {` line:

```js
  // Four tables in the dining wing. Every coordinate here was measured by
  // raycasting the built scene along camera.direction: this camera only sees
  // faces pointing +z or -x, and the west wall, storefront plinth and sign
  // each hide part of the dining floor. Both columns are served from the
  // central aisle because the storefront hides the floor along the east wall.
  dining: {
    tables: [
      { x: -8.4, z: -2.6, zone: { x: [-7.7, -7.0], z: [-3.05, -2.15] } },
      { x: -5.2, z: -2.6, zone: { x: [-6.6, -5.9], z: [-3.05, -2.15] } },
      { x: -8.4, z: -4.8, zone: { x: [-7.7, -7.0], z: [-5.25, -4.35] } },
      { x: -5.2, z: -4.8, zone: { x: [-6.6, -5.9], z: [-5.25, -4.35] } },
    ],
    // `height` is the underside of the top slab, so the top surface is
    // height + thickness.
    top: { size: 1.0, height: 0.78, thickness: 0.06 },
    pedestal: { radius: 0.12, footRadius: 0.32, footHeight: 0.05 },
    chair: { offset: 0.75, seatHeight: 0.45, seatThickness: 0.05, size: 0.44, backHeight: 0.85 },
    banner: { y: 2.3, width: 1.6, height: 0.8, bob: 0.06 },
    seatsPerTable: 2,
    eatSeconds: 40,
    patienceSeconds: 60,
    dineInChance: 0.5,
    seed: 20260913,
    tablePrice: 8,
    // Customers walk in through the middle of the storefront door.
    doorX: -5.4,
  },
```

- [ ] **Step 4: Add the banner art to `src/textures.js`**

After the whole `function sellBanner(factory) { ... }` block, add:

```js
// The prompt over a table waiting for a pizza. Same panel as the sell banner
// so the two read as one family, with a single short word that stays legible
// at the default zoom.
function tableBanner(factory) {
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

  pizzaSlice(ctx, 300, 256, 300);

  ctx.font = '900 170px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#3b2314';
  ctx.strokeText('SERVE', 670, 262);
  ctx.fillStyle = '#ffd23a';
  ctx.fillText('SERVE', 670, 262);
  return finish(canvas);
}
```

In `TEXTURE_KEYS`, after `'stripeGreen',` add:

```js
  'tableBanner',
```

In `GENERATORS`, after `stripeGreen,` add:

```js
  tableBanner,
```

- [ ] **Step 5: Add the material to `src/materials.js`**

In `MATERIAL_KEYS`, after `'stripeGreen',` add:

```js
  'tableBanner',
```

In `TILE`, after `ovenBanner: null,` add:

```js
  tableBanner: null,
```

Inside the `materials` object, directly after the `ovenBanner: new THREE.SpriteMaterial({ ... }),` entry, add:

```js
    tableBanner: new THREE.SpriteMaterial({
      name: 'tableBanner',
      map: textures.tableBanner,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 7: Commit (only if the user asks)**

```bash
git add src/layout.js src/textures.js src/materials.js tests/layout.test.js tests/textures.test.js tests/materials.test.js
git commit -m "feat: add dining room settings and the table banner"
```

---

### Task 2: The dining room rules

**Files:**
- Create: `src/sim/dining.js`
- Test: `tests/sim/dining.test.js`

**Interfaces:**
- Consumes: `layout.dining` (Task 1); `mulberry32` from `src/utils/random.js`.
- Produces: `createDiningRoom(layout)` returning `{ tables, claimSeat(), serve(table), wants(table), update(dt) }`. `tables` is an array of `{ state, seats, secondsLeft }` where `state` is `'EMPTY' | 'WAITING' | 'EATING'` and `seats` is an array of booleans. `claimSeat()` returns `{ table, seat }` indices or `null`. `serve(table)` returns a boolean. `update(dt)` returns an array of table indices that emptied this step.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/dining.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createDiningRoom } from '../../src/sim/dining.js';
import { layout } from '../../src/layout.js';

// A layout whose draw always passes, so seat-claiming can be tested without
// fighting the RNG. `always: false` never seats anybody.
function roomWith(overrides = {}) {
  return createDiningRoom({
    ...layout,
    dining: { ...layout.dining, ...overrides },
  });
}
const seatingRoom = (overrides = {}) => roomWith({ dineInChance: 1, ...overrides });

describe('createDiningRoom', () => {
  it('starts with every table empty and every seat free', () => {
    const room = seatingRoom();
    expect(room.tables).toHaveLength(layout.dining.tables.length);
    for (const table of room.tables) {
      expect(table.state).toBe('EMPTY');
      expect(table.seats).toHaveLength(layout.dining.seatsPerTable);
      expect(table.seats.every((taken) => taken === false)).toBe(true);
      expect(room.wants(room.tables.indexOf(table))).toBe(false);
    }
  });

  it('never seats anybody when the draw fails', () => {
    const room = roomWith({ dineInChance: 0 });
    for (let i = 0; i < 20; i++) expect(room.claimSeat()).toBeNull();
  });

  it('seats the first customer and starts the table waiting', () => {
    const room = seatingRoom();
    expect(room.claimSeat()).toEqual({ table: 0, seat: 0 });
    expect(room.tables[0].state).toBe('WAITING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.patienceSeconds);
    expect(room.wants(0)).toBe(true);
  });

  it('fills every seat at every table before giving up', () => {
    const room = seatingRoom();
    const seats = layout.dining.seatsPerTable * layout.dining.tables.length;
    for (let i = 0; i < seats; i++) expect(room.claimSeat()).not.toBeNull();
    expect(room.claimSeat()).toBeNull();
  });

  it('lets two customers share a table', () => {
    const room = seatingRoom();
    expect(room.claimSeat()).toEqual({ table: 0, seat: 0 });
    expect(room.claimSeat()).toEqual({ table: 0, seat: 1 });
    expect(room.claimSeat()).toEqual({ table: 1, seat: 0 });
  });

  it('refuses to seat anybody at a table that is already eating', () => {
    const room = seatingRoom();
    room.claimSeat();
    expect(room.serve(0)).toBe(true);
    expect(room.claimSeat()).toEqual({ table: 1, seat: 0 });
  });

  it('serves only a waiting table', () => {
    const room = seatingRoom();
    expect(room.serve(0)).toBe(false);
    room.claimSeat();
    expect(room.serve(0)).toBe(true);
    expect(room.tables[0].state).toBe('EATING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.eatSeconds);
    expect(room.serve(0)).toBe(false);
    expect(room.wants(0)).toBe(false);
  });

  it('empties a table when the meal finishes, freeing its seats once', () => {
    const room = seatingRoom();
    room.claimSeat();
    room.claimSeat();
    room.serve(0);
    expect(room.update(layout.dining.eatSeconds - 0.1)).toEqual([]);
    expect(room.update(0.2)).toEqual([0]);
    expect(room.tables[0].state).toBe('EMPTY');
    expect(room.tables[0].seats.every((taken) => taken === false)).toBe(true);
    expect(room.update(10)).toEqual([]);
  });

  it('empties a table nobody serves, so the room cannot deadlock', () => {
    const room = seatingRoom();
    room.claimSeat();
    expect(room.update(layout.dining.patienceSeconds - 0.1)).toEqual([]);
    expect(room.update(0.2)).toEqual([0]);
    expect(room.tables[0].state).toBe('EMPTY');
    expect(room.claimSeat()).toEqual({ table: 0, seat: 0 });
  });

  it('leaves an empty table alone', () => {
    const room = seatingRoom();
    room.update(1000);
    for (const table of room.tables) expect(table.secondsLeft).toBe(0);
  });

  it('reports every table that empties in the same step', () => {
    const room = seatingRoom();
    room.claimSeat();
    room.claimSeat();
    room.claimSeat();
    room.serve(0);
    room.serve(1);
    expect(room.update(layout.dining.eatSeconds + 0.1).sort()).toEqual([0, 1]);
  });

  it('draws only from its seed, never Math.random', () => {
    const a = roomWith();
    const b = roomWith();
    const drawsA = [];
    const drawsB = [];
    for (let i = 0; i < 12; i++) {
      drawsA.push(a.claimSeat());
      drawsB.push(b.claimSeat());
    }
    expect(drawsA).toEqual(drawsB);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/dining.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/dining.js'`.

- [ ] **Step 3: Write `src/sim/dining.js`**

```js
import { mulberry32 } from '../utils/random.js';

// The dining room's side of the pizza economy: four tables that fill with
// customers, ask for a pizza, eat for a while and empty again. Plain numbers
// only, so the rules step deterministically in tests.
export function createDiningRoom(layout) {
  const d = layout.dining;
  const rng = mulberry32(d.seed);
  const tables = d.tables.map(() => ({
    state: 'EMPTY',
    seats: new Array(d.seatsPerTable).fill(false),
    secondsLeft: 0,
  }));

  return {
    tables,

    // One seeded decision: the draw first, then the first free seat at a
    // table that is not already eating, so nobody joins a meal in progress.
    // Returns indices, or null when this customer should queue instead.
    claimSeat() {
      if (rng() >= d.dineInChance) return null;
      for (let table = 0; table < tables.length; table++) {
        const spot = tables[table];
        if (spot.state === 'EATING') continue;
        const seat = spot.seats.indexOf(false);
        if (seat === -1) continue;
        spot.seats[seat] = true;
        if (spot.state === 'EMPTY') {
          spot.state = 'WAITING';
          spot.secondsLeft = d.patienceSeconds;
        }
        return { table, seat };
      }
      return null;
    },

    wants(table) {
      return tables[table].state === 'WAITING';
    },

    serve(table) {
      const spot = tables[table];
      if (spot.state !== 'WAITING') return false;
      spot.state = 'EATING';
      spot.secondsLeft = d.eatSeconds;
      return true;
    },

    // Returns the tables that emptied this step, whether the meal finished or
    // patience ran out, and frees their seats so the caller only has to walk
    // those diners home.
    update(dt) {
      const released = [];
      for (let i = 0; i < tables.length; i++) {
        const spot = tables[i];
        if (spot.state === 'EMPTY') continue;
        spot.secondsLeft -= dt;
        if (spot.secondsLeft > 0) continue;
        spot.state = 'EMPTY';
        spot.secondsLeft = 0;
        spot.seats.fill(false);
        released.push(i);
      }
      return released;
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/dining.test.js`
Expected: PASS — 12 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit (only if the user asks)**

```bash
git add src/sim/dining.js tests/sim/dining.test.js
git commit -m "feat: add the dining room state machine"
```

---

### Task 3: The table model

**Files:**
- Create: `src/models/diningTable.js`
- Modify: `src/models/figure.js`
- Test: `tests/models/diningTable.test.js`, `tests/models/figure.test.js`

**Interfaces:**
- Consumes: `layout.dining` (Task 1); `box` from `src/utils/geometry.js`.
- Produces: `createDiningTable(materials, layout, { x, z })` → a `THREE.Group` named `diningTable`, standing on the dining floor, whose top surface is at `layout.dining.top.height + layout.dining.top.thickness`, with two chairs at `z ± layout.dining.chair.offset`.
- Produces: `LEG_PROPORTIONS = { hip: P.legTop }` exported from `src/models/figure.js`, so the seated height in Task 6 is derived rather than duplicated.

- [ ] **Step 1: Write the failing tests**

Create `tests/models/diningTable.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDiningTable } from '../../src/models/diningTable.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.dining.tables[0];
const d = layout.dining;
const table = createDiningTable(stubMaterials(), layout, spec);

describe('createDiningTable', () => {
  it('returns a named group with finite bounds', () => {
    expect(table).toBeInstanceOf(THREE.Group);
    expect(table.name).toBe('diningTable');
    expectFinite(boundsOf(table));
  });

  it('stands on the dining floor', () => {
    expect(boundsOf(table).min.y).toBeCloseTo(layout.ground.diningFloor.y, 5);
  });

  it('puts the top surface at the height the layout asks for', () => {
    const tops = [];
    table.traverse((o) => {
      if (o.isMesh && o.name === 'tableTop') tops.push(boundsOf(o));
    });
    expect(tops).toHaveLength(1);
    expect(tops[0].max.y).toBeCloseTo(d.top.height + d.top.thickness, 5);
    expect(tops[0].max.x - tops[0].min.x).toBeCloseTo(d.top.size, 5);
    expect(tops[0].max.z - tops[0].min.z).toBeCloseTo(d.top.size, 5);
  });

  it('centres the table on its layout spot', () => {
    const bounds = boundsOf(table);
    const centre = bounds.getCenter(new THREE.Vector3());
    expect(centre.x).toBeCloseTo(spec.x, 5);
    expect(centre.z).toBeCloseTo(spec.z, 5);
  });

  it('sets two chairs facing each other across the table', () => {
    const chairs = table.children.filter((child) => child.name === 'chair');
    expect(chairs).toHaveLength(d.seatsPerTable);
    const zs = chairs.map((chair) => boundsOf(chair).getCenter(new THREE.Vector3()).z).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(spec.z - d.chair.offset, 1);
    expect(zs[1]).toBeCloseTo(spec.z + d.chair.offset, 1);
  });

  it('keeps every chair back on the far side from the table', () => {
    for (const chair of table.children.filter((c) => c.name === 'chair')) {
      const backs = [];
      chair.traverse((o) => {
        if (o.isMesh && o.name === 'chairBack') backs.push(boundsOf(o));
      });
      expect(backs).toHaveLength(1);
      const chairZ = boundsOf(chair).getCenter(new THREE.Vector3()).z;
      const backZ = backs[0].getCenter(new THREE.Vector3()).z;
      // The back is further from the table centre than the seat is.
      expect(Math.abs(backZ - spec.z)).toBeGreaterThan(Math.abs(chairZ - spec.z));
      expect(backs[0].max.y).toBeCloseTo(d.chair.backHeight, 5);
    }
  });

  it('casts and receives shadows from every part', () => {
    table.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.castShadow, o.name).toBe(true);
      expect(o.receiveShadow, o.name).toBe(true);
    });
  });
});
```

Append inside `describe('createFigure', ...)` in `tests/models/figure.test.js`:

```js
  it('exposes the hip height so a seated pose can be derived', () => {
    const figure = createFigure(stubMaterials(), { height: 1.7, cloth: 'clothBlue', hair: 'hairDark' });
    const hip = figure.userData.limbs.legL.position.y;
    expect(LEG_PROPORTIONS.hip * 1.7).toBeCloseTo(hip, 6);
  });
```

Add `LEG_PROPORTIONS` to that file's existing import from `../../src/models/figure.js`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/models/diningTable.test.js tests/models/figure.test.js`
Expected: FAIL — `Cannot find module '../../src/models/diningTable.js'`, and `LEG_PROPORTIONS is not defined` in the figure test.

- [ ] **Step 3: Export the hip fraction from `src/models/figure.js`**

Directly below the existing `ARM_PROPORTIONS` block, add:

```js
// The hip height as a fraction of the figure's height, for anything that has
// to seat the figure rather than stand it.
export const LEG_PROPORTIONS = Object.freeze({ hip: P.legTop });
```

- [ ] **Step 4: Write `src/models/diningTable.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

const LEG = 0.05; // chair and table leg thickness

function part(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// One chair, standing on the floor with its back on the side away from the
// table. `side` is +1 for the chair at +z, -1 for the one at -z.
function createChair(materials, layout, { x, z, side }) {
  const c = layout.dining.chair;
  const floor = layout.ground.diningFloor.y;
  const group = new THREE.Group();
  group.name = 'chair';
  const half = c.size / 2;
  const seatTop = c.seatHeight + c.seatThickness;

  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      const lx = x + dx * (half - LEG / 2);
      const lz = z + dz * (half - LEG / 2);
      group.add(
        part(
          box(materials.woodDark, {
            x: [lx - LEG / 2, lx + LEG / 2],
            y: [floor, c.seatHeight],
            z: [lz - LEG / 2, lz + LEG / 2],
          }),
          'chairLeg'
        )
      );
    }
  }

  group.add(
    part(
      box(materials.wood, {
        x: [x - half, x + half],
        y: [c.seatHeight, seatTop],
        z: [z - half, z + half],
      }),
      'chairSeat'
    )
  );

  // The back sits on the outer edge, so a diner facing the table leans away
  // from it rather than into it.
  const backZ = z + side * half;
  group.add(
    part(
      box(materials.wood, {
        x: [x - half, x + half],
        y: [seatTop, c.backHeight],
        z: [Math.min(backZ - side * LEG, backZ), Math.max(backZ - side * LEG, backZ)],
      }),
      'chairBack'
    )
  );

  return group;
}

// A dining table on a central pedestal, with a chair on each side along z.
// Pure furniture: the pizza that lands on it belongs to the simulation.
export function createDiningTable(materials, layout, { x, z }) {
  const d = layout.dining;
  const floor = layout.ground.diningFloor.y;
  const group = new THREE.Group();
  group.name = 'diningTable';
  const half = d.top.size / 2;

  const foot = part(
    new THREE.Mesh(
      new THREE.CylinderGeometry(d.pedestal.footRadius, d.pedestal.footRadius, d.pedestal.footHeight, 12),
      materials.metalDark
    ),
    'tableFoot'
  );
  foot.position.set(x, floor + d.pedestal.footHeight / 2, z);
  group.add(foot);

  const postBottom = floor + d.pedestal.footHeight;
  const postHeight = d.top.height - postBottom;
  const post = part(
    new THREE.Mesh(
      new THREE.CylinderGeometry(d.pedestal.radius, d.pedestal.radius, postHeight, 12),
      materials.metalDark
    ),
    'tablePost'
  );
  post.position.set(x, postBottom + postHeight / 2, z);
  group.add(post);

  group.add(
    part(
      box(materials.wood, {
        x: [x - half, x + half],
        y: [d.top.height, d.top.height + d.top.thickness],
        z: [z - half, z + half],
      }),
      'tableTop'
    )
  );

  for (const side of [1, -1]) {
    group.add(createChair(materials, layout, { x, z: z + side * d.chair.offset, side }));
  }

  return group;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/models/diningTable.test.js tests/models/figure.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 7: Commit (only if the user asks)**

```bash
git add src/models/diningTable.js src/models/figure.js tests/models/diningTable.test.js tests/models/figure.test.js
git commit -m "feat: add the dining table model"
```

---

### Task 4: Put the tables in the dining wing

**Files:**
- Modify: `src/building/diningWing.js`
- Test: `tests/building/diningWing.test.js`

**Interfaces:**
- Consumes: `createDiningTable` (Task 3); `layout.dining.tables` (Task 1).
- Produces: `createDiningWing` now contains four `diningTable` children, one per entry in `layout.dining.tables`.

- [ ] **Step 1: Write the failing test**

Append inside `describe('createDiningWing', ...)` in `tests/building/diningWing.test.js`:

```js
  it('furnishes the room with one table per layout spot', () => {
    const tables = group.children.filter((child) => child.name === 'diningTable');
    expect(tables).toHaveLength(layout.dining.tables.length);
    const centres = tables
      .map((table) => boundsOf(table).getCenter(new THREE.Vector3()))
      .map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`)
      .sort();
    const wanted = layout.dining.tables
      .map((spot) => `${spot.x.toFixed(2)},${spot.z.toFixed(2)}`)
      .sort();
    expect(centres).toEqual(wanted);
  });

  it('keeps the furniture under the wall height', () => {
    for (const table of group.children.filter((c) => c.name === 'diningTable')) {
      expect(boundsOf(table).max.y).toBeLessThan(layout.diningWing.wallHeight);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/building/diningWing.test.js`
Expected: FAIL — `expected [] to have a length of 4 but got +0`.

- [ ] **Step 3: Place the tables in `src/building/diningWing.js`**

Add the import beside the existing ones:

```js
import { createDiningTable } from '../models/diningTable.js';
```

Directly above the closing `  return group;` of `createDiningWing`, add:

```js
  for (const spot of layout.dining.tables) {
    group.add(createDiningTable(materials, layout, spot));
  }
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green, including the wing's existing envelope test.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/building/diningWing.js tests/building/diningWing.test.js
git commit -m "feat: furnish the dining wing with four tables"
```

---

### Task 5: Walking to a seat

**Files:**
- Modify: `src/sim/paths.js`
- Test: `tests/sim/paths.test.js`

**Interfaces:**
- Consumes: `layout.dining` (Task 1); the existing `walkInPath`.
- Produces: `seatPosition(layout, table, seat) -> { x, z }`; `walkToSeatPath(layout, bay, table, seat) -> [{x, z}, …]` starting at the car door and ending on the seat; `walkFromSeatPath(layout, bay, table, seat)` — the same points reversed.

- [ ] **Step 1: Write the failing test**

Append to `tests/sim/paths.test.js`:

```js
describe('walking to a seat', () => {
  const bay = layout.sim.bays[0];

  it('puts seat 0 on the +z side of its table and seat 1 on the -z side', () => {
    const spot = layout.dining.tables[2];
    expect(seatPosition(layout, 2, 0)).toEqual({ x: spot.x, z: spot.z + layout.dining.chair.offset });
    expect(seatPosition(layout, 2, 1)).toEqual({ x: spot.x, z: spot.z - layout.dining.chair.offset });
  });

  it('starts at the car door and ends on the seat', () => {
    const path = walkToSeatPath(layout, bay, 1, 0);
    const seat = seatPosition(layout, 1, 0);
    expect(path[0]).toEqual(doorPosition(layout, bay));
    expect(path[path.length - 1]).toEqual({ x: seat.x, z: seat.z });
  });

  it('goes in through the storefront door', () => {
    const path = walkToSeatPath(layout, bay, 3, 1);
    const door = layout.storefront.door.x;
    const threshold = path.find((point) => Math.abs(point.z - layout.storefront.z) < 1e-9);
    expect(threshold, 'a waypoint on the door threshold').toBeDefined();
    expect(threshold.x).toBeGreaterThan(door[0]);
    expect(threshold.x).toBeLessThan(door[1]);
  });

  it('never doubles back on itself and has finite points', () => {
    const path = walkToSeatPath(layout, bay, 0, 0);
    for (const point of path) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
    for (let i = 1; i < path.length; i++) {
      const same = path[i].x === path[i - 1].x && path[i].z === path[i - 1].z;
      expect(same, `duplicate waypoint at ${i}`).toBe(false);
    }
  });

  it('walks back out the way it came', () => {
    const inward = walkToSeatPath(layout, bay, 2, 1);
    expect(walkFromSeatPath(layout, bay, 2, 1)).toEqual([...inward].reverse());
  });
});
```

Add `seatPosition`, `walkToSeatPath`, `walkFromSeatPath` and `doorPosition` to that file's import from `../../src/sim/paths.js`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/paths.test.js`
Expected: FAIL — `seatPosition is not a function`.

- [ ] **Step 3: Add the helpers to `src/sim/paths.js`**

After `walkOutPath`, add:

```js
// Seat 0 sits on the +z side of its table, seat 1 on the -z side. Both face
// the table, which is what puts a diner's front toward this camera.
export function seatPosition(layout, table, seat) {
  const spot = layout.dining.tables[table];
  const offset = layout.dining.chair.offset;
  return { x: spot.x, z: spot.z + (seat === 0 ? offset : -offset) };
}

// The usual walk in as far as the plaza, then through the storefront door and
// across the room to the chair. The threshold is its own waypoint so walkers
// turn inside the doorway instead of cutting the corner through the wall.
export function walkToSeatPath(layout, bay, table, seat) {
  const { walk } = layout.sim;
  const doorX = layout.dining.doorX;
  const doorZ = layout.storefront.z;
  const seatAt = seatPosition(layout, table, seat);
  return [
    ...walkInPath(layout, bay, [doorX, walk.plazaZ]).slice(0, -1),
    { x: doorX, z: doorZ },
    { x: seatAt.x, z: doorZ - 1.0 },
    { x: seatAt.x, z: seatAt.z },
  ];
}

export function walkFromSeatPath(layout, bay, table, seat) {
  return [...walkToSeatPath(layout, bay, table, seat)].reverse();
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/sim/paths.js tests/sim/paths.test.js
git commit -m "feat: add the walk from the car to a dining chair"
```

---

### Task 6: Customers take a seat

**Files:**
- Modify: `src/sim/pedestrian.js`
- Test: `tests/sim/pedestrian.test.js`

**Interfaces:**
- Consumes: `seatPosition`, `walkToSeatPath`, `walkFromSeatPath` (Task 5); `LEG_PROPORTIONS` (Task 3); `world.claimSeat()` (Task 7 supplies the real one).
- Produces: `PEDESTRIAN_STATES` gains `'WALKING_TO_TABLE'` and `'SEATED'`; the pedestrian gains `get table()` (a table index or `null`) and `leaveTable()`, which stands the figure up and walks it out.

**Note on `world`:** `update` now calls `world.claimSeat()` on the first step after leaving the car. Every existing `world` stub must gain it or the current tests fail with `world.claimSeat is not a function`.

- [ ] **Step 1: Write the failing tests**

In `tests/sim/pedestrian.test.js`, add `claimSeat: () => null,` to the object returned by the existing `world()` helper, so today's tests keep queueing. Then add the imports:

```js
import { seatPosition } from '../../src/sim/paths.js';
```

and append inside `describe('createPedestrian', ...)`:

```js
  const person = layout.sim.people[0];

  function dineInWorld(claim = { table: 0, seat: 0 }) {
    let given = false;
    return {
      ...world(),
      claimSeat: () => {
        if (given) return null;
        given = true;
        return claim;
      },
    };
  }

  function seatedPedestrian(claim = { table: 0, seat: 0 }) {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = dineInWorld(claim);
    p.start(bay);
    run(p, w, 45);
    return p;
  }

  it('names the two dining states', () => {
    expect(PEDESTRIAN_STATES).toContain('WALKING_TO_TABLE');
    expect(PEDESTRIAN_STATES).toContain('SEATED');
  });

  it('heads for a table instead of the queue when the room offers a seat', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    p.update(1 / 60, dineInWorld());
    expect(p.state).toBe('WALKING_TO_TABLE');
    expect(p.table).toBe(0);
  });

  it('queues exactly as before when the room offers nothing', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    run(p, world(), 30);
    expect(['QUEUEING', 'AT_COUNTER']).toContain(p.state);
    expect(p.table).toBeNull();
  });

  it('arrives at its chair and sits down', () => {
    const p = seatedPedestrian({ table: 2, seat: 1 });
    expect(p.state).toBe('SEATED');
    const seat = seatPosition(layout, 2, 1);
    expect(p.figure.position.x).toBeCloseTo(seat.x, 2);
    expect(p.figure.position.z).toBeCloseTo(seat.z, 2);
  });

  it('sits with its hips on the chair and its legs swung forward', () => {
    const p = seatedPedestrian();
    const chair = layout.dining.chair;
    const hip = p.figure.position.y + person.height * LEG_PROPORTIONS.hip;
    expect(hip).toBeCloseTo(chair.seatHeight + chair.seatThickness, 5);
    const limbs = p.figure.userData.limbs;
    expect(limbs.legL.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
    expect(limbs.legR.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('keeps a seated head above the tabletop, where the camera can see it', () => {
    const p = seatedPedestrian();
    const headTop = p.figure.position.y + person.height * 0.9;
    expect(headTop).toBeGreaterThan(layout.dining.top.height + layout.dining.top.thickness);
  });

  it('faces the table it is sitting at', () => {
    const near = seatedPedestrian({ table: 0, seat: 0 });
    const far = seatedPedestrian({ table: 0, seat: 1 });
    // Seat 0 sits at +z and looks back along -z; seat 1 looks the other way.
    expect(Math.cos(near.figure.rotation.y)).toBeLessThan(0);
    expect(Math.cos(far.figure.rotation.y)).toBeGreaterThan(0);
  });

  it('stands up and walks out when its table is done', () => {
    const p = seatedPedestrian();
    const w = dineInWorld();
    p.leaveTable();
    expect(p.state).toBe('WALKING_OUT');
    expect(p.table).toBeNull();
    expect(p.figure.position.y).toBe(0);
    expect(p.figure.userData.limbs.legL.rotation.x).toBe(0);
    run(p, w, 60);
    expect(p.isDone()).toBe(true);
  });

  it('ignores leaveTable unless it is actually seated', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    p.leaveTable();
    expect(p.state).toBe('WALKING_IN');
  });
```

Add `LEG_PROPORTIONS` to the file's import from `../../src/models/figure.js` (add the import line if the file has none).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/pedestrian.test.js`
Expected: FAIL — `expected [ 'IDLE', … ] to contain 'WALKING_TO_TABLE'`, and `world.claimSeat is not a function` from the new cases.

- [ ] **Step 3: Widen the imports and the state list in `src/sim/pedestrian.js`**

Replace the paths import:

```js
import {
  walkInPath,
  walkOutPath,
  doorPosition,
  slotPosition,
  seatPosition,
  walkToSeatPath,
  walkFromSeatPath,
} from './paths.js';
```

Replace the figure import:

```js
import { createFigure, LEG_PROPORTIONS } from '../models/figure.js';
```

In `PEDESTRIAN_STATES`, directly after `'AT_COUNTER',` add:

```js
  'WALKING_TO_TABLE',
  'SEATED',
```

- [ ] **Step 4: Add the seated pose**

Beside `let slot = null;` add:

```js
  let table = null;
  let seat = null;
```

Directly after the `animateLegs` function, add:

```js
  // Sitting is the standing figure dropped so its hips meet the chair, with
  // both legs swung forward under the table. -PI/2 is forward because the
  // figure is built facing +z. The tabletop hides the legs from this camera,
  // which is why a knee joint is not worth modelling.
  function sit() {
    const spot = seatPosition(layout, table, seat);
    const centre = layout.dining.tables[table];
    place(spot.x, spot.z, Math.atan2(centre.x - spot.x, centre.z - spot.z));
    const chair = layout.dining.chair;
    figure.position.y =
      chair.seatHeight + chair.seatThickness - person.height * LEG_PROPORTIONS.hip;
    const limbs = figure.userData.limbs;
    limbs.legL.rotation.x = -Math.PI / 2;
    limbs.legR.rotation.x = -Math.PI / 2;
    limbs.armL.rotation.x = 0;
    limbs.armR.rotation.x = 0;
  }

  function stand() {
    figure.position.y = 0;
    for (const limb of Object.values(figure.userData.limbs)) limb.rotation.x = 0;
  }
```

- [ ] **Step 5: Reset the seat in `start()`**

In `start(atBay)`, directly after `slot = null;` add:

```js
      table = null;
      seat = null;
      stand();
```

- [ ] **Step 6: Make the dine-in decision once, in `WALKING_IN`**

Replace the opening of the `case 'WALKING_IN':` block — the three lines from the `// Join the line only on arrival.` comment through `follower.set(walkInPath(layout, bay, tail));` — with:

```js
        case 'WALKING_IN': {
          // The dine-in decision is made once, before any path exists, so a
          // walker is never retargeted mid-route.
          if (!follower.path) {
            const claim = world.claimSeat();
            if (claim) {
              table = claim.table;
              seat = claim.seat;
              follower.set(walkToSeatPath(layout, bay, table, seat));
              setState('WALKING_TO_TABLE');
              return;
            }
          }
          // Join the line only on arrival. Holding a slot from the car lets
          // a slow walker keep a place in front of people already queued.
          const tail = slotPosition(layout, world.queueLength());
          if (!follower.path) {
            follower.set(walkInPath(layout, bay, tail));
          } else {
```

(The rest of the case is unchanged.)

- [ ] **Step 7: Add the two new cases**

Directly after the whole `case 'AT_COUNTER': { … }` block, add:

```js
        case 'WALKING_TO_TABLE': {
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            sit();
            setState('SEATED');
          }
          return;
        }

        case 'SEATED': {
          // The pose is static until the table empties; the room decides when.
          return;
        }
```

- [ ] **Step 8: Expose the table and the way out**

In the returned `pedestrian` object, beside `get slot()`, add:

```js
    get table() {
      return table;
    },
```

and beside `reassignSlot`, add:

```js
    // Called by the simulation when this diner's table empties, whether the
    // meal finished or patience ran out.
    leaveTable() {
      if (state !== 'SEATED') return;
      stand();
      follower.set(walkFromSeatPath(layout, bay, table, seat));
      table = null;
      seat = null;
      setState('WALKING_OUT');
    },
```

- [ ] **Step 9: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green. If `tests/sim/simulation.test.js` fails with `world.claimSeat is not a function`, its fake world needs the same stub; add `claimSeat: () => null` there too.

- [ ] **Step 10: Commit (only if the user asks)**

```bash
git add src/sim/pedestrian.js tests/sim/pedestrian.test.js
git commit -m "feat: let customers walk to a table and sit down"
```

---

### Task 7: Wire the dining room into the simulation

**Files:**
- Modify: `src/sim/simulation.js`
- Test: `tests/sim/simulation.test.js`

**Interfaces:**
- Consumes: `createDiningRoom` (Task 2); `createZoneMarker`; `createPizzaBox`; `pedestrian.table` / `leaveTable()` (Task 6); `layout.dining` (Task 1); `materials.tableBanner` (Task 1).
- Produces: the simulation returns `room` and `tablePoints` alongside its existing fields; `world.claimSeat()` delegates to the room.

- [ ] **Step 1: Write the failing tests**

In `tests/sim/simulation.test.js`, append inside the top-level `describe`:

```js
  const dining = layout.dining;

  // The dine-in draw is seeded at 0.5, so ask until it says yes. Bounded, so a
  // bad seed fails loudly instead of hanging the suite.
  function seatSomeone(sim) {
    for (let i = 0; i < 100; i++) {
      const claim = sim.room.claimSeat();
      if (claim) return claim;
    }
    throw new Error('the seeded draw never offered a seat');
  }

  function standAt(sim, zone) {
    sim.player.figure.position.set(
      (zone.x[0] + zone.x[1]) / 2,
      0,
      (zone.z[0] + zone.z[1]) / 2
    );
  }

  it('builds one marker and one hidden box per table', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.tablePoints).toHaveLength(dining.tables.length);
    expect(sim.room.tables).toHaveLength(dining.tables.length);
  });

  it('pays the table price and spends one carried pizza', () => {
    const sim = createSimulation(stubMaterials(), layout);
    seatSomeone(sim);
    const index = sim.room.tables.findIndex((t) => t.state === 'WAITING');
    sim.player.receive();
    sim.player.receive();
    standAt(sim, dining.tables[index].zone);
    sim.update(1 / 60, {});
    expect(sim.balance).toBe(dining.tablePrice);
    expect(sim.player.carried).toBe(1);
    expect(sim.room.tables[index].state).toBe('EATING');
  });

  it('serves nothing while the player stands outside every zone', () => {
    const sim = createSimulation(stubMaterials(), layout);
    seatSomeone(sim);
    sim.player.receive();
    sim.player.figure.position.set(0, 0, 0);
    sim.update(1 / 60, {});
    expect(sim.balance).toBe(0);
    expect(sim.player.carried).toBe(1);
  });

  it('serves nothing with empty hands', () => {
    const sim = createSimulation(stubMaterials(), layout);
    seatSomeone(sim);
    const index = sim.room.tables.findIndex((t) => t.state === 'WAITING');
    standAt(sim, dining.tables[index].zone);
    sim.update(1 / 60, {});
    expect(sim.balance).toBe(0);
    expect(sim.room.tables[index].state).toBe('WAITING');
  });

  it('stops charging once the table is eating', () => {
    const sim = createSimulation(stubMaterials(), layout);
    seatSomeone(sim);
    sim.player.receive();
    sim.player.receive();
    const index = sim.room.tables.findIndex((t) => t.state === 'WAITING');
    standAt(sim, dining.tables[index].zone);
    sim.update(1 / 60, {});
    expect(sim.balance).toBe(dining.tablePrice);
    // Still standing in the zone, still carrying: the meal is under way, so
    // serve() refuses and nothing more is taken.
    sim.update(1 / 60, {});
    sim.update(1 / 60, {});
    expect(sim.balance).toBe(dining.tablePrice);
    expect(sim.player.carried).toBe(1);
  });

  it('shows a table banner only while that table wants a pizza', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const banner = (i) => sim.tablePoints[i].children.find((c) => c.name === 'zoneBanner');
    sim.update(1 / 60, {});
    for (let i = 0; i < sim.tablePoints.length; i++) expect(banner(i).visible).toBe(false);

    seatSomeone(sim);
    const index = sim.room.tables.findIndex((t) => t.state === 'WAITING');
    sim.update(1 / 60, {});
    expect(banner(index).visible).toBe(true);

    sim.player.receive();
    standAt(sim, dining.tables[index].zone);
    sim.update(1 / 60, {});
    expect(banner(index).visible).toBe(false);
  });

  it('sends diners home when their table empties', () => {
    // dineInChance 1 so the first customer certainly takes a seat: a test
    // that only sometimes exercises the path is a test that proves nothing.
    const always = { ...layout, dining: { ...dining, dineInChance: 1 } };
    const sim = createSimulation(stubMaterials(), always);
    const diner = sim.pedestrians[0];
    diner.start(layout.sim.bays[0]);
    for (let t = 0; t < 45; t += 1 / 60) sim.update(1 / 60, {});
    expect(diner.state).toBe('SEATED');

    const index = diner.table;
    expect(sim.room.serve(index)).toBe(true);
    for (let t = 0; t < dining.eatSeconds + 1; t += 1 / 30) sim.update(1 / 30, {});
    expect(sim.room.tables[index].state).toBe('EMPTY');
    expect(diner.state).not.toBe('SEATED');
    expect(diner.table).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/simulation.test.js`
Expected: FAIL — `expected undefined to have a length of 4` (no `tablePoints`), and `Cannot read properties of undefined (reading 'claimSeat')`.

- [ ] **Step 3: Build the room, markers and boxes in `src/sim/simulation.js`**

Add the imports beside the existing ones:

```js
import { createDiningRoom } from './dining.js';
import { createPizzaBox } from '../models/pizzaBox.js';
```

Directly after the `const ovenMouth = …` line, add:

```js
  const dining = layout.dining;
  const room = createDiningRoom(layout);
  // One box per table, parked on the tabletop and hidden until a hop lands.
  const tableBoxes = dining.tables.map((spot) => {
    const served = createPizzaBox(materials);
    served.position.set(
      spot.x,
      dining.top.height + dining.top.thickness + layout.surfaceEps,
      spot.z
    );
    served.visible = false;
    return served;
  });
```

- [ ] **Step 4: Let the world hand out seats**

Inside the `world` object, directly after `queueLength()`, add:

```js
    // Customers ask once, on their first step away from the car.
    claimSeat() {
      return room.claimSeat();
    },
```

- [ ] **Step 5: Add the markers and boxes to the group**

Directly after the existing `group.add(sellPoint, ovenPoint);` line, add:

```js
  const tablePoints = dining.tables.map((spot, i) =>
    createZoneMarker(materials, {
      name: `tablePoint-${i}`,
      zone: spot.zone,
      // At tabletop height, not on the floor. A floor outline beside a table
      // is hidden by the table itself: the sight line to this camera runs -x
      // and +z, straight under the top. Same reason the cashier's outline
      // sits above the counter.
      outlineY: dining.top.height + dining.top.thickness + layout.surfaceEps,
      bannerMaterial: materials.tableBanner,
      banner: dining.banner,
    })
  );
  group.add(...tablePoints, ...tableBoxes);
```

- [ ] **Step 6: Serve tables and send diners home**

In the returned object, add `room,` and `tablePoints,` beside `sellPoint,` and `ovenPoint,`.

In `update`, directly after the `hops.update(dt);` line, add:

```js
      // At most one table per frame, so a single step at 5x speed cannot
      // empty the whole carried stack at once.
      if (player.carried >= 1) {
        const index = dining.tables.findIndex(
          (spot, i) => room.wants(i) && inside(player.figure.position, spot.zone)
        );
        if (index >= 0 && room.serve(index)) {
          balance += dining.tablePrice;
          const from = player.stack.userData.slotPosition(
            Math.max(0, player.carried - 1),
            new THREE.Vector3()
          );
          player.handOver();
          const landing = tableBoxes[index].position.clone();
          hops.launch(from, () => landing, () => {
            tableBoxes[index].visible = true;
          });
        }
      }

      for (const index of room.update(dt)) {
        tableBoxes[index].visible = false;
        for (const pedestrian of pedestrians) {
          if (pedestrian.table === index) pedestrian.leaveTable();
        }
      }
```

Then, beside the existing marker updates at the end of `update`, add:

```js
      for (let i = 0; i < tablePoints.length; i++) {
        const wants = room.wants(i);
        tablePoints[i].userData.update(dt, { pulse: wants, showBanner: wants });
      }
```

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 8: Commit (only if the user asks)**

```bash
git add src/sim/simulation.js tests/sim/simulation.test.js
git commit -m "feat: serve pizzas to the dining tables"
```

---

### Task 8: The tables block the player

**Files:**
- Modify: `src/sim/obstacles.js`
- Test: `tests/sim/obstacles.test.js`

**Interfaces:**
- Consumes: `layout.dining` (Task 1).
- Produces: `playerObstacles(layout)` also returns one footprint per table.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('playerObstacles', ...)` in `tests/sim/obstacles.test.js`:

```js
  it('stops a walker at a dining table', () => {
    const spot = layout.dining.tables[0];
    const half = layout.dining.top.size / 2;
    const end = walk(spot.x, spot.z + 2.5, 0, -1, 2);
    expect(end.z).toBeGreaterThan(spot.z + half);
    expect(end.z).toBeLessThan(spot.z + half + 0.6);
  });

  it('leaves every delivery zone reachable', () => {
    const obstacles = playerObstacles(layout);
    for (const [i, spot] of layout.dining.tables.entries()) {
      const cx = (spot.zone.x[0] + spot.zone.x[1]) / 2;
      const cz = (spot.zone.z[0] + spot.zone.z[1]) / 2;
      expect(hitsObstacle(cx, cz, r, obstacles), `zone ${i}`).toBe(false);
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/obstacles.test.js`
Expected: FAIL on the first test — the walker passes straight through the table, so `end.z` undershoots.

- [ ] **Step 3: Add the footprints in `src/sim/obstacles.js`**

Directly before the `boxes.push(...planTown(layout).obstacles);` line, add:

```js
  // The dining tables. Chairs are left open so a player can squeeze past
  // them into a delivery zone.
  const tableHalf = layout.dining.top.size / 2;
  for (const spot of layout.dining.tables) {
    boxes.push({
      x: [spot.x - tableHalf, spot.x + tableHalf],
      z: [spot.z - tableHalf, spot.z + tableHalf],
    });
  }
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — every test file green.

- [ ] **Step 5: Commit (only if the user asks)**

```bash
git add src/sim/obstacles.js tests/sim/obstacles.test.js
git commit -m "feat: block the player with the dining tables"
```

---

### Task 9: Prove the room is visible, then look at it

**Files:**
- Test: `tests/scene.test.js`
- Modify only if the screenshot shows a problem: `src/layout.js` (the `dining` block)

**Interfaces:**
- Consumes: everything from Tasks 1–8. Produces no new code.

- [ ] **Step 1: Write the visibility test**

Append inside `describe('createShop', ...)` in `tests/scene.test.js`:

```js
  // The measurement that chose the table positions, kept as a test. This
  // camera only sees faces pointing +z or -x, and the west wall, storefront
  // plinth and sign each hide part of the dining floor.
  it('keeps every tabletop, diner, banner and delivery zone in view', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|tablePoint-|cashier|pedestrian-|pizzaHops|town)/;
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const d = layout.dining;
    const ray = new THREE.Raycaster();
    const hidden = (point) => {
      ray.set(point.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
      ray.far = 200 - 0.02;
      return ray.intersectObjects(blockers, false).length > 0;
    };

    // A hair above the slab: the height a delivered box sits at, and clear of
    // the slab's own surface so the ray cannot graze it. The zone outlines sit
    // at the same height, which is what keeps them out of their table's shadow.
    const topY = d.top.height + d.top.thickness + layout.surfaceEps;
    const outlineY = topY;
    const half = d.top.size / 2;
    for (const spot of d.tables) {
      // Tabletop corners: where a delivered box sits.
      for (const dx of [-half, half]) {
        for (const dz of [-half, half]) {
          const at = new THREE.Vector3(spot.x + dx, topY, spot.z + dz);
          expect(hidden(at), `tabletop (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`).toBe(false);
        }
      }
      // A seated diner's head at each chair.
      for (const side of [-1, 1]) {
        const at = new THREE.Vector3(spot.x, 1.22, spot.z + side * d.chair.offset);
        expect(hidden(at), `diner at (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`).toBe(false);
      }
      // The banner.
      expect(hidden(new THREE.Vector3(spot.x, d.banner.y, spot.z)), 'banner').toBe(false);
      // Every corner of the delivery zone's dashed outline.
      for (const zx of spot.zone.x) {
        for (const zz of spot.zone.z) {
          const at = new THREE.Vector3(zx, outlineY, zz);
          expect(hidden(at), `zone corner (${zx.toFixed(2)}, ${zz.toFixed(2)})`).toBe(false);
        }
      }
    }
  });
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/scene.test.js`
Expected: PASS. If a point is reported hidden, name the blocking mesh in your report rather than moving the table: the positions are measured, and a hidden point means the room's furniture is blocking itself.

- [ ] **Step 3: Run the whole suite and build**

Run: `npx vitest run && npm run build`
Expected: every test green, and Vite builds with no errors (the existing chunk-size warning for the three.js bundle is expected).

- [ ] **Step 4: Look at the dining room in the running game**

Start the dev server in the background: `npx vite --port 5199 --strictPort`, and wait until `curl -sf http://localhost:5199 >/dev/null` succeeds.

The dining room is at the top-left of the default view. Capture it:

```bash
SHOTS=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --user-data-dir="$SHOTS/dine-profile" --no-first-run --hide-scrollbars \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=2 \
  --window-size=1800,1100 --virtual-time-budget=8000 \
  --screenshot="$SHOTS/scene.png" http://localhost:5199/
```

Headless Chrome never exits while a render loop runs: start it in the background, poll for the file, then `pkill -9 -f '[u]ser-data-dir=.*dine-profile'`. macOS has no `timeout`.

Crop the dining wing and open it with your file-reading tool:

```bash
sips --cropToHeightWidth 900 1200 --cropOffset 700 250 "$SHOTS/scene.png" --out "$SHOTS/dining.png"
```

Confirm:

1. Four tables with two chairs each stand on the plank floor, none clipping a wall.
2. The tabletops and chairs are not hidden behind the storefront or the west wall.
3. Nothing floats above the floor or sinks into it.
4. The room still reads as part of the shop — the tables do not hide the counter or the oven.

Diners and banners only appear once customers arrive, which a still cannot guarantee; leave those to the user.

- [ ] **Step 5: Stop the server**

```bash
pkill -9 -f '[u]ser-data-dir=.*dine-profile'
lsof -ti:5199 -sTCP:LISTEN | xargs kill
```

- [ ] **Step 6: Hand the moving parts to the user**

Report that the behaviour needs a look in their browser: run `npm run dev`, wait for cars to arrive, and check that customers walk in and sit, that a waiting table pulses its dashed zone and shows its banner, that standing in the zone with a pizza delivers one and pays $8, and that diners leave about forty seconds later.

- [ ] **Step 7: Commit any tuning (only if the user asks)**

```bash
git add src/layout.js
git commit -m "fix: tune the dining room after checking it in the game"
```

Skip this step if nothing needed changing.

---

## Verification

```bash
npx vitest run && npm run build
```

Expected: every test passes and Vite builds with no errors.
