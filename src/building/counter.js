import * as THREE from 'three';
import { box } from '../utils/geometry.js';

export function createCounter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'counter';
  const c = layout.counter;
  const o = c.overhang;

  for (const run of [c.main, c.ret]) {
    group.add(
      box(materials.brick, {
        x: run.x,
        y: [0, c.baseHeight],
        z: run.z,
      })
    );
    group.add(
      box(materials.wood, {
        x: [run.x[0] - o, run.x[1] + o],
        y: [c.baseHeight, c.topHeight],
        z: [run.z[0] - o, run.z[1] + o],
      })
    );
  }

  // Vertical wood slats dress the customer-facing side of the main run.
  const slatWidth = 0.16;
  const gap = 0.06;
  for (let x = c.main.x[0]; x < c.main.x[1] - slatWidth; x += slatWidth + gap) {
    group.add(
      box(materials.woodDark, {
        x: [x, x + slatWidth],
        y: [0.06, c.baseHeight - 0.04],
        z: [c.main.z[1], c.main.z[1] + 0.05],
      })
    );
  }

  return group;
}
