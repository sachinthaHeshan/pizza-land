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

// Claiming only reserves the chair; the table starts wanting a pizza when the
// walker actually arrives. Tests that need a WAITING table do both.
function seatOne(room) {
  const claim = room.claimSeat();
  if (claim) room.sit(claim.table, claim.seat);
  return claim;
}

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

  it('reserves a chair without starting the wait', () => {
    const room = seatingRoom();
    expect(room.claimSeat()).toEqual({ table: 0, seat: 0 });
    expect(room.tables[0].seats[0]).toBe(true);
    // The walk from the car takes ~14 s. Starting patience back at the car
    // burns a quarter of it before anybody is even in the chair.
    expect(room.tables[0].state).toBe('EMPTY');
    expect(room.tables[0].secondsLeft).toBe(0);
    expect(room.wants(0)).toBe(false);
  });

  it('starts the table waiting only when somebody sits', () => {
    const room = seatingRoom();
    const claim = room.claimSeat();
    expect(room.sit(claim.table, claim.seat)).toBe(true);
    expect(room.tables[0].state).toBe('WAITING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.patienceSeconds);
    expect(room.wants(0)).toBe(true);
  });

  it('never ages a table whose only chair is reserved but empty', () => {
    const room = seatingRoom();
    room.claimSeat();
    expect(room.update(layout.dining.patienceSeconds * 3)).toEqual([]);
    expect(room.tables[0].state).toBe('EMPTY');
    expect(room.tables[0].seats[0]).toBe(true);
  });

  it('gives a walker who arrives after the table emptied a fresh full wait', () => {
    const room = seatingRoom();
    seatOne(room);
    const late = room.claimSeat();
    expect(late).toEqual({ table: 0, seat: 1 });
    // The first diner's patience runs out while the second is still walking.
    expect(room.update(layout.dining.patienceSeconds + 0.1)).toEqual([0]);
    expect(room.tables[0].state).toBe('EMPTY');

    expect(room.sit(late.table, late.seat)).toBe(true);
    expect(room.tables[0].state).toBe('WAITING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.patienceSeconds);
    expect(room.tables[0].seats[1]).toBe(true);
  });

  it('refuses to sit anybody down at a table that is already eating', () => {
    const room = seatingRoom();
    seatOne(room);
    const late = room.claimSeat();
    expect(room.serve(0)).toBe(true);
    expect(room.sit(late.table, late.seat)).toBe(false);
    expect(room.tables[0].state).toBe('EATING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.eatSeconds);
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
    seatOne(room);
    expect(room.serve(0)).toBe(true);
    expect(room.claimSeat()).toEqual({ table: 1, seat: 0 });
  });

  it('serves only a waiting table', () => {
    const room = seatingRoom();
    expect(room.serve(0)).toBe(false);
    seatOne(room);
    expect(room.serve(0)).toBe(true);
    expect(room.tables[0].state).toBe('EATING');
    expect(room.tables[0].secondsLeft).toBe(layout.dining.eatSeconds);
    expect(room.serve(0)).toBe(false);
    expect(room.wants(0)).toBe(false);
  });

  it('empties a table when the meal finishes, freeing its seats once', () => {
    const room = seatingRoom();
    seatOne(room);
    seatOne(room);
    room.serve(0);
    expect(room.update(layout.dining.eatSeconds - 0.1)).toEqual([]);
    expect(room.update(0.2)).toEqual([0]);
    expect(room.tables[0].state).toBe('EMPTY');
    expect(room.tables[0].seats.every((taken) => taken === false)).toBe(true);
    expect(room.update(10)).toEqual([]);
  });

  it('empties a table nobody serves, so the room cannot deadlock', () => {
    const room = seatingRoom();
    seatOne(room);
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
    seatOne(room);
    seatOne(room);
    seatOne(room);
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
