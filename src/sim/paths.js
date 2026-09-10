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
