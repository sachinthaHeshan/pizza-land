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
    // This only reserves the chair — see sit() for when the table starts
    // asking for a pizza.
    claimSeat() {
      if (rng() >= d.dineInChance) return null;
      for (let table = 0; table < tables.length; table++) {
        const spot = tables[table];
        if (spot.state === 'EATING') continue;
        const seat = spot.seats.indexOf(false);
        if (seat === -1) continue;
        spot.seats[seat] = true;
        return { table, seat };
      }
      return null;
    },

    // Called when a walker actually reaches the chair. A table only starts
    // wanting a pizza once somebody is in it — starting the timer when they
    // decide, back at the car, burns a quarter of their patience on the walk,
    // and can expire the table before anybody has arrived to be released.
    sit(table, seat) {
      const spot = tables[table];
      if (spot.state === 'EATING') return false;
      spot.seats[seat] = true;
      if (spot.state === 'EMPTY') {
        spot.state = 'WAITING';
        spot.secondsLeft = d.patienceSeconds;
      }
      return true;
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
