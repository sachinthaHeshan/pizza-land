# Customer Cycle Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three customers continuously arrive by car, park, queue at the counter, collect a pizza, walk back and drive away.

**Architecture:** Each customer is a waypoint-driven state machine owning a car, a figure and a carried box. `simulation.js` advances every agent by `dt` each frame. Scarce shared things — parking bays and queue slots — come from a pool so no two agents claim one. The whole simulation is pure state and transforms, so it steps deterministically in tests with no WebGL.

**Tech Stack:** three, vite, vitest. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-10-customer-cycle-simulation-design.md`

## Global Constraints

- Nothing in `src/sim/` hard-codes a coordinate. Every value comes from `layout`.
- `src/utils/` holds geometry helpers only; model factories live in `src/models/`.
- Every mesh sets `castShadow` and `receiveShadow`; every group sets `.name`.
- Simulation modules must not import `three` for anything but `Vector3`, `Group` and `MathUtils` — no renderer, no loader.
- Customers are hidden, never disposed. The same three agents are reused for the life of the page.
- Timing, verbatim from the spec: 3 customers, spawn gap 9.0 s, car speed 7.5 units/s, walk speed 1.35 units/s, serve dwell 2.5 s, board dwell 0.8 s.
- Bays centred at `x = -11.7, -6.5, -1.3`; bay stop `z = 16.5`; travel lane `z = 20.5`; enter `x = 40`; exit `x = -40`.
- Queue slots front to back: `(1.2, 5.1) (0.5, 5.9) (-0.1, 6.5) (-0.7, 7.1) (-1.3, 7.7)`.
- Car is 4.2 long, 1.8 wide, so a parked car spans `z 14.4 -> 18.6`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/models/figure.js` | Moved from `src/utils/`; gains limb pivots for the walk cycle |
| `src/models/car.js` | Low-poly hatchback, body colour chosen per agent |
| `src/models/pizzaBox.js` | Small carried box |
| `src/sim/pool.js` | Generic acquire/release for bays and queue slots |
| `src/sim/paths.js` | Waypoint builders derived from `layout` |
| `src/sim/customer.js` | One agent: state machine, movement, limb swing |
| `src/sim/simulation.js` | Owns the agents, staggers spawns, advances everyone |
| `src/building/queue.js` | Rope barrier + static cashier; no queued people |
| `src/layout.js` | Gains `layout.sim`; `layout.queue.people` removed |
| `src/materials.js` | Gains 8 flat-colour keys |
| `src/scene.js` | Attaches the simulation to `shop.userData.simulation` |
| `src/main.js` | Calls `simulation.update(delta)` in the render loop |

---

### Task 1: Move figure.js and add limb pivots

**Files:**
- Create: `src/models/figure.js` (moved from `src/utils/figure.js`)
- Delete: `src/utils/figure.js`
- Modify: `src/building/queue.js` (import path), `tests/utils/figure.test.js` -> `tests/models/figure.test.js`
- Test: `tests/models/figure.test.js`

**Interfaces:**
- Consumes: `box` from `src/utils/geometry.js`.
- Produces: `createFigure(materials, spec) -> THREE.Group` from `src/models/figure.js`, unchanged signature, plus `group.userData.limbs = { legL, legR, armL, armR }` where each value is a `THREE.Group` pivot. Rotating a pivot on X swings that limb about the hip or shoulder.

- [ ] **Step 1: Move the file and its test**

```bash
mkdir -p src/models tests/models
git mv src/utils/figure.js src/models/figure.js
git mv tests/utils/figure.test.js tests/models/figure.test.js
rmdir tests/utils
```

Update the import in `tests/models/figure.test.js` to `../../src/models/figure.js`, and in `src/building/queue.js` to `../models/figure.js`. Inside `src/models/figure.js`, change `import { box } from './geometry.js'` to `import { box } from '../utils/geometry.js'`.

- [ ] **Step 2: Run the suite to confirm the move is clean**

Run: `npm test`
Expected: PASS — same test count as before the move.

- [ ] **Step 3: Write the failing limb test**

Append to `tests/models/figure.test.js`, inside the top-level `describe('createFigure', ...)`:

```js
  it('exposes four limb pivots', () => {
    const figure = createFigure(materials, spec);
    const limbs = figure.userData.limbs;
    expect(Object.keys(limbs).sort()).toEqual(['armL', 'armR', 'legL', 'legR']);
    for (const pivot of Object.values(limbs)) {
      expect(pivot).toBeInstanceOf(THREE.Group);
    }
  });

  it('hangs each limb below its pivot so it swings from the joint', () => {
    const figure = createFigure(materials, spec);
    for (const [name, pivot] of Object.entries(figure.userData.limbs)) {
      expect(pivot.children.length, name).toBeGreaterThan(0);
      for (const child of pivot.children) {
        expect(child.position.y, `${name} child`).toBeLessThan(0);
      }
    }
  });

  it('swings a foot forward when its pivot rotates', () => {
    const still = createFigure(materials, spec);
    const swung = createFigure(materials, spec);
    swung.userData.limbs.legL.rotation.x = -0.6;
    still.updateMatrixWorld(true);
    swung.updateMatrixWorld(true);
    const at = (figure) => {
      const shoe = figure.userData.limbs.legL.children.find(
        (c) => c.material.name === 'shoe'
      );
      return new THREE.Vector3().setFromMatrixPosition(shoe.matrixWorld);
    };
    expect(at(swung).z).toBeGreaterThan(at(still).z + 0.05);
  });

  it('still stands with its feet on the ground', () => {
    const bounds = boundsOf(createFigure(materials, spec));
    expect(bounds.min.y).toBeCloseTo(0, 3);
  });
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run tests/models/figure.test.js`
Expected: FAIL — `Cannot convert undefined or null to object` reading `userData.limbs`.

- [ ] **Step 5: Rebuild the limbs on pivots**

In `src/models/figure.js`, replace the leg loop and the arm loop with pivot-based construction. The leg pivot sits at the hip, the arm pivot at the shoulder, and each limb hangs below it in local space:

```js
  const limbs = {};

  const legHalf = u(P.legWidth) / 2;
  const legDepthHalf = u(P.legDepth) / 2;
  const hipY = u(P.legTop);
  for (const [key, side] of [['legR', -1], ['legL', 1]]) {
    const pivot = new THREE.Group();
    pivot.name = key;
    pivot.position.set(side * u(P.legSpread), hipY, 0);

    const leg = box(materials.denim, {
      x: [-legHalf, legHalf],
      y: [u(P.shoeTop) - hipY, 0],
      z: [-legDepthHalf, legDepthHalf],
    });
    pivot.add(leg);

    const shoeHalf = u(P.shoeWidth) / 2;
    const shoe = box(materials.shoe, {
      x: [-shoeHalf, shoeHalf],
      y: [-hipY, u(P.shoeTop) - hipY],
      z: [-legDepthHalf, -legDepthHalf + u(P.shoeDepth)],
    });
    pivot.add(shoe);

    group.add(pivot);
    limbs[key] = pivot;
  }
```

Then the torso and arms:

```js
  const shoulderHalf = u(P.shoulder) / 2;
  const bodyHalf = u(P.bodyDepth) / 2;
  group.add(
    box(clothMat, {
      x: [-shoulderHalf, shoulderHalf],
      y: [u(P.torsoBottom), u(P.torsoTop)],
      z: [-bodyHalf, bodyHalf],
    })
  );

  const armHalf = u(P.armWidth) / 2;
  const armDepthHalf = u(P.armDepth) / 2;
  const shoulderY = u(P.armTop);
  for (const [key, side] of [['armR', -1], ['armL', 1]]) {
    const pivot = new THREE.Group();
    pivot.name = key;
    pivot.position.set(side * (shoulderHalf + armHalf), shoulderY, 0);

    pivot.add(
      box(clothMat, {
        x: [-armHalf, armHalf],
        y: [u(P.armBottom) - shoulderY, 0],
        z: [-armDepthHalf, armDepthHalf],
      })
    );

    group.add(pivot);
    limbs[key] = pivot;
  }
```

At the end of the function, before positioning the group:

```js
  group.userData.limbs = limbs;
```

The head, hair, cap and long-hair blocks are unchanged.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS — every test file green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move figure to models and hang limbs on pivots"
```

---

### Task 2: Simulation layout and materials

**Files:**
- Modify: `src/layout.js`, `src/materials.js`
- Test: `tests/layout.test.js`

**Interfaces:**
- Produces: `layout.sim` with the shape shown in Step 3, and `layout.envelopes.simulation`. `MATERIAL_KEYS` gains `carGreen`, `carRed`, `carBlue`, `carGlass`, `tyre`, `headlight`, `clothRed`, `pizzaBox`. `layout.queue` gains `slots` (the queue positions) and `cashier` (the static server).

**`layout.queue.people` stays for now.** `building/queue.js` still reads it, and it is removed in Task 8 when that module is reworked. Deleting it here would break the suite for six tasks.

- [ ] **Step 1: Write the failing test**

Append to `tests/layout.test.js`:

```js
describe('layout.sim', () => {
  it('gives every customer a parking bay', () => {
    expect(layout.sim.bays.length).toBeGreaterThanOrEqual(layout.sim.customers);
  });

  it('has more queue slots than customers so the line never overflows', () => {
    expect(layout.queue.slots.length).toBeGreaterThanOrEqual(layout.sim.customers);
  });

  it('orders queue slots front to back, away from the counter', () => {
    const slots = layout.queue.slots;
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i][1]).toBeGreaterThan(slots[i - 1][1]);
    }
    expect(slots[0][1]).toBeGreaterThan(layout.counter.main.z[1]);
  });

  it('keeps parked cars clear of the kerb and the travel lane', () => {
    const half = layout.sim.car.length / 2;
    expect(layout.sim.bayZ - half).toBeGreaterThan(layout.ground.curb.z[1]);
    expect(layout.sim.bayZ + half).toBeLessThan(layout.sim.lane.z);
  });

  it('puts every parking bay on the road', () => {
    for (const bay of layout.sim.bays) {
      expect(bay).toBeGreaterThan(layout.ground.road.x[0]);
      expect(bay).toBeLessThan(layout.ground.road.x[1]);
    }
  });

  it('gives every speed and dwell a positive value', () => {
    const { speeds, serveSeconds, boardSeconds, spawnGap } = layout.sim;
    for (const v of [speeds.car, speeds.walk, serveSeconds, boardSeconds, spawnGap]) {
      expect(v).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/layout.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'bays')`.

- [ ] **Step 3: Add `layout.sim` and reshape `layout.queue`**

In `src/layout.js`, replace the whole `queue:` block with:

```js
  // The queue forms on the plaza off the counter's customer side (+Z) and is
  // fenced by a stanchion-and-rope lane, as in the reference. `people` is
  // removed in Task 8, once the simulation owns who stands here.
  queue: {
    facing: Math.PI,
    barrier: {
      posts: [[2.8, 4.9], [2.8, 6.3], [2.8, 7.7]],
      height: 0.95,
      postRadius: 0.055,
      baseRadius: 0.17,
      baseHeight: 0.06,
      ropeY: 0.74,
      ropeRadius: 0.028,
    },
    people: [
      { x: 1.2, z: 5.1, height: 1.72, cloth: 'clothBlue', hair: 'hairDark', skin: 'skin' },
      { x: 0.5, z: 5.9, height: 1.62, cloth: 'clothYellow', hair: 'hairLight', skin: 'skin', longHair: true },
      { x: -0.1, z: 6.5, height: 1.28, cloth: 'clothGreen', hair: 'hairLight', skin: 'skin' },
      { x: -0.7, z: 7.1, height: 1.66, cloth: 'clothPink', hair: 'hairDark', skin: 'skinDeep', longHair: true },
      { x: -1.3, z: 7.7, height: 1.3, cloth: 'clothOrange', hair: 'hairDark', skin: 'skin', cap: true },
    ],
    slots: [
      [1.2, 5.1],
      [0.5, 5.9],
      [-0.1, 6.5],
      [-0.7, 7.1],
      [-1.3, 7.7],
    ],
    cashier: {
      x: 2.0,
      z: 3.0,
      facing: 0,
      height: 1.66,
      cloth: 'clothRed',
      hair: 'hairDark',
      skin: 'skin',
      cap: true,
    },
  },

  sim: {
    customers: 3,
    spawnGap: 9.0,
    respawnDelay: 2.0,
    serveSeconds: 2.5,
    boardSeconds: 0.8,
    speeds: { car: 7.5, walk: 1.35 },
    lane: { z: 20.5, enterX: 40, exitX: -40 },
    bays: [-11.7, -6.5, -1.3],
    bayZ: 16.5,
    car: { length: 4.2, width: 1.8, height: 1.55, colours: ['carGreen', 'carRed', 'carBlue'] },
    walk: { doorOffset: 1.1, curbZ: 14.6, sidewalkZ: 11.5, plazaZ: 8.6 },
    stride: { frequency: 5.2, amplitude: 0.52, armScale: 0.7 },
    people: [
      { height: 1.72, cloth: 'clothBlue', hair: 'hairDark', skin: 'skin' },
      { height: 1.66, cloth: 'clothPink', hair: 'hairDark', skin: 'skinDeep', longHair: true },
      { height: 1.62, cloth: 'clothYellow', hair: 'hairLight', skin: 'skin', longHair: true },
    ],
  },
```

Add to `layout.envelopes`:

```js
    simulation: { min: [-42, 0, 2], max: [42, 2.2, 22] },
```

- [ ] **Step 4: Add the new materials**

In `src/materials.js`, append to `MATERIAL_KEYS`:

```js
  'carGreen',
  'carRed',
  'carBlue',
  'carGlass',
  'tyre',
  'headlight',
  'clothRed',
  'pizzaBox',
```

And add to the `materials` object, next to the other flat colours:

```js
    carGreen: standard('carGreen', { color: 0x6f9463, roughness: 0.38, metalness: 0.25 }),
    carRed: standard('carRed', { color: 0xb8443c, roughness: 0.38, metalness: 0.25 }),
    carBlue: standard('carBlue', { color: 0x3f6ca8, roughness: 0.38, metalness: 0.25 }),
    carGlass: standard('carGlass', {
      color: 0x2c3a45,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    }),
    tyre: standard('tyre', { color: 0x24262a, roughness: 0.9, metalness: 0.0 }),
    headlight: standard('headlight', { color: 0xfff0cc, roughness: 0.25, metalness: 0.0 }),
    clothRed: standard('clothRed', { color: 0xb8332c, roughness: 0.76, metalness: 0.0 }),
    pizzaBox: standard('pizzaBox', { color: 0xd8b98a, roughness: 0.85, metalness: 0.0 }),
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/layout.test.js tests/materials.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/layout.js src/materials.js tests/layout.test.js
git commit -m "feat: add simulation layout block and vehicle materials"
```

---

### Task 3: Car model

**Files:**
- Create: `src/models/car.js`
- Test: `tests/models/car.test.js`

**Interfaces:**
- Consumes: `box` from `src/utils/geometry.js`; `layout.sim.car`.
- Produces: `createCar(materials, { colour, length, width, height }) -> THREE.Group` named `'car'`, built nose-toward `+Z` so `rotation.y = Math.atan2(dir.x, dir.z)` aims it along a heading. Wheels are exposed as `group.userData.wheels` — an array of four `THREE.Mesh`, rotated on X to roll.

- [ ] **Step 1: Write the failing test**

Create `tests/models/car.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCar } from '../../src/models/car.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = { colour: 'carRed', ...layout.sim.car };
const car = createCar(stubMaterials(), spec);

describe('createCar', () => {
  it('returns a named group with children', () => {
    expect(car).toBeInstanceOf(THREE.Group);
    expect(car.name).toBe('car');
    expect(car.children.length).toBeGreaterThan(4);
  });

  it('matches the declared footprint', () => {
    const bounds = boundsOf(car);
    expectFinite(bounds);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('sits on the ground', () => {
    expect(boundsOf(car).min.y).toBeCloseTo(0, 2);
  });

  it('has four wheels', () => {
    expect(car.userData.wheels).toHaveLength(4);
    for (const wheel of car.userData.wheels) {
      expect(wheel).toBeInstanceOf(THREE.Mesh);
    }
  });

  it('paints the body in the requested colour', () => {
    const names = car.children.map((c) => c.material && c.material.name);
    expect(names).toContain('carRed');
  });

  it('puts its headlights at the front', () => {
    const lights = car.children.filter((c) => c.material && c.material.name === 'headlight');
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) {
      expect(light.position.z).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/models/car.test.js`
Expected: FAIL — `Cannot find module '../../src/models/car.js'`.

- [ ] **Step 3: Write `src/models/car.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A stylised hatchback, built nose-toward +Z so a heading can be applied as
// rotation.y = atan2(dir.x, dir.z). Sits with its tyres on y = 0.
export function createCar(materials, { colour, length, width, height }) {
  const group = new THREE.Group();
  group.name = 'car';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.21;
  const bodyBottom = wheelRadius * 0.75;
  const bodyTop = height * 0.7;
  const body = materials[colour];

  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, bodyTop],
      z: [-halfL, halfL],
    })
  );

  // Cabin, set back from the nose.
  const cabinFront = halfL * 0.35;
  const cabinBack = -halfL * 0.62;
  group.add(
    box(body, {
      x: [-halfW * 0.92, halfW * 0.92],
      y: [bodyTop, height],
      z: [cabinBack, cabinFront],
    })
  );

  // Glasshouse: a slightly inset dark band around the cabin.
  group.add(
    box(materials.carGlass, {
      x: [-halfW * 0.95, halfW * 0.95],
      y: [bodyTop + (height - bodyTop) * 0.18, height - (height - bodyTop) * 0.22],
      z: [cabinBack + 0.06, cabinFront - 0.06],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.72 - 0.16, side * halfW * 0.72 + 0.16],
        y: [bodyTop - 0.26, bodyTop - 0.06],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.14, 16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.06), wheelRadius, sz * halfL * 0.62);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  group.userData.wheels = wheels;

  return group;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/models/car.test.js`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/models/car.js tests/models/car.test.js
git commit -m "feat: add low-poly car model with rollable wheels"
```

---

### Task 4: Pizza box model and resource pool

**Files:**
- Create: `src/models/pizzaBox.js`, `src/sim/pool.js`
- Test: `tests/models/pizzaBox.test.js`, `tests/sim/pool.test.js`

**Interfaces:**
- Produces: `createPizzaBox(materials, size = 0.42) -> THREE.Group` named `'pizzaBox'`, centred on its own origin so it can be parented to a hand position. `createPool(items) -> { acquire(), release(item), size, available() }` from `src/sim/pool.js`; `acquire()` returns the first free item or `null` when exhausted.

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/pool.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createPool } from '../../src/sim/pool.js';

describe('createPool', () => {
  it('reports its size and starting availability', () => {
    const pool = createPool(['a', 'b', 'c']);
    expect(pool.size).toBe(3);
    expect(pool.available()).toBe(3);
  });

  it('never hands the same item to two callers', () => {
    const pool = createPool(['a', 'b', 'c']);
    const taken = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(new Set(taken).size).toBe(3);
  });

  it('returns null once exhausted', () => {
    const pool = createPool(['a']);
    expect(pool.acquire()).toBe('a');
    expect(pool.acquire()).toBeNull();
  });

  it('makes a released item available again', () => {
    const pool = createPool(['a', 'b']);
    const first = pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
    pool.release(first);
    expect(pool.available()).toBe(1);
    expect(pool.acquire()).toBe(first);
  });

  it('ignores releasing something it never handed out', () => {
    const pool = createPool(['a']);
    pool.release('zzz');
    expect(pool.available()).toBe(1);
  });

  it('ignores a double release', () => {
    const pool = createPool(['a', 'b']);
    const first = pool.acquire();
    pool.release(first);
    pool.release(first);
    expect(pool.available()).toBe(2);
  });
});
```

Create `tests/models/pizzaBox.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaBox } from '../../src/models/pizzaBox.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createPizzaBox', () => {
  it('returns a named group centred on its origin', () => {
    const boxGroup = createPizzaBox(stubMaterials(), 0.42);
    expect(boxGroup).toBeInstanceOf(THREE.Group);
    expect(boxGroup.name).toBe('pizzaBox');
    const bounds = boundsOf(boxGroup);
    expectFinite(bounds);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(0, 5);
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(0, 5);
  });

  it('is flat and square, the size requested', () => {
    const bounds = boundsOf(createPizzaBox(stubMaterials(), 0.42));
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.42, 2);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.42, 2);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(0.42 / 3);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/pool.test.js tests/models/pizzaBox.test.js`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write `src/sim/pool.js`**

```js
// A tiny reservation pool. Bays and queue slots are scarce shared resources;
// routing them through this is what guarantees no two agents claim one.
export function createPool(items) {
  const all = [...items];
  const taken = new Set();

  return {
    size: all.length,

    available() {
      return all.length - taken.size;
    },

    acquire() {
      for (const item of all) {
        if (!taken.has(item)) {
          taken.add(item);
          return item;
        }
      }
      return null;
    },

    release(item) {
      taken.delete(item);
    },
  };
}
```

- [ ] **Step 4: Write `src/models/pizzaBox.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

export function createPizzaBox(materials, size = 0.42) {
  const group = new THREE.Group();
  group.name = 'pizzaBox';
  const half = size / 2;
  const thickness = size * 0.16;

  group.add(
    box(materials.pizzaBox, {
      x: [-half, half],
      y: [-thickness / 2, thickness / 2],
      z: [-half, half],
    })
  );

  // A darker seam so the lid reads as a lid.
  group.add(
    box(materials.woodDark, {
      x: [-half, half],
      y: [thickness / 2 - size * 0.03, thickness / 2 - size * 0.01],
      z: [-half, -half + size * 0.04],
    })
  );

  return group;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/sim/pool.test.js tests/models/pizzaBox.test.js`
Expected: PASS — 8 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/sim/pool.js src/models/pizzaBox.js tests/sim/pool.test.js tests/models/pizzaBox.test.js
git commit -m "feat: add pizza box model and resource reservation pool"
```

---

### Task 5: Path builders

**Files:**
- Create: `src/sim/paths.js`
- Test: `tests/sim/paths.test.js`

**Interfaces:**
- Consumes: `layout.sim`, `layout.queue.slots`.
- Produces, all from `src/sim/paths.js`:
  - `arrivalPath(layout, bayX) -> Array<{x, z, reverse?}>`
  - `departurePath(layout, bayX) -> Array<{x, z, reverse?}>`
  - `walkInPath(layout, bayX, slot) -> Array<{x, z}>` where `slot` is `[x, z]`
  - `walkOutPath(layout, bayX, slot) -> Array<{x, z}>`
  - `doorPosition(layout, bayX) -> {x, z}`
  - `pathLength(points) -> number`

- [ ] **Step 1: Write the failing test**

Create `tests/sim/paths.test.js`:

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

const bayX = layout.sim.bays[0];
const slot = layout.queue.slots[0];

function onPaving(point) {
  const rects = [
    ...layout.ground.sidewalk,
    ...layout.ground.plaza,
    { x: layout.ground.road.x, z: layout.ground.road.z },
    { x: layout.ground.apron.x, z: layout.ground.apron.z },
  ];
  return rects.some(
    (r) => point.x >= r.x[0] && point.x <= r.x[1] && point.z >= r.z[0] && point.z <= r.z[1]
  );
}

describe('paths', () => {
  it('drives in from the entry x and stops in the bay', () => {
    const path = arrivalPath(layout, bayX);
    expect(path[0].x).toBe(layout.sim.lane.enterX);
    expect(path[0].z).toBe(layout.sim.lane.z);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(bayX, 5);
    expect(last.z).toBeCloseTo(layout.sim.bayZ, 5);
  });

  it('backs out of the bay before turning into the lane', () => {
    const path = departurePath(layout, bayX);
    expect(path[0].z).toBeCloseTo(layout.sim.bayZ, 5);
    expect(path[1].reverse).toBe(true);
    expect(path[path.length - 1].x).toBe(layout.sim.lane.exitX);
  });

  it('walks from the car door to the queue slot', () => {
    const path = walkInPath(layout, bayX, slot);
    const door = doorPosition(layout, bayX);
    expect(path[0].x).toBeCloseTo(door.x, 5);
    expect(path[0].z).toBeCloseTo(door.z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(slot[0], 5);
    expect(last.z).toBeCloseTo(slot[1], 5);
  });

  it('walks back out along the reverse of the way in', () => {
    const inward = walkInPath(layout, bayX, slot);
    const outward = walkOutPath(layout, bayX, slot);
    expect(outward.map((p) => [p.x, p.z])).toEqual(
      inward.map((p) => [p.x, p.z]).reverse()
    );
  });

  it('keeps every walking waypoint on paved ground', () => {
    for (const bay of layout.sim.bays) {
      for (const s of layout.queue.slots) {
        for (const point of walkInPath(layout, bay, s)) {
          expect(onPaving(point), `(${point.x}, ${point.z})`).toBe(true);
        }
      }
    }
  });

  it('walks monotonically toward the counter', () => {
    const path = walkInPath(layout, bayX, slot);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].z).toBeLessThanOrEqual(path[i - 1].z + 1e-9);
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
Expected: FAIL — `Cannot find module '../../src/sim/paths.js'`.

- [ ] **Step 3: Write `src/sim/paths.js`**

```js
// Every waypoint here is derived from layout; nothing is hard-coded. Points
// are plain {x, z} so the simulation can interpolate them without allocating
// vectors, and a `reverse` flag marks segments the car backs along.

export function doorPosition(layout, bayX) {
  return { x: bayX + layout.sim.walk.doorOffset, z: layout.sim.bayZ };
}

export function arrivalPath(layout, bayX) {
  const { lane, bayZ } = layout.sim;
  return [
    { x: lane.enterX, z: lane.z },
    { x: bayX, z: lane.z },
    { x: bayX, z: bayZ },
  ];
}

export function departurePath(layout, bayX) {
  const { lane, bayZ } = layout.sim;
  return [
    { x: bayX, z: bayZ },
    { x: bayX, z: lane.z, reverse: true },
    { x: lane.exitX, z: lane.z },
  ];
}

export function walkInPath(layout, bayX, slot) {
  const { walk } = layout.sim;
  const door = doorPosition(layout, bayX);
  return [
    door,
    { x: door.x, z: walk.curbZ },
    { x: door.x, z: walk.sidewalkZ },
    { x: slot[0], z: walk.plazaZ },
    { x: slot[0], z: slot[1] },
  ];
}

export function walkOutPath(layout, bayX, slot) {
  return [...walkInPath(layout, bayX, slot)].reverse();
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/paths.test.js`
Expected: PASS — 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/paths.js tests/sim/paths.test.js
git commit -m "feat: derive driving and walking waypoints from layout"
```

---

### Task 6: Customer state machine

**Files:**
- Create: `src/sim/customer.js`
- Test: `tests/sim/customer.test.js`

**Interfaces:**
- Consumes: `createFigure` from `src/models/figure.js`; `createCar` from `src/models/car.js`; `createPizzaBox` from `src/models/pizzaBox.js`; every path builder from `src/sim/paths.js`; `layout.sim`, `layout.queue`.
- Produces: `createCustomer(materials, layout, { index }) -> customer` and `STATES` (a frozen array of the state names in cycle order) from `src/sim/customer.js`. A `customer` has:
  - `group` — a `THREE.Group` named `customer-<index>` holding the car, figure and box
  - `state` — the current state name
  - `bay` — the bay x it holds, or `null`
  - `slot` — the queue slot index it holds, or `null`
  - `hasBox` — whether the pizza box is visible
  - `figure`, `car` — the child groups, exposed for tests
  - `figurePosition()` — a clone of the figure's position
  - `start(delay)` — arms the agent to spawn after `delay` seconds
  - `update(dt, world)` — advances one step; `world` is `{ bays, firstFreeSlot(), isSlotFree(i) }`

**Slot ownership is the `customer.slot` field itself**, not a pool. A slot is free when no customer's `slot` equals it. Bays still use a pool because a bay is held while the customer is invisible, so there is nothing to scan. Running slots through a pool as well caused double bookkeeping the two mechanisms could not keep in step.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/customer.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCustomer, STATES } from '../../src/sim/customer.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

// A lone customer, so no other agent ever holds a slot.
function world() {
  return {
    bays: createPool(layout.sim.bays),
    held: null,
    isSlotFree(i) {
      return this.held !== i;
    },
    firstFreeSlot() {
      return 0;
    },
  };
}

function run(customer, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    customer.update(dt, w);
    if (onStep) onStep();
  }
}

describe('createCustomer', () => {
  it('starts idle and hidden', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    expect(customer.state).toBe('IDLE');
    expect(customer.group.visible).toBe(false);
  });

  it('visits every state in cycle order across one loop', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    const seen = [];
    customer.start(0);
    run(customer, w, 120, 1 / 60, () => {
      if (seen[seen.length - 1] !== customer.state) seen.push(customer.state);
    });
    const ordered = seen.filter((s) => s !== 'IDLE');
    for (const state of STATES.filter((s) => s !== 'IDLE')) {
      expect(ordered, `missing ${state}`).toContain(state);
    }
    const indices = ordered.map((s) => STATES.indexOf(s));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] === indices[i - 1] + 1 || indices[i] < indices[i - 1]).toBe(true);
    }
  });

  it('never teleports the car or the figure', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    const dt = 1 / 60;
    // The group itself sits at the origin; the car and figure are what travel,
    // so watching group.position would pass vacuously.
    const capCar = layout.sim.speeds.car * dt * 1.5;
    const capWalk = layout.sim.speeds.walk * dt * 1.5;
    const driving = ['APPROACHING', 'DEPARTING'];
    const walking = ['WALKING_IN', 'QUEUEING', 'WALKING_OUT'];
    let lastCar = null;
    let lastFigure = null;
    run(customer, w, 120, dt, () => {
      if (driving.includes(customer.state)) {
        const p = customer.car.position.clone();
        if (lastCar) expect(p.distanceTo(lastCar)).toBeLessThanOrEqual(capCar + 1e-6);
        lastCar = p;
      } else {
        lastCar = null;
      }
      if (walking.includes(customer.state)) {
        const p = customer.figure.position.clone();
        if (lastFigure) expect(p.distanceTo(lastFigure)).toBeLessThanOrEqual(capWalk + 1e-6);
        lastFigure = p;
      } else {
        lastFigure = null;
      }
    });
  });

  it('carries the box only between the counter and boarding', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    run(customer, w, 120, 1 / 60, () => {
      if (['IDLE', 'APPROACHING', 'PARKING', 'WALKING_IN', 'QUEUEING'].includes(customer.state)) {
        expect(customer.hasBox, `box during ${customer.state}`).toBe(false);
      }
      if (customer.state === 'WALKING_OUT') {
        expect(customer.hasBox, 'no box while walking out').toBe(true);
      }
    });
  });

  it('completes more than one full loop and frees its bay each time', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let loops = 0;
    let previous = null;
    run(customer, w, 200, 1 / 60, () => {
      if (previous === 'DEPARTING' && customer.state === 'IDLE') {
        loops++;
        expect(customer.bay).toBeNull();
        expect(customer.slot).toBeNull();
      }
      previous = customer.state;
    });
    expect(loops).toBeGreaterThanOrEqual(1);
  });

  it('reaches the counter slot while being served', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let servedAt = null;
    run(customer, w, 120, 1 / 60, () => {
      if (customer.state === 'AT_COUNTER' && !servedAt) {
        servedAt = customer.figurePosition();
      }
    });
    expect(servedAt).not.toBeNull();
    expect(servedAt.x).toBeCloseTo(layout.queue.slots[0][0], 1);
    expect(servedAt.z).toBeCloseTo(layout.queue.slots[0][1], 1);
  });

  it('swings its legs while walking and settles them when still', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let swungWhileWalking = 0;
    let restAtCounter = null;
    run(customer, w, 120, 1 / 60, () => {
      const legs = customer.figure.userData.limbs.legL.rotation.x;
      if (customer.state === 'WALKING_IN' && Math.abs(legs) > 0.05) swungWhileWalking++;
      if (customer.state === 'AT_COUNTER') restAtCounter = legs;
    });
    expect(swungWhileWalking).toBeGreaterThan(10);
    expect(Math.abs(restAtCounter)).toBeLessThan(0.2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/customer.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/customer.js'`.

- [ ] **Step 3: Write `src/sim/customer.js`**

```js
import * as THREE from 'three';
import { createFigure } from '../models/figure.js';
import { createCar } from '../models/car.js';
import { createPizzaBox } from '../models/pizzaBox.js';
import {
  arrivalPath,
  departurePath,
  walkInPath,
  walkOutPath,
  doorPosition,
} from './paths.js';

export const STATES = Object.freeze([
  'IDLE',
  'APPROACHING',
  'PARKING',
  'WALKING_IN',
  'QUEUEING',
  'AT_COUNTER',
  'WALKING_OUT',
  'BOARDING',
  'DEPARTING',
]);

// Walks a follower along a list of {x, z} waypoints at a fixed speed.
function createFollower() {
  return {
    path: null,
    index: 0,
    x: 0,
    z: 0,
    heading: Math.PI,
    done: true,

    set(path) {
      this.path = path;
      this.index = 1;
      this.x = path[0].x;
      this.z = path[0].z;
      this.done = path.length < 2;
    },

    step(dt, speed) {
      if (this.done || !this.path) return 0;
      let budget = speed * dt;
      let travelled = 0;

      while (budget > 0 && this.index < this.path.length) {
        const target = this.path[this.index];
        const dx = target.x - this.x;
        const dz = target.z - this.z;
        const distance = Math.hypot(dx, dz);

        if (distance <= 1e-6) {
          this.index++;
          continue;
        }
        if (!target.reverse) {
          this.heading = Math.atan2(dx, dz);
        }
        const move = Math.min(budget, distance);
        this.x += (dx / distance) * move;
        this.z += (dz / distance) * move;
        budget -= move;
        travelled += move;
        if (move >= distance - 1e-6) this.index++;
      }

      if (this.index >= this.path.length) this.done = true;
      return travelled;
    },
  };
}

export function createCustomer(materials, layout, { index }) {
  const sim = layout.sim;
  const person = sim.people[index % sim.people.length];
  const colour = sim.car.colours[index % sim.car.colours.length];

  const group = new THREE.Group();
  group.name = `customer-${index}`;
  group.visible = false;

  const car = createCar(materials, { colour, ...sim.car });
  const figure = createFigure(materials, { ...person, x: 0, z: 0, facing: 0 });
  const pizzaBox = createPizzaBox(materials);
  pizzaBox.visible = false;

  // Car and figure move independently, so they are siblings under a group that
  // stays at the origin; each carries its own world position.
  group.add(car, figure, pizzaBox);

  const follower = createFollower();
  let state = 'IDLE';
  let timer = 0;
  let stridePhase = 0;
  let bay = null;
  let slot = null;

  const boxHeight = person.height * 0.52;
  const boxReach = person.height * 0.16;

  function setState(next) {
    state = next;
    timer = 0;
  }

  // Eases toward a heading by the shortest arc, so the car sweeps through its
  // turns instead of snapping when a waypoint changes direction.
  function turnCar(target, dt) {
    const delta = ((target - car.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    car.rotation.y += delta * Math.min(1, dt * 6);
  }

  function placeCar(x, z, heading, dt) {
    car.position.set(x, 0, z);
    if (dt === undefined) car.rotation.y = heading;
    else turnCar(heading, dt);
  }

  function placeFigure(x, z, heading) {
    figure.position.set(x, 0, z);
    figure.rotation.y = heading;
    pizzaBox.position.set(
      x + Math.sin(heading) * boxReach,
      boxHeight,
      z + Math.cos(heading) * boxReach
    );
    pizzaBox.rotation.y = heading;
  }

  function animateLegs(dt, moving) {
    const limbs = figure.userData.limbs;
    if (moving) {
      stridePhase += dt * sim.stride.frequency;
      const swing = Math.sin(stridePhase) * sim.stride.amplitude;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * sim.stride.armScale;
      limbs.armR.rotation.x = swing * sim.stride.armScale;
    } else {
      for (const limb of Object.values(limbs)) {
        limb.rotation.x *= Math.max(0, 1 - dt * 8);
      }
    }
  }

  function rollWheels(distance) {
    const radius = sim.car.height * 0.21;
    for (const wheel of car.userData.wheels) {
      wheel.rotation.x -= distance / radius;
    }
  }

  const customer = {
    group,
    figure,
    car,

    get state() {
      return state;
    },
    get bay() {
      return bay;
    },
    get slot() {
      return slot;
    },
    get hasBox() {
      return pizzaBox.visible;
    },

    figurePosition() {
      return figure.position.clone();
    },

    start(delay = 0) {
      setState('IDLE');
      timer = -delay;
    },

    update(dt, world) {
      switch (state) {
        case 'IDLE': {
          timer += dt;
          if (timer < 0) return;
          bay = world.bays.acquire();
          if (bay === null) return;
          group.visible = true;
          figure.visible = false;
          follower.set(arrivalPath(layout, bay));
          placeCar(follower.x, follower.z, -Math.PI / 2);
          setState('APPROACHING');
          return;
        }

        case 'APPROACHING': {
          const moved = follower.step(dt, sim.speeds.car);
          rollWheels(moved);
          placeCar(follower.x, follower.z, follower.heading, dt);
          if (follower.done) setState('PARKING');
          return;
        }

        case 'PARKING': {
          timer += dt;
          if (timer < 0.4) return;
          slot = world.firstFreeSlot();
          if (slot === null) return;
          const target = layout.queue.slots[slot];
          const door = doorPosition(layout, bay);
          figure.visible = true;
          follower.set(walkInPath(layout, bay, target));
          placeFigure(door.x, door.z, layout.queue.facing);
          setState('WALKING_IN');
          return;
        }

        case 'WALKING_IN': {
          follower.step(dt, sim.speeds.walk);
          placeFigure(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            placeFigure(follower.x, follower.z, layout.queue.facing);
            setState(slot === 0 ? 'AT_COUNTER' : 'QUEUEING');
          }
          return;
        }

        case 'QUEUEING': {
          animateLegs(dt, !follower.done);
          if (!follower.done) {
            follower.step(dt, sim.speeds.walk);
            placeFigure(follower.x, follower.z, follower.heading);
            if (follower.done) {
              placeFigure(follower.x, follower.z, layout.queue.facing);
              if (slot === 0) setState('AT_COUNTER');
            }
            return;
          }
          // Shuffle forward whenever the slot ahead is free.
          const ahead = slot - 1;
          if (ahead >= 0 && world.isSlotFree(ahead)) {
            slot = ahead;
            const target = layout.queue.slots[slot];
            follower.set([
              { x: figure.position.x, z: figure.position.z },
              { x: target[0], z: target[1] },
            ]);
          }
          return;
        }

        case 'AT_COUNTER': {
          animateLegs(dt, false);
          timer += dt;
          if (timer >= sim.serveSeconds) {
            pizzaBox.visible = true;
            const target = layout.queue.slots[slot];
            follower.set(walkOutPath(layout, bay, target));
            slot = null;
            setState('WALKING_OUT');
          }
          return;
        }

        case 'WALKING_OUT': {
          follower.step(dt, sim.speeds.walk);
          placeFigure(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) setState('BOARDING');
          return;
        }

        case 'BOARDING': {
          animateLegs(dt, false);
          timer += dt;
          if (timer >= sim.boardSeconds) {
            figure.visible = false;
            pizzaBox.visible = false;
            follower.set(departurePath(layout, bay));
            setState('DEPARTING');
          }
          return;
        }

        case 'DEPARTING': {
          const moved = follower.step(dt, sim.speeds.car);
          rollWheels(moved);
          placeCar(follower.x, follower.z, follower.heading, dt);
          if (follower.done) {
            world.bays.release(bay);
            bay = null;
            group.visible = false;
            setState('IDLE');
            timer = -sim.respawnDelay;
          }
          return;
        }

        default:
          return;
      }
    },
  };

  return customer;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/customer.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/customer.js tests/sim/customer.test.js
git commit -m "feat: add customer state machine driving the full cycle"
```

---

### Task 7: Simulation orchestrator

**Files:**
- Create: `src/sim/simulation.js`
- Test: `tests/sim/simulation.test.js`

**Interfaces:**
- Consumes: `createCustomer` from `src/sim/customer.js`; `createPool` from `src/sim/pool.js`.
- Produces: `createSimulation(materials, layout) -> { group, update(dt), customers }` from `src/sim/simulation.js`. `group` is a `THREE.Group` named `'simulation'`. `customers` is the array of agents, exposed for tests. The `world` object handed to each customer is `{ bays, slots, isFree(slotIndex), claim(slotIndex) }`.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/simulation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { STATES } from '../../src/sim/customer.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

function stepped(seconds, dt = 1 / 60, onStep) {
  const sim = createSimulation(stubMaterials(), layout);
  for (let t = 0; t < seconds; t += dt) {
    sim.update(dt);
    if (onStep) onStep(sim);
  }
  return sim;
}

describe('createSimulation', () => {
  it('returns a named group holding one child per customer', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.group).toBeInstanceOf(THREE.Group);
    expect(sim.group.name).toBe('simulation');
    expect(sim.group.children).toHaveLength(layout.sim.customers);
    expect(sim.customers).toHaveLength(layout.sim.customers);
  });

  it('never lets two customers hold the same bay', () => {
    stepped(240, 1 / 60, (sim) => {
      const held = sim.customers.map((c) => c.bay).filter((b) => b !== null);
      expect(new Set(held).size).toBe(held.length);
    });
  });

  it('never lets two customers hold the same queue slot', () => {
    stepped(240, 1 / 60, (sim) => {
      const held = sim.customers.map((c) => c.slot).filter((s) => s !== null);
      expect(new Set(held).size).toBe(held.length);
    });
  });

  it('keeps every customer in a valid state', () => {
    stepped(240, 1 / 60, (sim) => {
      for (const customer of sim.customers) {
        expect(STATES).toContain(customer.state);
      }
    });
  });

  it('does not grow the scene graph over time', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const count = () => {
      let n = 0;
      sim.group.traverse(() => n++);
      return n;
    };
    const before = count();
    for (let t = 0; t < 240; t += 1 / 60) sim.update(1 / 60);
    expect(count()).toBe(before);
  });

  it('gets everyone served at least once over a long run', () => {
    const served = new Set();
    stepped(300, 1 / 60, (sim) => {
      sim.customers.forEach((c, i) => {
        if (c.state === 'AT_COUNTER') served.add(i);
      });
    });
    expect(served.size).toBe(layout.sim.customers);
  });

  it('has somebody visible most of the time once warmed up', () => {
    let visibleSteps = 0;
    let total = 0;
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 300; t += 1 / 60) {
      sim.update(1 / 60);
      if (t > 30) {
        total++;
        if (sim.customers.some((c) => c.group.visible)) visibleSteps++;
      }
    }
    expect(visibleSteps / total).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/simulation.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/simulation.js'`.

- [ ] **Step 3: Write `src/sim/simulation.js`**

```js
import * as THREE from 'three';
import { createCustomer } from './customer.js';
import { createPool } from './pool.js';

export function createSimulation(materials, layout) {
  const group = new THREE.Group();
  group.name = 'simulation';

  const bays = createPool(layout.sim.bays);
  const customers = [];
  for (let i = 0; i < layout.sim.customers; i++) {
    const customer = createCustomer(materials, layout, { index: i });
    customer.start(i * layout.sim.spawnGap);
    customers.push(customer);
    group.add(customer.group);
  }

  // Slot ownership is read straight off the agents, so there is exactly one
  // source of truth for who stands where.
  const world = {
    bays,
    isSlotFree(slotIndex) {
      return !customers.some((c) => c.slot === slotIndex);
    },
    firstFreeSlot() {
      for (let i = 0; i < layout.queue.slots.length; i++) {
        if (world.isSlotFree(i)) return i;
      }
      return null;
    },
  };

  return {
    group,
    customers,
    update(dt) {
      for (const customer of customers) customer.update(dt, world);
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/simulation.test.js`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/simulation.js tests/sim/simulation.test.js
git commit -m "feat: add simulation orchestrator with shared bay and slot pools"
```

---

### Task 8: Static cashier and queue rework

**Files:**
- Modify: `src/building/queue.js`, `tests/building/queue.test.js`
- Test: `tests/building/queue.test.js`

**Interfaces:**
- Consumes: `createFigure` from `src/models/figure.js`; `layout.queue.barrier`, `layout.queue.cashier`.
- Produces: `createQueue(materials, layout) -> THREE.Group` named `'queue'`, now containing the rope barrier and exactly one figure — the cashier — and no queued customers.

- [ ] **Step 1: Rewrite the failing test**

Replace the body of `tests/building/queue.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createQueue } from '../../src/building/queue.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createQueue(stubMaterials(), layout);
const figures = group.children.filter((c) => c.name === 'figure');

describe('createQueue', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('queue');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds', () => {
    expectFinite(boundsOf(group));
  });

  it('builds only the cashier, leaving the queue to the simulation', () => {
    expect(figures).toHaveLength(1);
  });

  it('stands the cashier behind the counter', () => {
    const cashier = figures[0];
    expect(cashier.position.z).toBeLessThan(layout.counter.main.z[0]);
    expect(cashier.position.x).toBeGreaterThan(layout.counter.main.x[0]);
    expect(cashier.position.x).toBeLessThan(layout.counter.main.x[1]);
  });

  it('turns the cashier to face the customers', () => {
    expect(figures[0].rotation.y).toBeCloseTo(layout.queue.cashier.facing, 5);
  });

  it('ropes every stanchion to the next one', () => {
    const ropes = group.children.filter((c) => c.material && c.material.name === 'rope');
    expect(ropes).toHaveLength(layout.queue.barrier.posts.length - 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/building/queue.test.js`
Expected: FAIL — five figures found, one expected, and `layout.queue.people` is gone.

- [ ] **Step 3: Remove `layout.queue.people`**

Delete the whole `people: [...]` array from the `queue` block in
`src/layout.js`. Nothing reads it after this task.

- [ ] **Step 4: Rework `src/building/queue.js`**

Replace the people loop at the end of `createQueue` with the cashier:

```js
  const cashier = layout.queue.cashier;
  group.add(
    createFigure(materials, {
      ...cashier,
      facing: cashier.facing,
    })
  );
```

and change the import at the top of the file to:

```js
import { createFigure } from '../models/figure.js';
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS — every test file green.

- [ ] **Step 6: Commit**

```bash
git add src/building/queue.js src/layout.js tests/building/queue.test.js
git commit -m "feat: replace static queue with a cashier behind the counter"
```

---

### Task 9: Wire the simulation into the scene and render loop

**Files:**
- Modify: `src/scene.js`, `src/main.js`, `src/layout.js`, `tests/scene.test.js`

**Interfaces:**
- Consumes: `createSimulation` from `src/sim/simulation.js`.
- Produces: `createShop` gains a `simulation` child group and sets `shop.userData.simulation` to the object returned by `createSimulation`, mirroring how `shop.userData.fireLight` is already exposed. Child order becomes `ground, perimeter, diningWing, storefront, kitchen, oven, counter, sideWing, queue, simulation, lighting`.

- [ ] **Step 1: Update the failing scene test**

In `tests/scene.test.js`, change the expected child order to include `'simulation'` after `'queue'`, and append these tests inside the same `describe`:

```js
  it('exposes the simulation for the render loop', () => {
    expect(shop.userData.simulation).toBeTruthy();
    expect(typeof shop.userData.simulation.update).toBe('function');
  });

  it('advances without throwing', () => {
    for (let t = 0; t < 60; t += 1 / 60) shop.userData.simulation.update(1 / 60);
    expect(shop.userData.simulation.customers).toHaveLength(layout.sim.customers);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/scene.test.js`
Expected: FAIL — child order mismatch, `simulation` missing.

- [ ] **Step 3: Wire it into `src/scene.js`**

Add the import:

```js
import { createSimulation } from './sim/simulation.js';
```

Build it next to the other parts:

```js
  const simulation = createSimulation(materials, layout);
```

Add its group in order and expose it:

```js
  shop.add(
    ground, perimeter, diningWing, storefront, kitchen, oven,
    counter, sideWing, queue, simulation.group, lighting
  );
  shop.userData.fireLight = oven.userData.fireLight;
  shop.userData.simulation = simulation;
```

- [ ] **Step 4: Drive it from `src/main.js`**

Replace the body of `animate()` so the simulation advances on real elapsed time, and restore the reference camera angle:

```js
function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  fireLight.intensity =
    baseIntensity * (0.86 + 0.14 * Math.sin(t * 9.3) * Math.sin(t * 3.1));
  shop.userData.simulation.update(delta);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

`clock.getDelta()` is clamped so a backgrounded tab does not fast-forward the
whole simulation on its next frame.

In `src/layout.js`, set the camera back to the reference angle:

```js
    direction: [1, 0.82, 1],
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — every test file green.

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: Vite writes `dist/` with no errors.

- [ ] **Step 7: Verify visually**

Run: `npm run dev`

Open the served URL and confirm, over about a minute:

1. Cars enter from the right along the road and turn into the parking bays.
2. Each car stops nose-to-kerb inside a bay, without overlapping the kerb or another car.
3. A customer appears at the car, crosses the sidewalk and joins the queue.
4. Legs and arms swing while walking and settle when standing.
5. Customers shuffle forward as those ahead of them leave.
6. At the counter a pizza box appears in the customer's hands.
7. The customer carries it back, the box and figure disappear at the car, and the car backs out and drives away to the left.
8. The loop repeats indefinitely with three customers overlapping.

If any step fails, fix the responsible module and re-run its test file.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: drive the customer simulation from the render loop"
```

---

## Verification

```bash
npm test && npm run build
```

Expected: every test passes and `dist/` builds clean.
