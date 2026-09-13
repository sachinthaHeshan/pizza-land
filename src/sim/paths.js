// Every waypoint is derived from layout; nothing is hard-coded. Points are
// plain {x, z} so the simulation can interpolate them without allocating
// vectors, and a `reverse` flag marks segments the car backs along.
//
// `bay` is always a descriptor from layout.sim.bays: { x, z, facing, row }.

export function doorPosition(layout, bay) {
  return { x: bay.x + layout.sim.walk.doorOffset, z: bay.z };
}

// Marked slots first; anyone past that stands on the same line behind the
// last person so they walk to the queue instead of waiting at the car.
export function slotPosition(layout, index) {
  const slots = layout.queue.slots;
  if (index < slots.length) return slots[index];
  const last = slots[slots.length - 1];
  const prev = slots[slots.length - 2];
  const extra = index - (slots.length - 1);
  return [last[0] + (last[0] - prev[0]) * extra, last[1] + (last[1] - prev[1]) * extra];
}

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

export function walkInPath(layout, bay, slot) {
  const { walk } = layout.sim;
  const P = layout.parking;
  const door = doorPosition(layout, bay);

  // Row 0 noses toward the shop, so its occupant walks straight out the
  // front. Everyone else routes along the aisle to the walkway at x = 0 — a
  // bay boundary, so it is never blocked by a parked car.
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

// Seat 0 sits on the +z side of its table, seat 1 on the -z side. Both face
// the table, which is what puts a diner's front toward this camera.
//
// Two seats per table is baked in here, not a free knob: `seatsPerTable` is
// 2, `src/models/diningTable.js` builds exactly two chairs, and a third index
// would land a diner on top of seat 1's chair. Adding seats means changing
// both places together.
export function seatPosition(layout, table, seat) {
  const spot = layout.dining.tables[table];
  const offset = layout.dining.chair.offset;
  return { x: spot.x, z: spot.z + (seat === 0 ? offset : -offset) };
}

// The usual walk in as far as the plaza, then through the storefront door and
// across the room to the chair. The threshold is its own waypoint so walkers
// turn inside the doorway instead of cutting the corner through the wall.
//
// Inside, the route runs down the aisle beside the table — its delivery
// zone's own centre line, which is by construction clear of every tabletop —
// and only turns in along the seat's z. Coming down the seat's x instead
// means coming down the table's x, which walks a back-row diner straight
// through the front table, both its chairs and anyone sitting there.
export function walkToSeatPath(layout, bay, table, seat) {
  const { walk } = layout.sim;
  const doorX = layout.dining.doorX;
  const doorZ = layout.storefront.z;
  const spot = layout.dining.tables[table];
  const aisleX = (spot.zone.x[0] + spot.zone.x[1]) / 2;
  const seatAt = seatPosition(layout, table, seat);
  return [
    ...walkInPath(layout, bay, [doorX, walk.plazaZ]).slice(0, -1),
    { x: doorX, z: doorZ },
    { x: aisleX, z: doorZ - 1.0 },
    { x: aisleX, z: seatAt.z },
    { x: seatAt.x, z: seatAt.z },
  ];
}

export function walkFromSeatPath(layout, bay, table, seat) {
  return [...walkToSeatPath(layout, bay, table, seat)].reverse();
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}
