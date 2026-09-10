// Every waypoint is derived from layout; nothing is hard-coded. Points are
// plain {x, z} so the simulation can interpolate them without allocating
// vectors, and a `reverse` flag marks segments the car backs along.
//
// `bay` is always a descriptor from layout.sim.bays: { x, z, facing, row }.

export function doorPosition(layout, bay) {
  return { x: bay.x + layout.sim.walk.doorOffset, z: bay.z };
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

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return total;
}
