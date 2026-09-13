import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPedestrian, PEDESTRIAN_STATES } from '../../src/sim/pedestrian.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';
import { seatPosition } from '../../src/sim/paths.js';
import { LEG_PROPORTIONS } from '../../src/models/figure.js';

const bay = layout.sim.bays[0];

// Hands out slot 1 as if someone were already at the counter, so a lone
// pedestrian still exercises QUEUEING and the shuffle forward into slot 0.
function world() {
  return {
    isSlotFree: () => true,
    queueLength: () => 1,
    enqueueSlot: () => 1,
    canServe: () => true,
    claimSeat: () => null,
    sitDown: () => true,
    recordSale(pedestrian) {
      pedestrian.showBox();
    },
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

  it('records a sale when the pizza is handed over', () => {
    let sales = 0;
    const w = world();
    w.recordSale = () => sales++;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (['WALKING_IN', 'QUEUEING', 'AT_COUNTER'].includes(p.state)) expect(sales).toBe(0);
    });
    expect(sales).toBe(1);
  });

  it('holds the sale while the cashier is away from the sell zone', () => {
    let sales = 0;
    const w = world();
    w.canServe = () => false;
    w.recordSale = () => sales++;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    run(p, w, 90);
    expect(p.state).toBe('AT_COUNTER');
    expect(p.hasBox).toBe(false);
    expect(sales).toBe(0);
  });

  it('keeps serving progress when the cashier steps away and comes back', () => {
    let sales = 0;
    let cashierIn = true;
    const w = world();
    w.canServe = () => cashierIn;
    w.recordSale = () => sales++;
    const serve = layout.sim.serveSeconds;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    for (let t = 0; t < 90 && p.state !== 'AT_COUNTER'; t += 1 / 60) p.update(1 / 60, w);
    expect(p.state).toBe('AT_COUNTER');

    run(p, w, serve * 0.6);
    cashierIn = false;
    run(p, w, 10);
    expect(p.state).toBe('AT_COUNTER');
    expect(sales).toBe(0);

    // Short of a full serve on its own, so this only sells if the first
    // stint's progress was kept rather than reset.
    cashierIn = true;
    run(p, w, serve * 0.5);
    expect(sales).toBe(1);
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

  const person = layout.sim.people[0];

  function dineInWorld(claim = { table: 0, seat: 0 }) {
    let given = false;
    const sat = [];
    return {
      ...world(),
      sat,
      claimSeat: () => {
        if (given) return null;
        given = true;
        return claim;
      },
      sitDown: (table, seat) => {
        sat.push({ table, seat });
        return true;
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
    const seen = new Set();
    p.start(bay);
    // Which route they took, not where they ended up: serving takes well
    // under a second, so a fixed run length would only catch the last state.
    run(p, world(), 30, 1 / 60, () => seen.add(p.state));
    expect(seen.has('AT_COUNTER')).toBe(true);
    expect(seen.has('WALKING_TO_TABLE')).toBe(false);
    expect(seen.has('SEATED')).toBe(false);
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

  it('ignores leaveTable unless it is on its way to a table or seated', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    p.leaveTable();
    expect(p.state).toBe('WALKING_IN');
  });

  it('tells the room it has sat down, once, on arrival', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = dineInWorld({ table: 3, seat: 1 });
    p.start(bay);
    // Halfway through the walk nobody is in the chair yet, so the room must
    // not have been told: that is what keeps patience off the walk.
    run(p, w, 5);
    expect(p.state).toBe('WALKING_TO_TABLE');
    expect(w.sat).toEqual([]);

    run(p, w, 40);
    expect(p.state).toBe('SEATED');
    expect(w.sat).toEqual([{ table: 3, seat: 1 }]);
  });

  it('turns round mid-walk when its table empties before it arrives', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = dineInWorld({ table: 2, seat: 0 });
    p.start(bay);
    run(p, w, 5);
    expect(p.state).toBe('WALKING_TO_TABLE');
    const turnedAt = p.figurePosition();

    p.leaveTable();
    expect(p.state).toBe('WALKING_OUT');
    expect(p.table).toBeNull();
    // No teleport to a chair it never reached.
    expect(p.figurePosition().distanceTo(turnedAt)).toBeLessThan(1e-6);

    run(p, w, 60);
    expect(p.isDone()).toBe(true);
    // It never sat, so the room was never told anybody was in the chair.
    expect(w.sat).toEqual([]);
  });
});
