import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

export function createDiningWing(materials, layout) {
  const group = new THREE.Group();
  group.name = 'diningWing';
  const d = layout.diningWing;
  const t = d.thickness;

  // West wall: continuous plinth, header band, and piers around the window bays.
  const west = d.west;
  group.add(
    wallRun(materials.brick, {
      axis: 'z',
      at: west.x,
      span: west.z,
      y: [0, d.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'z',
      at: west.x,
      span: west.z,
      y: [d.windows.head, d.wallHeight],
      thickness: t,
    })
  );

  const piers = [];
  let cursor = west.z[0];
  for (const bay of d.windows.bays) {
    piers.push([cursor, bay[0]]);
    cursor = bay[1];
  }
  piers.push([cursor, west.z[1]]);

  for (const pier of piers) {
    if (pier[1] - pier[0] <= 0.001) continue;
    group.add(
      wallRun(materials.plaster, {
        axis: 'z',
        at: west.x,
        span: pier,
        y: [d.plinthHeight, d.windows.head],
        thickness: t,
      })
    );
  }

  for (const bay of d.windows.bays) {
    const pane = box(materials.glass, {
      x: [west.x - 0.02, west.x + 0.02],
      y: [d.windows.sill, d.windows.head],
      z: bay,
    });
    group.add(pane);
    group.add(
      wallRun(materials.greenPaint, {
        axis: 'z',
        at: west.x,
        span: bay,
        y: [d.windows.sill - 0.1, d.windows.sill],
        thickness: t + 0.06,
      })
    );
  }

  // North wall: solid.
  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: d.north.z,
      span: d.north.x,
      y: [0, d.plinthHeight],
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'x',
      at: d.north.z,
      span: d.north.x,
      y: [d.plinthHeight, d.wallHeight],
      thickness: t,
    })
  );

  // Partition with a doorway.
  const p = d.partition;
  const segments = [
    [p.z[0], p.door[0]],
    [p.door[1], p.z[1]],
  ];
  for (const segment of segments) {
    if (segment[1] - segment[0] <= 0.001) continue;
    group.add(
      wallRun(materials.woodDark, {
        axis: 'z',
        at: p.x,
        span: segment,
        y: [0, d.wallHeight],
        thickness: t,
      })
    );
  }
  group.add(
    wallRun(materials.woodDark, {
      axis: 'z',
      at: p.x,
      span: p.door,
      y: [p.lintelY, d.wallHeight],
      thickness: t,
    })
  );

  return group;
}
