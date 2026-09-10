import * as THREE from 'three';
import { box, yOnFloor } from '../utils/geometry.js';

export function createCounter(materials, layout) {
  const group = new THREE.Group();
  group.name = 'counter';
  const c = layout.counter;
  const o = c.overhang;
  const baseY = yOnFloor([0, c.baseHeight], layout.floorContact);

  // L-shaped brick base: the return leg only fills the span below the main run
  // so the corner overlap is not meshed twice.
  group.add(
    box(materials.brick, {
      x: c.main.x,
      y: baseY,
      z: c.main.z,
    })
  );
  group.add(
    box(materials.brick, {
      x: c.ret.x,
      y: baseY,
      z: [c.ret.z[0], c.main.z[0]],
    })
  );

  group.add(
    box(materials.wood, {
      x: [c.main.x[0] - o, c.main.x[1] + o],
      y: [c.baseHeight, c.topHeight],
      z: [c.main.z[0] - o, c.main.z[1] + o],
    })
  );
  group.add(
    box(materials.wood, {
      x: [c.ret.x[0] - o, c.ret.x[1] + o],
      y: [c.baseHeight, c.topHeight],
      z: [c.ret.z[0] - o, c.main.z[0]],
    })
  );

  // Vertical wood slats dress the customer-facing side of the main run.
  const slatWidth = 0.16;
  const gap = 0.06;
  for (let x = c.main.x[0]; x < c.main.x[1] - slatWidth; x += slatWidth + gap) {
    group.add(
      box(materials.woodDark, {
        x: [x, x + slatWidth],
        y: [layout.floorContact + 0.05, c.baseHeight - 0.04],
        z: [c.main.z[1], c.main.z[1] + 0.05],
      })
    );
  }

  return group;
}
