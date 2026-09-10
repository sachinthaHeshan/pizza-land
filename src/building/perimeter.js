import * as THREE from 'three';
import { box, wallRun, yOnFloor } from '../utils/geometry.js';

function trimSpan(span, axis, at, pillars, inset) {
  let [start, end] = span;
  for (const [px, pz] of pillars) {
    const onRun =
      axis === 'x' ? Math.abs(pz - at) < 0.01 : Math.abs(px - at) < 0.01;
    if (!onRun) continue;
    const edge = axis === 'x' ? px : pz;
    if (Math.abs(edge - start) < 0.01) start += inset;
    if (Math.abs(edge - end) < 0.01) end -= inset;
  }
  return [start, end];
}

export function createPerimeter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'perimeter';
  const { wall, perimeter } = layout;
  const pillarInset = perimeter.pillarSize / 2;
  const wallY = yOnFloor([0, wall.height], layout.floorContact);
  const pillarY = yOnFloor([0, perimeter.pillarHeight], layout.floorContact);

  for (const run of perimeter.runs) {
    const at = run.axis === 'x' ? run.z : run.x;
    const along = trimSpan(
      run.axis === 'x' ? run.x : run.z,
      run.axis,
      at,
      perimeter.pillars,
      pillarInset
    );
    if (along[1] - along[0] <= 0.001) continue;

    group.add(
      wallRun(materials.brick, {
        axis: run.axis,
        at,
        span: along,
        y: wallY,
        thickness: wall.thickness,
      })
    );
    group.add(
      wallRun(materials.stone, {
        axis: run.axis,
        at,
        span: along,
        y: [wall.height, wall.height + wall.capHeight],
        thickness: wall.capWidth,
      })
    );
  }

  const half = perimeter.pillarSize / 2;
  const capHalf = perimeter.pillarCapWidth / 2;
  for (const [px, pz] of perimeter.pillars) {
    group.add(
      box(materials.brick, {
        x: [px - half, px + half],
        y: pillarY,
        z: [pz - half, pz + half],
      })
    );
    group.add(
      box(materials.stone, {
        x: [px - capHalf, px + capHalf],
        y: [perimeter.pillarHeight, perimeter.pillarHeight + wall.capHeight],
        z: [pz - capHalf, pz + capHalf],
      })
    );
  }

  return group;
}
