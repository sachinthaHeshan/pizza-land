import * as THREE from 'three';
import { box, wallRun, yOnFloor, trimSpanAtPillars, meetInnerFace } from '../utils/geometry.js';
import { createDiningTable } from '../models/diningTable.js';

export function createDiningWing(materials, layout) {
  const group = new THREE.Group();
  group.name = 'diningWing';
  const d = layout.diningWing;
  const t = d.thickness;
  const floor = layout.floorContact;
  const plinthY = yOnFloor([0, d.plinthHeight - layout.surfaceEps], floor);
  const partitionY = yOnFloor([0, d.wallHeight], floor);

  // West wall owns its corners; it only yields to perimeter corner pillars.
  const west = d.west;
  const westZ =
    trimSpanAtPillars(west.z, {
      axis: 'z',
      at: west.x,
      pillars: layout.perimeter.pillars,
      size: layout.perimeter.pillarSize,
    }) ?? west.z;

  // North wall butts into the west face and the partition face.
  const northX = meetInnerFace(meetInnerFace(d.north.x, t, 'start'), t, 'end');

  group.add(
    wallRun(materials.brick, {
      axis: 'z',
      at: west.x,
      span: westZ,
      y: plinthY,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'z',
      at: west.x,
      span: westZ,
      y: [d.windows.head, d.wallHeight],
      thickness: t,
    })
  );

  const piers = [];
  let cursor = westZ[0];
  for (const bay of d.windows.bays) {
    piers.push([cursor, bay[0]]);
    cursor = bay[1];
  }
  piers.push([cursor, westZ[1]]);

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

  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: d.north.z,
      span: northX,
      y: plinthY,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'x',
      at: d.north.z,
      span: northX,
      y: [d.plinthHeight, d.wallHeight],
      thickness: t,
    })
  );

  const p = d.partition;
  const segments = [
    meetInnerFace([p.z[0], p.door[0]], t, 'start'),
    meetInnerFace([p.door[1], p.z[1]], t, 'end'),
  ];
  for (const segment of segments) {
    if (!segment) continue;
    group.add(
      wallRun(materials.wood, {
        axis: 'z',
        at: p.x,
        span: segment,
        y: partitionY,
        thickness: t,
      })
    );
  }
  group.add(
    wallRun(materials.wood, {
      axis: 'z',
      at: p.x,
      span: p.door,
      y: [p.lintelY, d.wallHeight],
      thickness: t,
    })
  );

  for (const spot of layout.dining.tables) {
    group.add(createDiningTable(materials, layout, spot));
  }

  return group;
}
