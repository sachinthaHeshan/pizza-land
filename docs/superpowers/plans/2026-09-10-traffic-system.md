# Traffic System Implementation Plan (Part B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the four-lane road with continuous mixed traffic where some cars pull into the lot for pizza, honk when it is full, and give up after ten seconds.

**Architecture:** `customer.js` splits into a driving `vehicle` and a walking `pedestrian`. Car-following is a pure function of gap and speeds, so the no-overlap invariant is exhaustively testable without a renderer. `traffic.js` owns a fixed recycled pool, spawns per lane to regulate density, and keeps each lane ordered so every vehicle knows its leader.

**Tech Stack:** three, vite, vitest, Web Audio API. ES modules, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-10-traffic-system-design.md`

## Global Constraints

- Nothing in `src/sim/` hard-codes a coordinate; everything reads `layout`.
- Vehicles and pedestrians are recycled from fixed pools, never disposed.
- `src/sim/audio.js` must build no `AudioContext` until `enable()` is called, and must be a total no-op when constructed without a factory — the Node tests depend on it.
- Vehicle table, verbatim: car `4.2 × 1.8 × 1.55` cruise `9.0` share `0.62`; van `5.2 × 2.0 × 2.30` cruise `8.0` share `0.22`; bus `9.0 × 2.4 × 3.00` cruise `7.0` share `0.16`.
- Following: `minGap 1.6`, `headway 0.9`, `accel 4.5`, `decel 9.0`.
- Lane changes: `changeSeconds 1.2`, `mergeDistance 26`, `overtakeGap 9`, `changeClearance 7`.
- Waiting: `waitSeconds 10`, `hornInterval 1.2`.
- Lanes spawn at `x = ±40` and despawn at `x = ∓40`, 6 per lane, `spawnGap 14`.
- Only cars in `-1` lanes may want pizza. A balked vehicle clears its intent.
- Everything is deterministic under a seeded RNG so tests can step it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/random.js` | Seeded RNG, extracted from `textures.js` |
| `src/models/bus.js` | Long single-deck bus |
| `src/models/van.js` | Boxy delivery van |
| `src/models/hornBurst.js` | Pulsing horn arcs |
| `src/sim/following.js` | `safeSpeed`, pure |
| `src/sim/lanes.js` | Lane records, spawn/despawn, change targets |
| `src/sim/audio.js` | Horn behind a click-to-enable gate |
| `src/sim/pedestrian.js` | Renamed from `customer.js`, car removed |
| `src/sim/vehicle.js` | One road vehicle: state machine and movement |
| `src/sim/traffic.js` | Pool, spawner, per-lane ordering |
| `src/sim/simulation.js` | Owns traffic and the pedestrian pool |
| `src/sim/paths.js` | `lotEntryPath` / `lotExitPath` replace the road builders |

---

### Task 1: Seeded RNG and following model

**Files:**
- Create: `src/utils/random.js`, `src/sim/following.js`
- Modify: `src/textures.js` (use the shared RNG)
- Test: `tests/utils/random.test.js`, `tests/sim/following.test.js`

**Interfaces:**
- Produces: `mulberry32(seed) -> () => number` from `src/utils/random.js`, returning values in `[0, 1)`. `safeSpeed({ gap, leaderSpeed, cruise, minGap, headway }) -> number` from `src/sim/following.js`.

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/random.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/random.js';

describe('mulberry32', () => {
  it('returns values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
```

Create `tests/sim/following.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { safeSpeed } from '../../src/sim/following.js';

const base = { cruise: 9, minGap: 1.6, headway: 0.9 };

describe('safeSpeed', () => {
  it('cruises with no leader ahead', () => {
    expect(safeSpeed({ ...base, gap: Infinity, leaderSpeed: 0 })).toBe(9);
  });

  it('stops when the gap is down to the minimum', () => {
    expect(safeSpeed({ ...base, gap: 1.6, leaderSpeed: 0 })).toBe(0);
    expect(safeSpeed({ ...base, gap: 0.4, leaderSpeed: 0 })).toBe(0);
  });

  it('cruises again once the gap exceeds the desired headway', () => {
    const desired = base.minGap + base.cruise * base.headway;
    expect(safeSpeed({ ...base, gap: desired + 5, leaderSpeed: 0 })).toBe(9);
  });

  it('eases toward a stopped leader as the gap closes', () => {
    const near = safeSpeed({ ...base, gap: 2.5, leaderSpeed: 0 });
    const far = safeSpeed({ ...base, gap: 6, leaderSpeed: 0 });
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(far);
  });

  it('never exceeds cruise and is never negative', () => {
    for (let gap = 0; gap < 40; gap += 0.25) {
      for (const leaderSpeed of [0, 4, 9, 20]) {
        const v = safeSpeed({ ...base, gap, leaderSpeed });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(base.cruise);
      }
    }
  });

  it('rises monotonically with the gap', () => {
    let previous = -1;
    for (let gap = base.minGap; gap < 30; gap += 0.25) {
      const v = safeSpeed({ ...base, gap, leaderSpeed: 0 });
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
  });

  it('matches the leader when following nose to tail', () => {
    expect(safeSpeed({ ...base, gap: base.minGap, leaderSpeed: 5 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/utils/random.test.js tests/sim/following.test.js`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write `src/utils/random.js`**

```js
// Small deterministic PRNG. Every random choice in the simulation runs
// through this so a seed reproduces a run exactly, which is what lets the
// traffic invariants be tested by stepping.
export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Write `src/sim/following.js`**

```js
// The whole car-following model, as one pure function. Keeping it free of
// state is what makes the "no two vehicles overlap" invariant testable
// exhaustively rather than by observation.
export function safeSpeed({ gap, leaderSpeed, cruise, minGap, headway }) {
  if (!Number.isFinite(gap)) return cruise;
  if (gap <= minGap) return 0;

  const desiredGap = minGap + cruise * headway;
  if (gap >= desiredGap) return cruise;

  const t = (gap - minGap) / (desiredGap - minGap);
  return Math.max(0, Math.min(cruise, leaderSpeed * (1 - t) + cruise * t));
}
```

- [ ] **Step 5: Point textures.js at the shared RNG**

In `src/textures.js`, delete the local `mulberry32` function and add to the imports at the top:

```js
import { mulberry32 } from './utils/random.js';
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS — every file green, including the existing texture tests.

- [ ] **Step 7: Commit**

```bash
git add src/utils/random.js src/sim/following.js src/textures.js tests/utils/random.test.js tests/sim/following.test.js
git commit -m "feat: add seeded RNG and the car-following speed model"
```

---

### Task 2: Traffic layout, lanes and vehicle models

**Files:**
- Create: `src/models/bus.js`, `src/models/van.js`, `src/sim/lanes.js`
- Modify: `src/layout.js`, `src/materials.js`
- Test: `tests/models/bus.test.js`, `tests/models/van.test.js`, `tests/sim/lanes.test.js`

**Interfaces:**
- Produces: `layout.traffic` as shown in Step 2. `createBus(materials, spec)` and `createVan(materials, spec)`, both `-> THREE.Group` named `'bus'` / `'van'`, built nose-toward `+Z` and standing on `y = 0` exactly like `createCar`, each exposing `group.userData.wheels`. `buildLanes(layout) -> Lane[]` from `src/sim/lanes.js`, where a `Lane` is `{ index, z, direction, spawnX, despawnX, neighbour }` and `neighbour` is the index of the adjacent same-direction lane, or `null`. `MATERIAL_KEYS` gains `busBody`, `vanBody`, `horn`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/lanes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildLanes } from '../../src/sim/lanes.js';
import { layout } from '../../src/layout.js';

const lanes = buildLanes(layout);

describe('buildLanes', () => {
  it('builds one lane record per configured lane', () => {
    expect(lanes).toHaveLength(layout.ground.lanes.length);
    lanes.forEach((lane, i) => expect(lane.index).toBe(i));
  });

  it('spawns each lane behind its despawn, along its direction', () => {
    for (const lane of lanes) {
      const travelled = (lane.despawnX - lane.spawnX) * lane.direction;
      expect(travelled, `lane ${lane.index}`).toBeGreaterThan(0);
    }
  });

  it('sends opposing directions in from opposite ends', () => {
    const west = lanes.filter((l) => l.direction === -1);
    const east = lanes.filter((l) => l.direction === 1);
    for (const lane of west) expect(lane.spawnX).toBeGreaterThan(0);
    for (const lane of east) expect(lane.spawnX).toBeLessThan(0);
  });

  it('pairs each lane with an adjacent lane going the same way', () => {
    for (const lane of lanes) {
      expect(lane.neighbour).not.toBeNull();
      const other = lanes[lane.neighbour];
      expect(other.direction).toBe(lane.direction);
      expect(Math.abs(other.index - lane.index)).toBe(1);
    }
  });

  it('takes lane centres straight from the ground layout', () => {
    lanes.forEach((lane, i) => expect(lane.z).toBe(layout.ground.lanes[i].z));
  });
});
```

Create `tests/models/bus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBus } from '../../src/models/bus.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.traffic.types.find((t) => t.key === 'bus');
const bus = createBus(stubMaterials(), spec);

describe('createBus', () => {
  it('returns a named group standing on the ground', () => {
    expect(bus).toBeInstanceOf(THREE.Group);
    expect(bus.name).toBe('bus');
    const bounds = boundsOf(bus);
    expectFinite(bounds);
    expect(bounds.min.y).toBeCloseTo(0, 2);
  });

  it('matches its declared footprint', () => {
    const bounds = boundsOf(bus);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('has six wheels, being long', () => {
    expect(bus.userData.wheels).toHaveLength(6);
  });

  it('is longer and taller than a car', () => {
    const car = layout.traffic.types.find((t) => t.key === 'car');
    expect(spec.length).toBeGreaterThan(car.length);
    expect(spec.height).toBeGreaterThan(car.height);
  });
});
```

Create `tests/models/van.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVan } from '../../src/models/van.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.traffic.types.find((t) => t.key === 'van');
const van = createVan(stubMaterials(), spec);

describe('createVan', () => {
  it('returns a named group standing on the ground', () => {
    expect(van).toBeInstanceOf(THREE.Group);
    expect(van.name).toBe('van');
    const bounds = boundsOf(van);
    expectFinite(bounds);
    expect(bounds.min.y).toBeCloseTo(0, 2);
  });

  it('matches its declared footprint', () => {
    const bounds = boundsOf(van);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('has four wheels', () => {
    expect(van.userData.wheels).toHaveLength(4);
  });

  it('sits between a car and a bus in size', () => {
    const car = layout.traffic.types.find((t) => t.key === 'car');
    const bus = layout.traffic.types.find((t) => t.key === 'bus');
    expect(spec.length).toBeGreaterThan(car.length);
    expect(spec.length).toBeLessThan(bus.length);
  });
});
```

- [ ] **Step 2: Add `layout.traffic` and the materials**

In `src/layout.js`, add a `traffic` block after `sim`:

```js
  traffic: {
    seed: 20260910,
    perLane: 6,
    spawnGap: 14,
    spawnX: 40,
    pizzaChance: 0.18,
    follow: { minGap: 1.6, headway: 0.9, accel: 4.5, decel: 9.0 },
    laneChange: {
      changeSeconds: 1.2,
      mergeDistance: 26,
      overtakeGap: 9,
      changeClearance: 7,
    },
    waitSeconds: 10,
    hornInterval: 1.2,
    types: [
      {
        key: 'car', model: 'car', share: 0.62, cruise: 9.0,
        length: 4.2, width: 1.8, height: 1.55, wantsPizza: true,
        colours: ['carGreen', 'carRed', 'carBlue'],
      },
      {
        key: 'van', model: 'van', share: 0.22, cruise: 8.0,
        length: 5.2, width: 2.0, height: 2.3, wantsPizza: false,
        colours: ['vanBody'],
      },
      {
        key: 'bus', model: 'bus', share: 0.16, cruise: 7.0,
        length: 9.0, width: 2.4, height: 3.0, wantsPizza: false,
        colours: ['busBody'],
      },
    ],
  },
```

In `layout.sim`, replace `customers: 3` with `pedestrians: 6`, and add to `layout.envelopes`:

```js
    traffic: { min: [-46, 0, 25], max: [46, 3.4, 42] },
```

In `src/materials.js`, append to `MATERIAL_KEYS`:

```js
  'busBody',
  'vanBody',
  'horn',
```

and to the materials object:

```js
    busBody: standard('busBody', { color: 0xc9843a, roughness: 0.42, metalness: 0.2 }),
    vanBody: standard('vanBody', { color: 0xe4e1d8, roughness: 0.45, metalness: 0.18 }),
    horn: new THREE.MeshBasicMaterial({ name: 'horn', color: 0xffd66b }),
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/lanes.test.js tests/models/bus.test.js tests/models/van.test.js`
Expected: FAIL — `lanes.js`, `bus.js` and `van.js` are all missing.

- [ ] **Step 4: Write `src/sim/lanes.js`**

```js
// Lane records derived from the ground layout. Spawn and despawn sit at
// opposite ends of the road depending on direction, so a vehicle always
// travels the full width of the scene.
export function buildLanes(layout) {
  const { spawnX } = layout.traffic;

  return layout.ground.lanes.map((lane, index, all) => {
    const sameWay = all
      .map((l, i) => ({ ...l, i }))
      .filter((l) => l.direction === lane.direction && l.i !== index);
    const adjacent = sameWay.find((l) => Math.abs(l.i - index) === 1);

    return {
      index,
      z: lane.z,
      direction: lane.direction,
      spawnX: lane.direction === -1 ? spawnX : -spawnX,
      despawnX: lane.direction === -1 ? -spawnX : spawnX,
      neighbour: adjacent ? adjacent.i : null,
    };
  });
}
```

- [ ] **Step 5: Write `src/models/van.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A boxy delivery van, built nose-toward +Z and standing on y = 0, matching
// createCar so the same heading maths applies.
export function createVan(materials, { length, width, height }) {
  const group = new THREE.Group();
  group.name = 'van';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.16;
  const bodyBottom = wheelRadius * 0.8;
  const body = materials.vanBody;

  // One tall box for the load area, a shorter nose in front of it.
  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, height],
      z: [-halfL, halfL * 0.35],
    })
  );
  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, height * 0.62],
      z: [halfL * 0.35, halfL],
    })
  );

  group.add(
    box(materials.carGlass, {
      x: [-halfW * 0.94, halfW * 0.94],
      y: [height * 0.36, height * 0.58],
      z: [halfL * 0.36, halfL - 0.05],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.68 - 0.16, side * halfW * 0.68 + 0.16],
        y: [height * 0.2, height * 0.32],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.13, 14);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.05), wheelRadius, sz * halfL * 0.62);
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

- [ ] **Step 6: Write `src/models/bus.js`**

```js
import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A single-deck bus: one long slab with a window band and six wheels.
export function createBus(materials, { length, width, height }) {
  const group = new THREE.Group();
  group.name = 'bus';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.14;
  const bodyBottom = wheelRadius * 0.9;
  const body = materials.busBody;

  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, height],
      z: [-halfL, halfL],
    })
  );

  // Window band down both sides and across the front.
  group.add(
    box(materials.carGlass, {
      x: [-halfW - 0.02, halfW + 0.02],
      y: [height * 0.52, height * 0.82],
      z: [-halfL + 0.5, halfL - 0.3],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.7 - 0.18, side * halfW * 0.7 + 0.18],
        y: [height * 0.2, height * 0.32],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.12, 14);
  for (const sx of [-1, 1]) {
    for (const sz of [0.68, -0.34, -0.62]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.05), wheelRadius, sz * halfL);
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

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/sim/lanes.test.js tests/models/ tests/materials.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/layout.js src/materials.js src/sim/lanes.js src/models/bus.js src/models/van.js tests/
git commit -m "feat: add traffic layout, lane records, bus and van models"
```

---

### Task 3: The horn

**Files:**
- Create: `src/sim/audio.js`, `src/models/hornBurst.js`
- Test: `tests/sim/audio.test.js`, `tests/models/hornBurst.test.js`

**Interfaces:**
- Produces: `createHorn(contextFactory) -> { enable(), play(), get enabled() }` from `src/sim/audio.js`. With no `contextFactory` every method is a no-op. `createHornBurst(materials) -> THREE.Group` named `'hornBurst'`, hidden by default, with `group.userData.setPhase(t)` scaling the arcs.

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/audio.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createHorn } from '../../src/sim/audio.js';

function fakeContext() {
  const gain = { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const osc = {
    frequency: { value: 0, setValueAtTime: vi.fn() },
    type: '',
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    currentTime: 0,
    destination: {},
    state: 'running',
    resume: vi.fn(),
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => osc),
    __gain: gain,
    __osc: osc,
  };
}

describe('createHorn', () => {
  it('is a no-op with no audio context factory', () => {
    const horn = createHorn();
    expect(horn.enabled).toBe(false);
    expect(() => horn.play()).not.toThrow();
    expect(() => horn.enable()).not.toThrow();
    expect(horn.enabled).toBe(false);
  });

  it('builds no context until enabled', () => {
    const factory = vi.fn(fakeContext);
    const horn = createHorn(factory);
    horn.play();
    expect(factory).not.toHaveBeenCalled();
    expect(horn.enabled).toBe(false);
  });

  it('builds exactly one context, however often it is enabled', () => {
    const factory = vi.fn(fakeContext);
    const horn = createHorn(factory);
    horn.enable();
    horn.enable();
    horn.enable();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(horn.enabled).toBe(true);
  });

  it('sounds two tones per honk once enabled', () => {
    const context = fakeContext();
    const horn = createHorn(() => context);
    horn.enable();
    horn.play();
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('survives a context factory that throws', () => {
    const horn = createHorn(() => {
      throw new Error('blocked');
    });
    expect(() => horn.enable()).not.toThrow();
    expect(horn.enabled).toBe(false);
    expect(() => horn.play()).not.toThrow();
  });
});
```

Create `tests/models/hornBurst.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHornBurst } from '../../src/models/hornBurst.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createHornBurst', () => {
  it('returns a hidden named group', () => {
    const burst = createHornBurst(stubMaterials());
    expect(burst).toBeInstanceOf(THREE.Group);
    expect(burst.name).toBe('hornBurst');
    expect(burst.visible).toBe(false);
  });

  it('has finite bounds', () => {
    const burst = createHornBurst(stubMaterials());
    burst.visible = true;
    expectFinite(boundsOf(burst));
  });

  it('pulses its arcs as the phase advances', () => {
    const burst = createHornBurst(stubMaterials());
    burst.userData.setPhase(0);
    const small = burst.children[0].scale.x;
    burst.userData.setPhase(Math.PI / 2);
    const large = burst.children[0].scale.x;
    expect(large).not.toBeCloseTo(small, 3);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/sim/audio.test.js tests/models/hornBurst.test.js`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write `src/sim/audio.js`**

```js
// A synthesised two-tone horn. Browsers refuse to start an AudioContext
// outside a user gesture, so nothing is built until enable() is called from
// a click — and with no factory at all (the Node tests) every call is inert.
export function createHorn(contextFactory) {
  let context = null;

  function tone(frequency, startAt, duration) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  return {
    get enabled() {
      return context !== null;
    },

    enable() {
      if (context || !contextFactory) return;
      try {
        context = contextFactory();
        if (context.state === 'suspended') context.resume();
      } catch {
        context = null;
      }
    },

    play() {
      if (!context) return;
      try {
        const now = context.currentTime;
        tone(440, now, 0.16);
        tone(330, now + 0.18, 0.2);
      } catch {
        // A closed or interrupted context must never break the render loop.
      }
    },
  };
}
```

- [ ] **Step 4: Write `src/models/hornBurst.js`**

```js
import * as THREE from 'three';

// Two small arcs above a vehicle's roof, pulsing outward. This is the part
// of a honk that works with the sound switched off.
export function createHornBurst(materials) {
  const group = new THREE.Group();
  group.name = 'hornBurst';
  group.visible = false;

  const arcs = [];
  for (const radius of [0.26, 0.42]) {
    const geometry = new THREE.RingGeometry(radius, radius + 0.07, 16, 1, Math.PI * 0.15, Math.PI * 0.7);
    const arc = new THREE.Mesh(geometry, materials.horn);
    arc.rotation.x = -Math.PI / 2.2;
    group.add(arc);
    arcs.push(arc);
  }

  group.userData.setPhase = (phase) => {
    arcs.forEach((arc, i) => {
      const pulse = 0.75 + 0.35 * Math.sin(phase + i * 0.7);
      arc.scale.set(pulse, pulse, pulse);
    });
  };
  group.userData.setPhase(0);

  return group;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/sim/audio.test.js tests/models/hornBurst.test.js`
Expected: PASS — 8 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/sim/audio.js src/models/hornBurst.js tests/sim/audio.test.js tests/models/hornBurst.test.js
git commit -m "feat: add the two-tone horn and its visual burst"
```

---

### Task 4: Split the pedestrian out of the customer

**Files:**
- Create: `src/sim/pedestrian.js` (from `src/sim/customer.js`)
- Delete: `src/sim/customer.js`
- Modify: `src/sim/paths.js`, `src/sim/simulation.js`
- Test: `tests/sim/pedestrian.test.js` (from `tests/sim/customer.test.js`)

**Interfaces:**
- Produces: `createPedestrian(materials, layout, { index }) -> pedestrian` and `PEDESTRIAN_STATES` from `src/sim/pedestrian.js`. A `pedestrian` has `group`, `figure`, `state`, `slot`, `hasBox`, `figurePosition()`, `start(bay)`, `isDone()`, `update(dt, world)`. States: `IDLE`, `WALKING_IN`, `QUEUEING`, `AT_COUNTER`, `WALKING_OUT`, `DONE`. `world` is `{ isSlotFree(i), firstFreeSlot() }` — no bay pool, since the vehicle owns the bay.
- `src/sim/paths.js` gains `lotEntryPath(layout, bay)` and `lotExitPath(layout, bay)`; `arrivalPath` and `departurePath` are removed.

- [ ] **Step 1: Move the module and its test**

```bash
git mv src/sim/customer.js src/sim/pedestrian.js
git mv tests/sim/customer.test.js tests/sim/pedestrian.test.js
```

- [ ] **Step 2: Write the failing test**

Replace `tests/sim/pedestrian.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { createPedestrian, PEDESTRIAN_STATES } from '../../src/sim/pedestrian.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const bay = layout.sim.bays[0];

// Hands out slot 1 as if someone were already at the counter, so a lone
// pedestrian still exercises QUEUEING and the shuffle forward into slot 0.
function world() {
  return {
    isSlotFree: () => true,
    firstFreeSlot: () => 1,
  };
}

function run(pedestrian, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    pedestrian.update(dt, w);
    if (onStep) onStep();
  }
}

describe('createPedestrian', () => {
  it('starts idle and hidden', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    expect(p.state).toBe('IDLE');
    expect(p.group.visible).toBe(false);
    expect(p.isDone()).toBe(false);
  });

  it('walks in, queues, buys and walks out, in order', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    const seen = [];
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (seen[seen.length - 1] !== p.state) seen.push(p.state);
    });
    for (const state of ['WALKING_IN', 'QUEUEING', 'AT_COUNTER', 'WALKING_OUT', 'DONE']) {
      expect(seen, `missing ${state}`).toContain(state);
    }
    const order = seen.map((s) => PEDESTRIAN_STATES.indexOf(s));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it('finishes back at the car door', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90);
    expect(p.isDone()).toBe(true);
    const end = p.figurePosition();
    expect(end.x).toBeCloseTo(bay.x + layout.sim.walk.doorOffset, 1);
    expect(end.z).toBeCloseTo(bay.z, 1);
  });

  it('carries the box only after the counter', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (['IDLE', 'WALKING_IN', 'QUEUEING'].includes(p.state)) expect(p.hasBox).toBe(false);
      if (p.state === 'WALKING_OUT') expect(p.hasBox).toBe(true);
    });
  });

  it('never teleports', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    const dt = 1 / 60;
    const cap = layout.sim.speeds.walk * dt * 1.5;
    p.start(bay);
    let previous = null;
    run(p, w, 90, dt, () => {
      const at = p.figurePosition();
      if (previous && p.group.visible) {
        expect(at.distanceTo(previous)).toBeLessThanOrEqual(cap + 1e-6);
      }
      previous = at;
    });
  });

  it('can be restarted for another trip', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90);
    expect(p.isDone()).toBe(true);
    p.start(layout.sim.bays[1]);
    expect(p.state).toBe('WALKING_IN');
    expect(p.isDone()).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/sim/pedestrian.test.js`
Expected: FAIL — `createPedestrian` is not exported; the module still exports `createCustomer`.

- [ ] **Step 4: Rewrite `src/sim/pedestrian.js`**

Replace the whole file with the walking half of the old customer:

```js
import * as THREE from 'three';
import { createFigure } from '../models/figure.js';
import { createPizzaBox } from '../models/pizzaBox.js';
import { walkInPath, walkOutPath, doorPosition } from './paths.js';

export const PEDESTRIAN_STATES = Object.freeze([
  'IDLE',
  'WALKING_IN',
  'QUEUEING',
  'AT_COUNTER',
  'WALKING_OUT',
  'DONE',
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
        this.heading = Math.atan2(dx, dz);
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

export function createPedestrian(materials, layout, { index }) {
  const sim = layout.sim;
  const person = sim.people[index % sim.people.length];

  const group = new THREE.Group();
  group.name = `pedestrian-${index}`;
  group.visible = false;

  const figure = createFigure(materials, { ...person, x: 0, z: 0, facing: 0 });
  const pizzaBox = createPizzaBox(materials);
  pizzaBox.visible = false;
  group.add(figure, pizzaBox);

  const follower = createFollower();
  let state = 'IDLE';
  let timer = 0;
  let stridePhase = 0;
  let slot = null;
  let bay = null;

  const boxHeight = person.height * 0.52;
  const boxReach = person.height * 0.16;

  function setState(next) {
    state = next;
    timer = 0;
  }

  function place(x, z, heading) {
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

  return {
    group,
    figure,

    get state() {
      return state;
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

    isDone() {
      return state === 'DONE';
    },

    start(atBay) {
      bay = atBay;
      slot = null;
      pizzaBox.visible = false;
      group.visible = true;
      const door = doorPosition(layout, bay);
      place(door.x, door.z, layout.queue.facing);
      setState('WALKING_IN');
    },

    update(dt, world) {
      switch (state) {
        case 'WALKING_IN': {
          if (slot === null) {
            slot = world.firstFreeSlot();
            if (slot === null) return;
            follower.set(walkInPath(layout, bay, layout.queue.slots[slot]));
          }
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            place(follower.x, follower.z, layout.queue.facing);
            setState(slot === 0 ? 'AT_COUNTER' : 'QUEUEING');
          }
          return;
        }

        case 'QUEUEING': {
          animateLegs(dt, !follower.done);
          if (!follower.done) {
            follower.step(dt, sim.speeds.walk);
            place(follower.x, follower.z, follower.heading);
            if (follower.done) {
              place(follower.x, follower.z, layout.queue.facing);
              if (slot === 0) setState('AT_COUNTER');
            }
            return;
          }
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
            follower.set(walkOutPath(layout, bay, layout.queue.slots[slot]));
            slot = null;
            setState('WALKING_OUT');
          }
          return;
        }

        case 'WALKING_OUT': {
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            group.visible = false;
            pizzaBox.visible = false;
            setState('DONE');
          }
          return;
        }

        default:
          return;
      }
    },
  };
}
```

- [ ] **Step 5: Swap the path builders**

In `src/sim/paths.js`, delete `arrivalPath` and `departurePath` and add:

```js
export function lotEntryPath(layout, bay) {
  const P = layout.parking;
  const laneZ = layout.ground.lanes[0].z;
  return [
    { x: P.entrance.centreX, z: laneZ },
    { x: P.entrance.centreX, z: P.aisle.centreZ },
    { x: bay.x, z: P.aisle.centreZ },
    { x: bay.x, z: bay.z },
  ];
}

export function lotExitPath(layout, bay) {
  const P = layout.parking;
  const laneZ = layout.ground.lanes[0].z;
  return [
    { x: bay.x, z: bay.z },
    { x: bay.x, z: P.aisle.centreZ, reverse: true },
    { x: P.exit.centreX, z: P.aisle.centreZ },
    { x: P.exit.centreX, z: laneZ },
  ];
}
```

In `tests/sim/paths.test.js`, replace the `arrivalPath`/`departurePath` import and the four tests that use them with:

```js
  it('enters the lot from the kerb lane and stops in the bay', () => {
    const path = lotEntryPath(layout, rowA);
    expect(path[0].x).toBeCloseTo(layout.parking.entrance.centreX, 5);
    expect(path[0].z).toBeCloseTo(layout.ground.lanes[0].z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(rowA.x, 5);
    expect(last.z).toBeCloseTo(rowA.z, 5);
  });

  it('leaves the bay through the exit gap onto the kerb lane', () => {
    const path = lotExitPath(layout, rowA);
    expect(path[0].z).toBeCloseTo(rowA.z, 5);
    expect(path[1].reverse).toBe(true);
    expect(path[path.length - 1].x).toBeCloseTo(layout.parking.exit.centreX, 5);
    expect(path[path.length - 1].z).toBeCloseTo(layout.ground.lanes[0].z, 5);
  });

  it('keeps every driving waypoint on the lot, a gap, or the road', () => {
    for (const bay of layout.sim.bays) {
      for (const point of [...lotEntryPath(layout, bay), ...lotExitPath(layout, bay)]) {
        expect(onDrivable(point), `(${point.x}, ${point.z})`).toBe(true);
      }
    }
  });

  it('gives every path a positive length', () => {
    for (const bay of layout.sim.bays) {
      expect(pathLength(lotEntryPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(lotExitPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(walkInPath(layout, bay, slot))).toBeGreaterThan(0);
    }
  });
```

changing the import line to:

```js
import {
  lotEntryPath,
  lotExitPath,
  walkInPath,
  walkOutPath,
  doorPosition,
  pathLength,
} from '../../src/sim/paths.js';
```

- [ ] **Step 6: Stub the simulation so the suite runs**

`src/sim/simulation.js` still imports `createCustomer`. Replace its whole body with a pedestrian-only version for now; Task 6 gives it the traffic:

```js
import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';

export function createSimulation(materials, layout) {
  const group = new THREE.Group();
  group.name = 'simulation';

  const pedestrians = [];
  for (let i = 0; i < layout.sim.pedestrians; i++) {
    const pedestrian = createPedestrian(materials, layout, { index: i });
    pedestrians.push(pedestrian);
    group.add(pedestrian.group);
  }

  const world = {
    isSlotFree(slotIndex) {
      return !pedestrians.some((p) => p.slot === slotIndex);
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
    pedestrians,
    world,
    update(dt) {
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
    },
  };
}
```

Replace `tests/sim/simulation.test.js` entirely — the traffic assertions arrive in Task 6:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createSimulation', () => {
  it('returns a named group with one child per pedestrian', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.group).toBeInstanceOf(THREE.Group);
    expect(sim.group.name).toBe('simulation');
    expect(sim.pedestrians).toHaveLength(layout.sim.pedestrians);
  });

  it('advances without throwing', () => {
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 30; t += 1 / 60) sim.update(1 / 60);
    expect(sim.pedestrians.every((p) => p.state === 'IDLE')).toBe(true);
  });

  it('never lets two pedestrians hold the same slot', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.pedestrians.forEach((p, i) => p.start(layout.sim.bays[i]));
    for (let t = 0; t < 90; t += 1 / 60) {
      sim.update(1 / 60);
      const held = sim.pedestrians.map((p) => p.slot).filter((s) => s !== null);
      expect(new Set(held).size).toBe(held.length);
    }
  });
});
```

Also update `tests/scene.test.js`: replace the assertion referencing `layout.sim.customers` with `layout.sim.pedestrians`.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS — every file green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: split the pedestrian out of the customer"
```

---

### Task 5: The vehicle

**Files:**
- Create: `src/sim/vehicle.js`
- Test: `tests/sim/vehicle.test.js`

**Interfaces:**
- Consumes: `createCar`, `createVan`, `createBus`, `createHornBurst`; `safeSpeed`; `lotEntryPath`, `lotExitPath`; `layout.traffic`.
- Produces: `createVehicle(materials, layout, { index, type, horn }) -> vehicle` and `VEHICLE_STATES` from `src/sim/vehicle.js`. A `vehicle` has `group`, `type`, `state`, `x`, `z`, `speed`, `lane`, `bay`, `wantsPizza`, `length`, `spawn(lane, x, wantsPizza)`, `update(dt, world)`, `isActive()`. `world` is `{ leaderFor(vehicle), lanes, bays, pedestrians, laneIsClear(laneIndex, x, clearance) }`.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/vehicle.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createVehicle, VEHICLE_STATES } from '../../src/sim/vehicle.js';
import { buildLanes } from '../../src/sim/lanes.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const lanes = buildLanes(layout);
const carType = layout.traffic.types.find((t) => t.key === 'car');

function world({ bays = layout.sim.bays, pedestrian = true } = {}) {
  const pool = createPool(bays);
  return {
    lanes,
    bays: pool,
    leaderFor: () => null,
    laneIsClear: () => true,
    takePedestrian: () => (pedestrian ? { start() {}, isDone: () => true } : null),
    releasePedestrian: () => {},
  };
}

function run(vehicle, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    vehicle.update(dt, w);
    if (onStep) onStep();
  }
}

const makeCar = () =>
  createVehicle(stubMaterials(), layout, { index: 0, type: carType, horn: { play() {} } });

describe('createVehicle', () => {
  it('is inactive until spawned', () => {
    const v = makeCar();
    expect(v.isActive()).toBe(false);
    expect(v.group.visible).toBe(false);
  });

  it('drives the length of the road and then deactivates', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, false);
    expect(v.isActive()).toBe(true);
    run(v, w, 40);
    expect(v.isActive()).toBe(false);
  });

  it('keeps to its lane centre while cruising', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[2], lanes[2].spawnX, false);
    run(v, w, 5, 1 / 60, () => {
      expect(v.z).toBeCloseTo(lanes[2].z, 5);
    });
  });

  it('never steps further than its speed allows', () => {
    const v = makeCar();
    const w = world();
    const dt = 1 / 60;
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let previous = { x: v.x, z: v.z };
    run(v, w, 60, dt, () => {
      const step = Math.hypot(v.x - previous.x, v.z - previous.z);
      expect(step).toBeLessThanOrEqual(carType.cruise * dt * 1.5 + 1e-6);
      previous = { x: v.x, z: v.z };
    });
  });

  it('parks when it wants pizza and a bay is free', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let parked = false;
    run(v, w, 60, 1 / 60, () => {
      if (v.state === 'PARKED') parked = true;
    });
    expect(parked).toBe(true);
  });

  it('honks and gives up when every bay is taken', () => {
    const v = makeCar();
    const w = world({ bays: [] });
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let honkedFor = 0;
    const dt = 1 / 60;
    run(v, w, 60, dt, () => {
      if (v.state === 'WAITING') honkedFor += dt;
    });
    expect(honkedFor).toBeGreaterThan(layout.traffic.waitSeconds - 1);
    expect(honkedFor).toBeLessThan(layout.traffic.waitSeconds + 1);
  });

  it('clears its intent after balking, so it never tries again', () => {
    const v = makeCar();
    const w = world({ bays: [] });
    v.spawn(lanes[0], lanes[0].spawnX, true);
    run(v, w, 60);
    expect(v.wantsPizza).toBe(false);
  });

  it('stays in a valid state throughout', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, true);
    run(v, w, 90, 1 / 60, () => {
      expect(VEHICLE_STATES).toContain(v.state);
    });
  });

  it('slows for a stopped leader instead of driving through it', () => {
    const v = makeCar();
    const stopped = { x: lanes[0].spawnX - 20, speed: 0, length: 4.2 };
    const w = { ...world(), leaderFor: () => stopped };
    v.spawn(lanes[0], lanes[0].spawnX, false);
    run(v, w, 20);
    const gap = Math.abs(v.x - stopped.x) - (v.length + stopped.length) / 2;
    expect(gap).toBeGreaterThanOrEqual(-1e-6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/vehicle.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/vehicle.js'`.

- [ ] **Step 3: Write `src/sim/vehicle.js`**

```js
import * as THREE from 'three';
import { createCar } from '../models/car.js';
import { createVan } from '../models/van.js';
import { createBus } from '../models/bus.js';
import { createHornBurst } from '../models/hornBurst.js';
import { safeSpeed } from './following.js';
import { lotEntryPath, lotExitPath } from './paths.js';

export const VEHICLE_STATES = Object.freeze([
  'PARKED_OFF',
  'CRUISING',
  'MERGING',
  'APPROACHING_LOT',
  'WAITING',
  'ENTERING',
  'PARKED',
  'LEAVING',
]);

const BUILDERS = { car: createCar, van: createVan, bus: createBus };

// Walks a follower along {x, z} waypoints; `reverse` holds the heading so a
// car can back out of a bay without spinning round.
function createFollower() {
  return {
    path: null, index: 0, x: 0, z: 0, heading: 0, done: true,
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
        if (!target.reverse) this.heading = Math.atan2(dx, dz);
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

export function createVehicle(materials, layout, { index, type, horn }) {
  const T = layout.traffic;
  const group = new THREE.Group();
  group.name = `vehicle-${index}`;
  group.visible = false;

  const colour = type.colours[index % type.colours.length];
  const body = BUILDERS[type.model](materials, { colour, ...type });
  const burst = createHornBurst(materials);
  burst.position.y = type.height + 0.45;
  group.add(body, burst);

  const follower = createFollower();
  let state = 'PARKED_OFF';
  let lane = null;
  let x = 0;
  let z = 0;
  let speed = 0;
  let heading = 0;
  let timer = 0;
  let hornTimer = 0;
  let burstPhase = 0;
  let bay = null;
  let pedestrian = null;
  let wantsPizza = false;
  let changeFrom = 0;
  let changeTo = 0;
  let changeT = 0;

  function place() {
    group.position.set(x, 0, z);
    body.rotation.y = heading;
  }

  function rollWheels(distance) {
    const radius = type.height * 0.18;
    for (const wheel of body.userData.wheels) wheel.rotation.x -= distance / radius;
  }

  // Accelerate or brake toward a target, never jumping to it.
  function approachSpeed(target, dt) {
    const limit = target > speed ? T.follow.accel * dt : T.follow.decel * dt;
    speed += Math.max(-limit, Math.min(limit, target - speed));
    speed = Math.max(0, speed);
  }

  function gapToLeader(world) {
    const leader = world.leaderFor(vehicle);
    if (!leader) return { gap: Infinity, leaderSpeed: 0 };
    const along = Math.abs(leader.x - x);
    return {
      gap: along - (type.length + leader.length) / 2,
      leaderSpeed: leader.speed,
    };
  }

  function driveAlongLane(dt, world) {
    const { gap, leaderSpeed } = gapToLeader(world);
    const target = safeSpeed({
      gap,
      leaderSpeed,
      cruise: type.cruise,
      minGap: T.follow.minGap,
      headway: T.follow.headway,
    });
    approachSpeed(target, dt);
    const moved = speed * dt * lane.direction;
    x += moved;
    rollWheels(Math.abs(moved));
    heading = lane.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  }

  function pastDespawn() {
    return lane.direction === -1 ? x <= lane.despawnX : x >= lane.despawnX;
  }

  function beginChange(toLane) {
    changeFrom = z;
    changeTo = toLane.z;
    changeT = 0;
    lane = toLane;
    state = 'MERGING';
  }

  const vehicle = {
    group,
    type,
    length: type.length,

    get state() { return state; },
    get x() { return x; },
    get z() { return z; },
    get speed() { return speed; },
    get lane() { return lane; },
    get bay() { return bay; },
    get wantsPizza() { return wantsPizza; },

    isActive() {
      return state !== 'PARKED_OFF';
    },

    // A vehicle in the lot still remembers the lane it came from, so anything
    // reasoning about traffic must ask this rather than isActive(). Without
    // it, cars on the road brake for a car parked in a bay.
    onRoad() {
      return ['CRUISING', 'MERGING', 'APPROACHING_LOT', 'WAITING'].includes(state);
    },

    spawn(inLane, atX, pizza) {
      lane = inLane;
      x = atX;
      z = inLane.z;
      speed = type.cruise;
      wantsPizza = Boolean(pizza) && type.wantsPizza && inLane.direction === -1;
      bay = null;
      pedestrian = null;
      timer = 0;
      heading = inLane.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
      group.visible = true;
      burst.visible = false;
      state = 'CRUISING';
      place();
    },

    update(dt, world) {
      switch (state) {
        case 'PARKED_OFF':
          return;

        case 'CRUISING': {
          driveAlongLane(dt, world);
          if (pastDespawn()) {
            group.visible = false;
            state = 'PARKED_OFF';
            place();
            return;
          }
          if (wantsPizza) {
            // Distance still to run before the entrance, along the direction
            // of travel. Only -1 lanes ever seek pizza, so this is x - entrance.
            const entrance = layout.parking.entrance.centreX;
            const distance = (x - entrance) * -lane.direction;
            if (distance <= T.laneChange.mergeDistance && distance > 0) {
              if (lane.index === 0) {
                state = 'APPROACHING_LOT';
              } else if (world.laneIsClear(0, x, T.laneChange.changeClearance)) {
                beginChange(world.lanes[0]);
              }
            }
          } else {
            // Overtake: if the leader has stopped close ahead and the
            // neighbouring lane is clear, pull out and pass.
            const leader = world.leaderFor(vehicle);
            if (leader && leader.speed < 0.4 && lane.neighbour !== null) {
              const ahead = Math.abs(leader.x - x) - (type.length + leader.length) / 2;
              if (
                ahead < T.laneChange.overtakeGap &&
                world.laneIsClear(lane.neighbour, x, T.laneChange.changeClearance)
              ) {
                beginChange(world.lanes[lane.neighbour]);
              }
            }
          }
          place();
          return;
        }

        case 'MERGING': {
          driveAlongLane(dt, world);
          changeT = Math.min(1, changeT + dt / T.laneChange.changeSeconds);
          z = changeFrom + (changeTo - changeFrom) * changeT;
          if (changeT >= 1) {
            z = changeTo;
            state = wantsPizza && lane.index === 0 ? 'APPROACHING_LOT' : 'CRUISING';
          }
          place();
          return;
        }

        case 'APPROACHING_LOT': {
          const entrance = layout.parking.entrance.centreX;
          const remaining = x - entrance;
          const target = Math.min(type.cruise, Math.max(0.6, remaining * 0.9));
          approachSpeed(remaining <= 0.05 ? 0 : target, dt);
          const moved = Math.min(speed * dt, Math.max(0, remaining));
          x -= moved;
          rollWheels(moved);
          if (remaining <= 0.06) {
            x = entrance;
            speed = 0;
            bay = world.bays.acquire();
            if (bay) {
              pedestrian = world.takePedestrian();
              if (!pedestrian) {
                world.bays.release(bay);
                bay = null;
              }
            }
            if (bay) {
              follower.set(lotEntryPath(layout, bay));
              state = 'ENTERING';
            } else {
              timer = 0;
              hornTimer = 0;
              burst.visible = true;
              state = 'WAITING';
            }
          }
          place();
          return;
        }

        case 'WAITING': {
          speed = 0;
          timer += dt;
          hornTimer += dt;
          burstPhase += dt * 9;
          burst.userData.setPhase(burstPhase);
          if (hornTimer >= T.hornInterval) {
            hornTimer = 0;
            horn.play();
          }

          bay = world.bays.acquire();
          if (bay) {
            pedestrian = world.takePedestrian();
            if (!pedestrian) {
              world.bays.release(bay);
              bay = null;
            }
          }
          if (bay) {
            burst.visible = false;
            follower.set(lotEntryPath(layout, bay));
            state = 'ENTERING';
            return;
          }
          if (timer >= T.waitSeconds) {
            burst.visible = false;
            wantsPizza = false;
            state = 'CRUISING';
          }
          return;
        }

        case 'ENTERING': {
          const moved = follower.step(dt, type.cruise * 0.42);
          rollWheels(moved);
          x = follower.x;
          z = follower.z;
          heading = follower.heading;
          if (follower.done) {
            heading = bay.facing;
            pedestrian.start(bay);
            state = 'PARKED';
          }
          place();
          return;
        }

        case 'PARKED': {
          speed = 0;
          if (pedestrian.isDone()) {
            world.releasePedestrian(pedestrian);
            pedestrian = null;
            follower.set(lotExitPath(layout, bay));
            state = 'LEAVING';
          }
          place();
          return;
        }

        case 'LEAVING': {
          const moved = follower.step(dt, type.cruise * 0.42);
          rollWheels(moved);
          x = follower.x;
          z = follower.z;
          heading = follower.heading;
          if (follower.done) {
            // Wait at the mouth of the exit until there is a gap; otherwise
            // the car would appear in the lane on top of passing traffic.
            if (!world.laneIsClear(0, x, T.laneChange.changeClearance)) {
              speed = 0;
              place();
              return;
            }
            world.bays.release(bay);
            bay = null;
            wantsPizza = false;
            lane = world.lanes[0];
            z = lane.z;
            speed = 0;
            state = 'CRUISING';
          }
          place();
          return;
        }

        default:
          return;
      }
    },
  };

  return vehicle;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/sim/vehicle.test.js`
Expected: PASS — 9 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/vehicle.js tests/sim/vehicle.test.js
git commit -m "feat: add the road vehicle with lot entry, honking and balking"
```

---

### Task 6: Traffic manager and simulation

**Files:**
- Create: `src/sim/traffic.js`
- Modify: `src/sim/simulation.js`, `tests/sim/simulation.test.js`
- Test: `tests/sim/traffic.test.js`

**Interfaces:**
- Consumes: `createVehicle`, `buildLanes`, `mulberry32`, `createPool`.
- Produces: `createTraffic(materials, layout, { horn, bays, takePedestrian }) -> { group, vehicles, lanes, update(dt) }` from `src/sim/traffic.js`. `createSimulation` gains `traffic` and keeps `group`, `pedestrians`, `update(dt)`.

- [ ] **Step 1: Write the failing test**

Create `tests/sim/traffic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTraffic } from '../../src/sim/traffic.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

function build() {
  return createTraffic(stubMaterials(), layout, {
    horn: { play() {} },
    bays: createPool(layout.sim.bays),
    takePedestrian: () => ({ start() {}, isDone: () => true }),
    releasePedestrian: () => {},
  });
}

function step(traffic, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    traffic.update(dt);
    if (onStep) onStep();
  }
}

describe('createTraffic', () => {
  it('returns a named group', () => {
    const traffic = build();
    expect(traffic.group).toBeInstanceOf(THREE.Group);
    expect(traffic.group.name).toBe('traffic');
  });

  it('never lets two vehicles in a lane overlap', () => {
    const traffic = build();
    step(traffic, 120, 1 / 60, () => {
      for (const lane of traffic.lanes) {
        const inLane = traffic.vehicles
          .filter((v) => v.isActive() && v.lane === lane && v.state !== 'ENTERING' && v.state !== 'PARKED' && v.state !== 'LEAVING')
          .sort((a, b) => a.x - b.x);
        for (let i = 1; i < inLane.length; i++) {
          const gap = inLane[i].x - inLane[i - 1].x - (inLane[i].length + inLane[i - 1].length) / 2;
          expect(gap, `lane ${lane.index} overlap`).toBeGreaterThan(-0.35);
        }
      }
    });
  });

  it('keeps a populated road without exceeding its pool', () => {
    const traffic = build();
    let minimum = Infinity;
    step(traffic, 120, 1 / 60, () => {
      const active = traffic.vehicles.filter((v) => v.isActive()).length;
      minimum = Math.min(minimum, active);
      expect(active).toBeLessThanOrEqual(traffic.vehicles.length);
    });
    expect(minimum).toBeGreaterThan(0);
  });

  it('gets traffic flowing in both directions', () => {
    const traffic = build();
    step(traffic, 60);
    const directions = new Set(
      traffic.vehicles.filter((v) => v.isActive()).map((v) => v.lane.direction)
    );
    expect(directions.has(-1)).toBe(true);
    expect(directions.has(1)).toBe(true);
  });

  it('never gridlocks: every lane keeps despawning vehicles', () => {
    const traffic = build();
    const before = traffic.vehicles.map((v) => v.isActive());
    step(traffic, 150);
    const after = traffic.vehicles.map((v) => v.isActive());
    expect(before.join()).not.toBe(after.join());
    const moving = traffic.vehicles.filter((v) => v.isActive() && v.speed > 0.1);
    expect(moving.length).toBeGreaterThan(0);
  });

  it('does not grow the scene graph', () => {
    const traffic = build();
    const count = () => {
      let n = 0;
      traffic.group.traverse(() => n++);
      return n;
    };
    const before = count();
    step(traffic, 120);
    expect(count()).toBe(before);
  });

  it('lets vehicles change lanes rather than sit behind a stopped car', () => {
    const traffic = build();
    const startLanes = new Map();
    let changed = 0;
    step(traffic, 150, 1 / 60, () => {
      for (const v of traffic.vehicles) {
        if (!v.onRoad()) {
          startLanes.delete(v);
          continue;
        }
        const was = startLanes.get(v);
        if (was === undefined) startLanes.set(v, v.lane.index);
        else if (was !== v.lane.index) {
          changed++;
          startLanes.set(v, v.lane.index);
        }
      }
    });
    expect(changed).toBeGreaterThan(0);
  });

  it('sends some cars for pizza over a long run', () => {
    const traffic = build();
    let sought = 0;
    step(traffic, 180, 1 / 60, () => {
      sought += traffic.vehicles.filter(
        (v) => v.state === 'ENTERING' || v.state === 'PARKED' || v.state === 'WAITING'
      ).length;
    });
    expect(sought).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/sim/traffic.test.js`
Expected: FAIL — `Cannot find module '../../src/sim/traffic.js'`.

- [ ] **Step 3: Write `src/sim/traffic.js`**

```js
import * as THREE from 'three';
import { createVehicle } from './vehicle.js';
import { buildLanes } from './lanes.js';
import { mulberry32 } from '../utils/random.js';

// Picks a vehicle type by its share of the mix.
function pickType(types, roll) {
  let cursor = 0;
  for (const type of types) {
    cursor += type.share;
    if (roll <= cursor) return type;
  }
  return types[types.length - 1];
}

export function createTraffic(materials, layout, { horn, bays, takePedestrian, releasePedestrian }) {
  const group = new THREE.Group();
  group.name = 'traffic';
  const T = layout.traffic;
  const lanes = buildLanes(layout);
  const rng = mulberry32(T.seed);

  // One vehicle per lane slot, built up front and recycled forever.
  const vehicles = [];
  const poolSize = lanes.length * T.perLane;
  for (let i = 0; i < poolSize; i++) {
    const type = pickType(T.types, rng());
    const vehicle = createVehicle(materials, layout, { index: i, type, horn });
    vehicles.push(vehicle);
    group.add(vehicle.group);
  }

  // The vehicle immediately ahead in the same lane, or null. Only vehicles
  // actually on the road count — one parked in a bay keeps its old lane.
  function leaderFor(vehicle) {
    let best = null;
    for (const other of vehicles) {
      if (other === vehicle || !other.onRoad()) continue;
      if (other.lane !== vehicle.lane) continue;
      const ahead = (other.x - vehicle.x) * vehicle.lane.direction;
      if (ahead <= 0) continue;
      if (!best || ahead < (best.x - vehicle.x) * vehicle.lane.direction) best = other;
    }
    return best;
  }

  function laneIsClear(laneIndex, atX, clearance) {
    return !vehicles.some(
      (v) => v.onRoad() && v.lane && v.lane.index === laneIndex && Math.abs(v.x - atX) < clearance
    );
  }

  const world = { lanes, bays, leaderFor, laneIsClear, takePedestrian, releasePedestrian };

  function spawnIfRoom(lane) {
    const active = vehicles.filter((v) => v.onRoad() && v.lane === lane);
    if (active.length >= T.perLane) return;

    const rearmost = active.reduce((worst, v) => {
      const travelled = (v.x - lane.spawnX) * lane.direction;
      return worst === null || travelled < worst ? travelled : worst;
    }, null);
    if (rearmost !== null && rearmost < T.spawnGap) return;

    const free = vehicles.find((v) => !v.isActive());
    if (!free) return;
    free.spawn(lane, lane.spawnX, rng() < T.pizzaChance);
  }

  return {
    group,
    vehicles,
    lanes,
    update(dt) {
      for (const lane of lanes) spawnIfRoom(lane);
      for (const vehicle of vehicles) vehicle.update(dt, world);
    },
  };
}
```

- [ ] **Step 4: Give the simulation its traffic**

Replace `src/sim/simulation.js` with:

```js
import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';
import { createTraffic } from './traffic.js';
import { createPool } from './pool.js';

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

  const world = {
    isSlotFree(slotIndex) {
      return !pedestrians.some((p) => p.slot === slotIndex);
    },
    firstFreeSlot() {
      for (let i = 0; i < layout.queue.slots.length; i++) {
        if (world.isSlotFree(i)) return i;
      }
      return null;
    },
  };

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

  return {
    group,
    pedestrians,
    traffic,
    world,
    update(dt) {
      traffic.update(dt);
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
    },
  };
}
```

Append to `tests/sim/simulation.test.js`:

```js
  it('drives traffic and pedestrians together without throwing', () => {
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 120; t += 1 / 60) sim.update(1 / 60);
    expect(sim.traffic.vehicles.some((v) => v.isActive())).toBe(true);
  });

  it('never hands one pedestrian to two vehicles', () => {
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 180; t += 1 / 60) {
      sim.update(1 / 60);
      const busy = sim.pedestrians.filter((p) => p.state !== 'IDLE' && !p.isDone());
      expect(new Set(busy).size).toBe(busy.length);
    }
  });
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — every file green.

- [ ] **Step 6: Commit**

```bash
git add src/sim/traffic.js src/sim/simulation.js tests/sim/traffic.test.js tests/sim/simulation.test.js
git commit -m "feat: add the traffic manager and wire it into the simulation"
```

---

### Task 7: Sound control and visual verification

**Files:**
- Modify: `index.html`, `src/main.js`, `tests/main.test.js`

**Interfaces:**
- Consumes: `createHorn` from `src/sim/audio.js`; `createSimulation(materials, layout, { horn })`.

- [ ] **Step 1: Add the button and wire the horn**

In `index.html`, add inside `<body>` before the module script:

```html
    <button id="sound">click for sound</button>
```

and to the `<style>` block:

```css
      #sound {
        position: fixed; left: 16px; bottom: 16px; z-index: 1;
        font: 500 13px/1 system-ui, sans-serif; color: #2f4a35;
        background: #f6efe4; border: 1px solid #2f4a35; border-radius: 999px;
        padding: 9px 15px; cursor: pointer;
      }
      #sound[hidden] { display: none; }
```

In `src/main.js`, add the import:

```js
import { createHorn } from './sim/audio.js';
```

build the horn and pass it in, replacing the `createShop` call:

```js
const horn = createHorn(() => new (window.AudioContext || window.webkitAudioContext)());
const shop = createShop(materials, layout, { horn });
```

and wire the button after the controls are set up:

```js
const soundButton = document.getElementById('sound');
soundButton.addEventListener('click', () => {
  horn.enable();
  soundButton.hidden = true;
});
```

In `src/scene.js`, thread the option through:

```js
export function createShop(materials, layout, { horn } = {}) {
```

and pass it on:

```js
  const simulation = createSimulation(materials, layout, { horn });
```

- [ ] **Step 2: Extend the render-loop guard**

Append to `tests/main.test.js`, inside the existing `describe`:

```js
  it('builds the horn lazily behind a click', () => {
    expect(source).toMatch(/createHorn\(/);
    expect(source).toMatch(/soundButton\.addEventListener\('click'/);
    expect(source).toMatch(/horn\.enable\(\)/);
  });

  it('hands the horn to the scene', () => {
    expect(source).toMatch(/createShop\(materials, layout, \{ horn \}\)/);
  });
```

- [ ] **Step 3: Run the suite and build**

Run: `npm test && npm run build`
Expected: every test passes; `dist/` builds clean.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`

Over about two minutes, confirm:

1. All four lanes carry traffic, two directions, a mix of cars, vans and a bus.
2. Vehicles keep their distance — nothing drives through anything.
3. A car occasionally merges to the kerb lane and turns into the lot.
4. It parks in a bay, a pedestrian gets out and joins the queue.
5. The pedestrian buys a pizza and walks back; the car leaves via the exit gap.
6. With all bays full, a car stops at the entrance, shows the horn burst, and pulls away after ten seconds.
7. Traffic behind a stopped car queues or moves to lane 1 to pass.
8. Clicking "click for sound" makes the horn audible and hides the button.

If any step fails, fix the responsible module and re-run its test file.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the click-to-enable sound control"
```

---

## Verification

```bash
npm test && npm run build
```

Expected: every test passes and `dist/` builds clean.
