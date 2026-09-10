# Parking Lot and Four-Lane Road Implementation Plan (Part A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the painted-on-road parking with a real eight-bay lot in front of the shop, split from a newly four-laned road by a kerbed planting island.

**Architecture:** All geometry moves into a new `layout.parking` block and a reshaped `layout.ground`; a new `building/parking.js` draws the lot, bay lines and island, while `building/ground.js` is reworked for the four-lane road. `sim/paths.js` gains entrance/aisle/bay routing so the three existing cars use the lot. No simulation behaviour changes.

**Tech Stack:** three, vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-10-parking-lot-and-road-design.md`

## Global Constraints

- Nothing outside `layout.js` hard-codes a coordinate.
- Every mesh sets `castShadow`/`receiveShadow`; every group sets `.name`.
- Bands, verbatim from the spec: sidewalk `8→10.5`, kerb `10.5→10.9`, Row A `11.0→15.6`, aisle `15.6→19.4`, Row B `19.4→24.0`, island `24.0→26.5`, road `26.5→40.5`, far kerb `40.5→40.9`, paving `40.9→46`.
- Bay `x` centres `-3.9, -1.3, 1.3, 3.9`; Row A car centre `z = 13.3` facing `-Z`; Row B car centre `z = 21.7` facing `+Z`.
- Lot surface spans `x = -8.5 → 8.5`. Island gaps: entrance `x 5.0→8.5` (centre `6.75`), exit `x -8.5→-5.0` (centre `-6.75`).
- Lane centres `z = 28.25, 31.75` heading `-X`; `35.25, 38.75` heading `+X`. Dashed dividers at `z = 30.0` and `37.0`; solid double centre at `z = 33.5`.
- Pedestrian walkway at `x = 0` — a bay boundary, so never occupied.
- Camera: `frustumSize: 34`, `target: [0, 1.2, 13]`.
- Part B is out of scope: no extra traffic, no bus or van, no car-following, no honking.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/layout.js` | New `layout.parking`; `ground` and `camera` reshaped |
| `src/materials.js` | Gains `planting` and `laneCentre` |
| `src/building/parking.js` | Lot surface, bay lines, kerbed planting island |
| `src/building/ground.js` | Sidewalk, four-lane road, lane markings, kerbs |
| `src/sim/paths.js` | Entrance/aisle/bay routing; two walking route shapes |
| `src/scene.js` | Adds the `parking` group |

---

### Task 1: Layout and materials

**Files:**
- Modify: `src/layout.js`, `src/materials.js`
- Test: `tests/layout.test.js`

**Interfaces:**
- Produces: `layout.parking` as shown in Step 3; `layout.ground` reshaped with `lot`, `island`, `lanes`, `laneMarks`; `layout.camera` at `frustumSize: 34`, `target: [0, 1.2, 13]`; `layout.envelopes.parking`. `MATERIAL_KEYS` gains `planting` and `laneCentre`. `layout.sim.bays` becomes an array of `{ x, z, facing }` bay descriptors and `layout.sim.bayZ` is removed.

- [ ] **Step 1: Write the failing test**

Append to `tests/layout.test.js`:

```js
describe('layout.parking', () => {
  const P = layout.parking;

  it('lays eight bays in two rows of four', () => {
    expect(P.bayX).toHaveLength(4);
    expect(P.rows).toHaveLength(2);
    expect(layout.sim.bays).toHaveLength(8);
  });

  it('keeps every bay inside the lot surface', () => {
    const half = P.baySpacing / 2;
    for (const bay of layout.sim.bays) {
      expect(bay.x - half).toBeGreaterThanOrEqual(P.lot.x[0]);
      expect(bay.x + half).toBeLessThanOrEqual(P.lot.x[1]);
      expect(bay.z).toBeGreaterThan(P.lot.z[0]);
      expect(bay.z).toBeLessThan(P.lot.z[1]);
    }
  });

  it('separates the two rows with the aisle, overlapping neither', () => {
    const [rowA, rowB] = P.rows;
    expect(rowA.z[1]).toBeLessThanOrEqual(P.aisle.z[0]);
    expect(rowB.z[0]).toBeGreaterThanOrEqual(P.aisle.z[1]);
  });

  it('faces the two rows in opposite directions', () => {
    const [rowA, rowB] = P.rows;
    expect(rowA.facing).toBeCloseTo(Math.PI, 5);
    expect(rowB.facing).toBeCloseTo(0, 5);
  });

  it('gives every bay room for a car', () => {
    const [rowA] = P.rows;
    expect(P.baySpacing).toBeGreaterThan(layout.sim.car.width);
    expect(rowA.z[1] - rowA.z[0]).toBeGreaterThan(layout.sim.car.length);
  });

  it('makes both island gaps wider than a car', () => {
    for (const gap of [P.entrance, P.exit]) {
      expect(gap.x[1] - gap.x[0]).toBeGreaterThan(layout.sim.car.width);
    }
  });

  it('puts the entrance and exit gaps on opposite sides', () => {
    expect(P.entrance.centreX).toBeGreaterThan(0);
    expect(P.exit.centreX).toBeLessThan(0);
  });

  it('keeps the walkway off every bay', () => {
    const half = P.baySpacing / 2;
    for (const bay of layout.sim.bays) {
      expect(Math.abs(P.walkwayX - bay.x)).toBeGreaterThanOrEqual(half - 1e-9);
    }
  });

  it('keeps the walkway clear of the entrance driving path', () => {
    const halfCar = layout.sim.car.width / 2;
    expect(Math.abs(P.walkwayX - P.entrance.centreX)).toBeGreaterThan(halfCar + 0.5);
  });

  it('spaces four lanes evenly inside the road band', () => {
    const lanes = layout.ground.lanes;
    expect(lanes).toHaveLength(4);
    for (const lane of lanes) {
      expect(lane.z).toBeGreaterThan(layout.ground.road.z[0]);
      expect(lane.z).toBeLessThan(layout.ground.road.z[1]);
    }
    const gaps = lanes.slice(1).map((l, i) => l.z - lanes[i].z);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 5);
  });

  it('runs the two inner lanes toward -X and the outer two toward +X', () => {
    const dirs = layout.ground.lanes.map((l) => l.direction);
    expect(dirs).toEqual([-1, -1, 1, 1]);
  });

  it('leaves the island between the lot and the road', () => {
    expect(layout.parking.island.z[0]).toBeGreaterThanOrEqual(layout.parking.lot.z[1]);
    expect(layout.parking.island.z[1]).toBeLessThanOrEqual(layout.ground.road.z[0]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/layout.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'bayX')`.

- [ ] **Step 3: Reshape `layout.ground` and add `layout.parking`**

Replace the whole `ground:` block in `src/layout.js` with:

```js
  ground: {
    // A base apron sits under everything so no gap of sky shows around the lot.
    apron: { x: [-40, 40], z: [-16, 46], y: -0.2 },
    road: { x: [-40, 40], z: [26.5, 40.5], y: -0.15 },
    kerbs: [
      // Sidewalk down to the parking lot.
      { x: [-40, 40], z: [10.5, 10.9], y: [-0.15, 0] },
      // Far side of the road.
      { x: [-40, 40], z: [40.5, 40.9], y: [-0.15, 0] },
    ],
    sidewalk: [
      { x: [-40, 40], z: [8, 10.5] },
      { x: [-24, -11], z: [-8, 8] },
      { x: [-40, 40], z: [40.9, 46] },
      // Paving either side of the parking lot.
      { x: [-40, -8.5], z: [10.9, 26.5] },
      { x: [8.5, 40], z: [10.9, 26.5] },
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
    floorY: { terracotta: 0.02, paving: 0.0, asphalt: -0.15 },
    lanes: [
      { z: 28.25, direction: -1 },
      { z: 31.75, direction: -1 },
      { z: 35.25, direction: 1 },
      { z: 38.75, direction: 1 },
    ],
    laneMarks: {
      dashed: [30.0, 37.0],
      centre: 33.5,
      centreGap: 0.22,
      width: 0.14,
      dash: 2.2,
      gap: 1.8,
      x: [-40, 40],
    },
  },

  // Two rows of four bays either side of a drive aisle, fenced off from the
  // road by a kerbed planting island with an entrance and an exit gap.
  parking: {
    lot: { x: [-8.5, 8.5], z: [10.9, 24.0] },
    bayX: [-3.9, -1.3, 1.3, 3.9],
    baySpacing: 2.6,
    rows: [
      { z: [11.0, 15.6], carZ: 13.3, facing: Math.PI },
      { z: [19.4, 24.0], carZ: 21.7, facing: 0 },
    ],
    aisle: { z: [15.6, 19.4], centreZ: 17.5 },
    island: { z: [24.0, 26.5], kerbHeight: 0.18, bedInset: 0.35 },
    entrance: { x: [5.0, 8.5], centreX: 6.75 },
    exit: { x: [-8.5, -5.0], centreX: -6.75 },
    segments: [
      { x: [-40, -8.5] },
      { x: [-5.0, 5.0] },
      { x: [8.5, 40] },
    ],
    walkwayX: 0,
    lineWidth: 0.12,
    sidewalkZ: 10.2,
  },
```

In `layout.sim`, replace `bays` and `bayZ` with bay descriptors and update the lane reference:

```js
    lane: { z: 28.25, enterX: 45, exitX: -45 },
    bays: [
      { x: -3.9, z: 13.3, facing: Math.PI, row: 0 },
      { x: -1.3, z: 13.3, facing: Math.PI, row: 0 },
      { x: 1.3, z: 13.3, facing: Math.PI, row: 0 },
      { x: 3.9, z: 13.3, facing: Math.PI, row: 0 },
      { x: -3.9, z: 21.7, facing: 0, row: 1 },
      { x: -1.3, z: 21.7, facing: 0, row: 1 },
      { x: 1.3, z: 21.7, facing: 0, row: 1 },
      { x: 3.9, z: 21.7, facing: 0, row: 1 },
    ],
```

Update `layout.sim.walk` to the new bands:

```js
    walk: { doorOffset: 1.1, sidewalkZ: 10.2, plazaZ: 8.6 },
```

Set the camera:

```js
  camera: {
    frustumSize: 34,
    direction: [1, 0.82, 1],
    distance: 60,
    target: [0, 1.2, 13],
  },
```

And in `layout.envelopes`, widen `ground` and `simulation` and add `parking`:

```js
    ground: { min: [-40, -0.25, -16], max: [40, 0.1, 46] },
    parking: { min: [-40, -0.2, 10.5], max: [40, 0.6, 26.6] },
    simulation: { min: [-46, 0, 4], max: [46, 2.2, 42] },
```

- [ ] **Step 4: Add the two materials**

In `src/materials.js`, append to `MATERIAL_KEYS`:

```js
  'planting',
  'laneCentre',
```

And add to the `materials` object:

```js
    planting: standard('planting', { color: 0x5c7f4a, roughness: 0.92, metalness: 0.0 }),
    laneCentre: standard('laneCentre', { color: 0xe8d14a, roughness: 0.8, metalness: 0.0 }),
```

- [ ] **Step 5: Update the two existing tests that assume numeric bays**

`tests/layout.test.js` already contains two assertions written when
`layout.sim.bays` was a list of `x` numbers and `layout.sim.bayZ` existed.
Both break now. Replace them:

```js
  it('keeps parked cars clear of the kerb and the travel lane', () => {
    const half = layout.sim.car.length / 2;
    for (const row of layout.parking.rows) {
      expect(row.carZ - half).toBeGreaterThan(layout.parking.lot.z[0]);
      expect(row.carZ + half).toBeLessThan(layout.parking.island.z[0]);
    }
  });

  it('puts every parking bay inside the lot, not on the road', () => {
    for (const bay of layout.sim.bays) {
      expect(bay.z).toBeLessThan(layout.ground.road.z[0]);
      expect(bay.z).toBeGreaterThan(layout.parking.lot.z[0]);
    }
  });
```

- [ ] **Step 6: Run the layout tests**

Run: `npx vitest run tests/layout.test.js tests/materials.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/layout.js src/materials.js tests/layout.test.js
git commit -m "feat: add parking lot geometry and four-lane road layout"
```

---

### Task 2: Rework the ground for four lanes

**Files:**
- Modify: `src/building/ground.js`, `tests/building/ground.test.js`

**Interfaces:**
- Consumes: `layout.ground.lanes`, `layout.ground.laneMarks`, `layout.ground.kerbs`.
- Produces: `createGround(materials, layout) -> THREE.Group` named `'ground'`, unchanged signature, now drawing two kerbs, five paving rects, a four-lane road, dashed dividers at both `laneMarks.dashed` positions, and a solid double centre line.

- [ ] **Step 1: Rewrite the failing test**

Replace `tests/building/ground.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGround } from '../../src/building/ground.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createGround(stubMaterials(), layout);
const named = (name) => group.children.filter((c) => c.material && c.material.name === name);

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

  it('builds a kerb for every declared kerb band', () => {
    expect(named('stone').length).toBeGreaterThanOrEqual(layout.ground.kerbs.length);
  });

  it('marks both dashed lane dividers', () => {
    const marks = named('roadPaint');
    for (const z of layout.ground.laneMarks.dashed) {
      const onThisLine = marks.filter((m) => Math.abs(m.position.z - (z + layout.ground.laneMarks.width / 2)) < 0.3);
      expect(onThisLine.length, `dashes at z=${z}`).toBeGreaterThan(4);
    }
  });

  it('draws a solid double centre line', () => {
    const centre = named('laneCentre');
    expect(centre).toHaveLength(2);
    const zs = centre.map((c) => c.position.z).sort((a, b) => a - b);
    expect(zs[1] - zs[0]).toBeCloseTo(layout.ground.laneMarks.centreGap, 2);
  });

  it('lays the road below the paving so the kerb reads as a step', () => {
    expect(layout.ground.road.y).toBeLessThan(layout.ground.floorY.paving);
  });

  it('paves either side of the parking lot so no gap shows', () => {
    const sides = layout.ground.sidewalk.filter((r) => r.z[0] === 10.9);
    expect(sides).toHaveLength(2);
    expect(sides[0].x[1]).toBeCloseTo(layout.parking.lot.x[0], 5);
    expect(sides[1].x[0]).toBeCloseTo(layout.parking.lot.x[1], 5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/building/ground.test.js`
Expected: FAIL — `layout.ground.kerbs` is undefined until Task 1 lands, and no `laneCentre` meshes exist.

- [ ] **Step 3: Rewrite `src/building/ground.js`**

```js
import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

// Lays a dashed line of paint along x at a given z.
function dashedLine(group, materials, { x, z, width, dash, gap, y }) {
  for (let cursor = x[0]; cursor < x[1]; cursor += dash + gap) {
    group.add(
      slab(materials.roadPaint, {
        x: [cursor, Math.min(cursor + dash, x[1])],
        z: [z, z + width],
        y,
      })
    );
  }
}

export function createGround(materials, layout) {
  const group = new THREE.Group();
  group.name = 'ground';
  const g = layout.ground;

  group.add(slab(materials.paving, { x: g.apron.x, z: g.apron.z, y: g.apron.y }));
  group.add(slab(materials.asphalt, { x: g.road.x, z: g.road.z, y: g.road.y }));

  for (const kerb of g.kerbs) {
    group.add(box(materials.stone, { x: kerb.x, y: kerb.y, z: kerb.z }));
  }
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
    slab(materials.wood, { x: g.diningFloor.x, z: g.diningFloor.z, y: g.diningFloor.y })
  );

  const marks = g.laneMarks;
  const paintY = g.road.y + 0.01;

  for (const z of marks.dashed) {
    dashedLine(group, materials, {
      x: marks.x,
      z,
      width: marks.width,
      dash: marks.dash,
      gap: marks.gap,
      y: paintY,
    });
  }

  // Solid double centre line, one stripe either side of the centre.
  for (const offset of [-marks.centreGap / 2, marks.centreGap / 2]) {
    group.add(
      slab(materials.laneCentre, {
        x: marks.x,
        z: [marks.centre + offset, marks.centre + offset + marks.width],
        y: paintY,
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/building/ground.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/building/ground.js tests/building/ground.test.js
git commit -m "feat: remark the road as four lanes with a double centre line"
```

---

### Task 3: The parking lot

**Files:**
- Create: `src/building/parking.js`
- Modify: `src/scene.js`, `tests/scene.test.js`
- Test: `tests/building/parking.test.js`

**Interfaces:**
- Consumes: `box`, `slab` from `src/utils/geometry.js`; `layout.parking`.
- Produces: `createParking(materials, layout) -> THREE.Group` named `'parking'`. Added to the shop between `ground` and `perimeter`, so the child order becomes `ground, parking, perimeter, diningWing, storefront, kitchen, oven, counter, sideWing, queue, simulation, lighting`.

- [ ] **Step 1: Write the failing test**

Create `tests/building/parking.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createParking } from '../../src/building/parking.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createParking(stubMaterials(), layout);
const named = (name) => group.children.filter((c) => c.material && c.material.name === name);

describe('createParking', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('parking');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.parking);
  });

  it('draws five divider lines per row, ten in all', () => {
    expect(named('roadPaint')).toHaveLength((layout.parking.bayX.length + 1) * 2);
  });

  it('builds one kerb and one planting bed per island segment', () => {
    expect(named('stone')).toHaveLength(layout.parking.segments.length);
    expect(named('planting')).toHaveLength(layout.parking.segments.length);
  });

  it('leaves both island gaps unbuilt', () => {
    const { entrance, exit } = layout.parking;
    for (const kerb of named('stone')) {
      const half = kerb.geometry.parameters.width / 2;
      const span = [kerb.position.x - half, kerb.position.x + half];
      for (const gap of [entrance, exit]) {
        const overlaps = span[0] < gap.x[1] && gap.x[0] < span[1];
        expect(overlaps, `kerb ${span} covers gap ${gap.x}`).toBe(false);
      }
    }
  });

  it('surfaces the lot at road level, below the paving', () => {
    const asphalt = named('asphalt');
    expect(asphalt.length).toBeGreaterThan(0);
    expect(asphalt[0].position.y).toBeCloseTo(layout.ground.floorY.asphalt, 5);
  });

  it('paves the two island gaps so cars drive on asphalt', () => {
    const asphalt = named('asphalt');
    const covers = (gap) =>
      asphalt.some((mesh) => {
        const half = mesh.geometry.parameters.width / 2;
        return mesh.position.x - half <= gap.x[0] + 1e-6 && mesh.position.x + half >= gap.x[1] - 1e-6;
      });
    expect(covers(layout.parking.entrance)).toBe(true);
    expect(covers(layout.parking.exit)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/building/parking.test.js`
Expected: FAIL — `Cannot find module '../../src/building/parking.js'`.

- [ ] **Step 3: Write `src/building/parking.js`**

```js
import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

export function createParking(materials, layout) {
  const group = new THREE.Group();
  group.name = 'parking';
  const P = layout.parking;
  const asphaltY = layout.ground.floorY.asphalt;

  // The lot surface, plus a strip through each island gap so cars entering
  // and leaving stay on asphalt rather than crossing paving.
  group.add(slab(materials.asphalt, { x: P.lot.x, z: P.lot.z, y: asphaltY }));
  for (const gap of [P.entrance, P.exit]) {
    group.add(slab(materials.asphalt, { x: gap.x, z: P.island.z, y: asphaltY }));
  }

  // Bay dividers: one line per boundary, five per row of four bays.
  const half = P.baySpacing / 2;
  const edges = [
    P.bayX[0] - half,
    ...P.bayX.map((x) => x + half),
  ];
  for (const row of P.rows) {
    for (const edge of edges) {
      group.add(
        slab(materials.roadPaint, {
          x: [edge - P.lineWidth / 2, edge + P.lineWidth / 2],
          z: row.z,
          y: asphaltY + 0.01,
        })
      );
    }
  }

  // Kerbed planting island, broken by the entrance and exit gaps.
  const inset = P.island.bedInset;
  for (const segment of P.segments) {
    group.add(
      box(materials.stone, {
        x: segment.x,
        y: [asphaltY, asphaltY + P.island.kerbHeight],
        z: P.island.z,
      })
    );
    group.add(
      slab(materials.planting, {
        x: [segment.x[0] + inset, segment.x[1] - inset],
        z: [P.island.z[0] + inset, P.island.z[1] - inset],
        y: asphaltY + P.island.kerbHeight + 0.01,
      })
    );
  }

  return group;
}
```

- [ ] **Step 4: Add it to the scene**

In `tests/scene.test.js`, change the expected child order to put `'parking'` after `'ground'`.

In `src/scene.js`, add the import:

```js
import { createParking } from './building/parking.js';
```

build it next to the others:

```js
  const parking = createParking(materials, layout);
```

and place it in the add call:

```js
  shop.add(
    ground, parking, perimeter, diningWing, storefront, kitchen, oven,
    counter, sideWing, queue, simulation.group, lighting
  );
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/building/parking.test.js tests/scene.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/building/parking.js src/scene.js tests/building/parking.test.js tests/scene.test.js
git commit -m "feat: build the parking lot, bay lines and kerbed island"
```

---

### Task 4: Route the cars through the lot

**Files:**
- Modify: `src/sim/paths.js`, `src/sim/customer.js`, `tests/sim/paths.test.js`

**Interfaces:**
- Consumes: `layout.parking`, `layout.sim.lane`, `layout.sim.bays` (now `{x, z, facing, row}` descriptors).
- Produces, from `src/sim/paths.js`: `arrivalPath(layout, bay)`, `departurePath(layout, bay)`, `walkInPath(layout, bay, slot)`, `walkOutPath(layout, bay, slot)`, `doorPosition(layout, bay)`, `pathLength(points)`. Every one now takes a **bay descriptor object**, not a bay `x`. `src/sim/customer.js` changes only where it reads `bay` — `doorPosition(layout, bay)` and `layout.queue.slots[slot]` are unchanged in shape.

- [ ] **Step 1: Rewrite the failing test**

Replace `tests/sim/paths.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import {
  arrivalPath,
  departurePath,
  walkInPath,
  walkOutPath,
  doorPosition,
  pathLength,
} from '../../src/sim/paths.js';
import { layout } from '../../src/layout.js';

const rowA = layout.sim.bays.find((b) => b.row === 0);
const rowB = layout.sim.bays.find((b) => b.row === 1);
const slot = layout.queue.slots[0];

function onDrivable(point) {
  const P = layout.parking;
  const inLot =
    point.x >= P.lot.x[0] && point.x <= P.lot.x[1] &&
    point.z >= P.lot.z[0] && point.z <= P.lot.z[1];
  const inGap = [P.entrance, P.exit].some(
    (g) => point.x >= g.x[0] && point.x <= g.x[1] &&
           point.z >= P.island.z[0] && point.z <= P.island.z[1]
  );
  const onRoad =
    point.z >= layout.ground.road.z[0] && point.z <= layout.ground.road.z[1];
  return inLot || inGap || onRoad;
}

function inSomeBay(point) {
  const P = layout.parking;
  const half = P.baySpacing / 2;
  return layout.sim.bays.some((bay) => {
    const row = P.rows[bay.row];
    return (
      Math.abs(point.x - bay.x) < half - 1e-9 &&
      point.z > row.z[0] && point.z < row.z[1]
    );
  });
}

describe('paths', () => {
  it('enters from the road and stops in the bay', () => {
    const path = arrivalPath(layout, rowA);
    expect(path[0].x).toBe(layout.sim.lane.enterX);
    expect(path[0].z).toBeCloseTo(layout.sim.lane.z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(rowA.x, 5);
    expect(last.z).toBeCloseTo(rowA.z, 5);
  });

  it('turns in through the entrance gap, never the exit', () => {
    for (const bay of layout.sim.bays) {
      const xs = arrivalPath(layout, bay).map((p) => p.x);
      expect(xs).toContain(layout.parking.entrance.centreX);
      expect(xs).not.toContain(layout.parking.exit.centreX);
    }
  });

  it('backs out of the bay and leaves through the exit gap', () => {
    const path = departurePath(layout, rowA);
    expect(path[0].z).toBeCloseTo(rowA.z, 5);
    expect(path[1].reverse).toBe(true);
    expect(path.some((p) => Math.abs(p.x - layout.parking.exit.centreX) < 1e-9)).toBe(true);
    expect(path[path.length - 1].x).toBe(layout.sim.lane.exitX);
  });

  it('keeps every driving waypoint on the lot, a gap, or the road', () => {
    for (const bay of layout.sim.bays) {
      for (const point of [...arrivalPath(layout, bay), ...departurePath(layout, bay)]) {
        expect(onDrivable(point), `(${point.x}, ${point.z})`).toBe(true);
      }
    }
  });

  it('walks row A straight out the front of its bay', () => {
    const path = walkInPath(layout, rowA, slot);
    expect(path).toHaveLength(4);
    expect(path[1].z).toBeCloseTo(layout.sim.walk.sidewalkZ, 5);
  });

  it('walks row B along the aisle and down the walkway', () => {
    const path = walkInPath(layout, rowB, slot);
    expect(path.some((p) => p.x === layout.parking.walkwayX)).toBe(true);
    expect(path.some((p) => p.z === layout.parking.aisle.centreZ)).toBe(true);
  });

  it('never routes a pedestrian through a bay they do not own', () => {
    for (const bay of layout.sim.bays) {
      const path = walkInPath(layout, bay, slot);
      for (const point of path.slice(1)) {
        if (!inSomeBay(point)) continue;
        expect(Math.abs(point.x - bay.x), `(${point.x}, ${point.z})`)
          .toBeLessThan(layout.parking.baySpacing / 2);
      }
    }
  });

  it('walks back out along the reverse of the way in', () => {
    const inward = walkInPath(layout, rowB, slot);
    const outward = walkOutPath(layout, rowB, slot);
    expect(outward.map((p) => [p.x, p.z])).toEqual(inward.map((p) => [p.x, p.z]).reverse());
  });

  it('puts the door beside the car, inside its own bay', () => {
    for (const bay of layout.sim.bays) {
      const door = doorPosition(layout, bay);
      expect(Math.abs(door.x - bay.x)).toBeGreaterThan(layout.sim.car.width / 2);
      expect(Math.abs(door.x - bay.x)).toBeLessThan(layout.parking.baySpacing / 2);
    }
  });

  it('gives every path a positive length', () => {
    for (const bay of layout.sim.bays) {
      expect(pathLength(arrivalPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(departurePath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(walkInPath(layout, bay, slot))).toBeGreaterThan(0);
    }
  });

  it('measures length as the sum of its segments', () => {
    expect(pathLength([{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 8 }])).toBeCloseTo(9, 6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/paths.test.js`
Expected: FAIL — the builders still take a bay `x` number, so `rowA.x` reads as `undefined`.

- [ ] **Step 3: Rewrite `src/sim/paths.js`**

```js
// Every waypoint is derived from layout; nothing is hard-coded. Points are
// plain {x, z} so the simulation can interpolate them without allocating
// vectors, and a `reverse` flag marks segments the car backs along.
//
// `bay` is always a descriptor from layout.sim.bays: { x, z, facing, row }.

export function doorPosition(layout, bay) {
  return { x: bay.x + layout.sim.walk.doorOffset, z: bay.z };
}

export function arrivalPath(layout, bay) {
  const { lane } = layout.sim;
  const P = layout.parking;
  return [
    { x: lane.enterX, z: lane.z },
    { x: P.entrance.centreX, z: lane.z },
    { x: P.entrance.centreX, z: P.aisle.centreZ },
    { x: bay.x, z: P.aisle.centreZ },
    { x: bay.x, z: bay.z },
  ];
}

export function departurePath(layout, bay) {
  const { lane } = layout.sim;
  const P = layout.parking;
  return [
    { x: bay.x, z: bay.z },
    { x: bay.x, z: P.aisle.centreZ, reverse: true },
    { x: P.exit.centreX, z: P.aisle.centreZ },
    { x: P.exit.centreX, z: lane.z },
    { x: lane.exitX, z: lane.z },
  ];
}

export function walkInPath(layout, bay, slot) {
  const { walk } = layout.sim;
  const P = layout.parking;
  const door = doorPosition(layout, bay);

  // Row 0 noses toward the shop, so its occupant walks straight out the
  // front. Row 0 aside, everyone routes along the aisle to the walkway at
  // x = 0 — a bay boundary, so it is never blocked by a parked car.
  if (bay.row === 0) {
    return [
      door,
      { x: door.x, z: walk.sidewalkZ },
      { x: slot[0], z: walk.plazaZ },
      { x: slot[0], z: slot[1] },
    ];
  }

  return [
    door,
    { x: door.x, z: P.aisle.centreZ },
    { x: P.walkwayX, z: P.aisle.centreZ },
    { x: P.walkwayX, z: walk.sidewalkZ },
    { x: slot[0], z: walk.plazaZ },
    { x: slot[0], z: slot[1] },
  ];
}

export function walkOutPath(layout, bay, slot) {
  return [...walkInPath(layout, bay, slot)].reverse();
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}
```

- [ ] **Step 4: Settle the parked car square in its bay**

`src/sim/customer.js` needs exactly one change. The heading easing added for
the turn-in may not have finished by the time the follower reaches the last
waypoint, leaving the car parked at a slight angle. In the `PARKING` case,
after the two existing `const` lines:

```js
          const target = layout.queue.slots[slot];
          const door = doorPosition(layout, bay);
```

add:

```js
          // The turn-in easing may not have finished; square the car up.
          car.rotation.y = bay.facing;
```

Nothing else in `customer.js` changes: it already passes `bay` straight
through to the path builders, and those now take the descriptor.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit**

```bash
git add src/sim/paths.js src/sim/customer.js tests/sim/paths.test.js
git commit -m "feat: route cars through the lot entrance, aisle and bays"
```

---

### Task 5: Visual verification

**Files:**
- Modify: `src/layout.js` only if the camera needs adjusting

- [ ] **Step 1: Run the full suite and build**

Run: `npm test && npm run build`
Expected: every test passes; `dist/` builds clean.

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev`

Over about a minute, confirm:

1. The shop and all four road lanes are visible at once, with the shop upper-right and the road lower-left.
2. The parking lot reads as its own asphalt area, separate from the road.
3. Eight bays are marked, four either side of the aisle.
4. The kerbed planting island runs between lot and road, broken by exactly two gaps.
5. Dashed dividers separate lanes 0/1 and 2/3; a solid double yellow line runs down the middle.
6. Cars arrive along the kerb lane, turn in through the right-hand gap, run the aisle, and nose into a bay square with its markings.
7. Customers walk from the car to the counter without crossing a parked car.
8. Cars back out into the aisle, leave through the left-hand gap, and rejoin the road.

If the framing is wrong, adjust `layout.camera.frustumSize` and `target` and re-check. If any other step fails, fix the responsible module and re-run its test file.

- [ ] **Step 3: Commit any camera adjustment**

```bash
git add src/layout.js
git commit -m "fix: tune camera framing for the parking lot and road"
```

---

## Verification

```bash
npm test && npm run build
```

Expected: every test passes and `dist/` builds clean.
