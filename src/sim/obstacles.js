export const PLAYER_RADIUS = 0.25;

function wall(axis, at, span, thickness) {
  const half = thickness / 2;
  if (axis === 'x') return { x: [span[0], span[1]], z: [at - half, at + half] };
  return { x: [at - half, at + half], z: [span[0], span[1]] };
}

function splitAround(span, gap) {
  return [
    [span[0], gap[0]],
    [gap[1], span[1]],
  ].filter((part) => part[1] - part[0] > 1e-3);
}

export function playerObstacles(layout) {
  const boxes = [];
  const overhang = layout.counter.overhang;
  const counter = layout.counter;
  boxes.push({
    x: [counter.main.x[0] - overhang, counter.main.x[1] + overhang],
    z: [counter.main.z[0] - overhang, counter.main.z[1] + overhang],
  });
  boxes.push({
    x: [counter.ret.x[0] - overhang, counter.ret.x[1] + overhang],
    z: [counter.ret.z[0] - overhang, counter.main.z[0]],
  });

  const kitchen = layout.kitchen;
  boxes.push({ x: [...kitchen.backCounter.x], z: [...kitchen.backCounter.z] });
  boxes.push({ x: [...kitchen.island.x], z: [...kitchen.island.z] });
  boxes.push({ x: [...layout.oven.base.x], z: [...layout.oven.base.z] });

  const { wall: wallSpec, perimeter } = layout;
  for (const run of perimeter.runs) {
    const at = run.axis === 'x' ? run.z : run.x;
    const span = run.axis === 'x' ? run.x : run.z;
    boxes.push(wall(run.axis, at, span, wallSpec.thickness));
  }
  const pillarHalf = perimeter.pillarSize / 2;
  for (const [px, pz] of perimeter.pillars) {
    boxes.push({
      x: [px - pillarHalf, px + pillarHalf],
      z: [pz - pillarHalf, pz + pillarHalf],
    });
  }

  const dining = layout.diningWing;
  boxes.push(wall('z', dining.west.x, dining.west.z, dining.thickness));
  boxes.push(wall('x', dining.north.z, dining.north.x, dining.thickness));
  for (const span of splitAround(dining.partition.z, dining.partition.door)) {
    boxes.push(wall('z', dining.partition.x, span, dining.thickness));
  }

  const storefront = layout.storefront;
  for (const span of splitAround(storefront.x, storefront.door.x)) {
    boxes.push(wall('x', storefront.z, span, storefront.thickness));
  }

  const side = layout.sideWing;
  boxes.push(wall('z', side.footprint.x[1], side.footprint.z, side.thickness));
  boxes.push(wall('x', side.window.z, side.footprint.x, side.thickness));

  const barrier = layout.queue.barrier;
  for (const [px, pz] of barrier.posts) {
    const rad = barrier.baseRadius;
    boxes.push({ x: [px - rad, px + rad], z: [pz - rad, pz + rad] });
  }

  return boxes;
}

export function hitsObstacle(x, z, radius, obstacles) {
  const r2 = radius * radius;
  for (const box of obstacles) {
    const cx = Math.min(box.x[1], Math.max(box.x[0], x));
    const cz = Math.min(box.z[1], Math.max(box.z[0], z));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

export function slideMove(x, z, dx, dz, radius, obstacles) {
  let nx = x + dx;
  if (hitsObstacle(nx, z, radius, obstacles)) nx = x;
  let nz = z + dz;
  if (hitsObstacle(nx, nz, radius, obstacles)) nz = z;
  return { x: nx, z: nz };
}
