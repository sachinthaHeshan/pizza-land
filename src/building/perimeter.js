import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

export function createPerimeter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'perimeter';
  const { wall, perimeter } = layout;

  for (const run of perimeter.runs) {
    const along = run.axis === 'x' ? run.x : run.z;
    const at = run.axis === 'x' ? run.z : run.x;

    group.add(
      wallRun(materials.brick, {
        axis: run.axis,
        at,
        span: along,
        y: [0, wall.height],
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
        y: [0, perimeter.pillarHeight],
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
