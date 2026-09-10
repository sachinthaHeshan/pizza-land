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
