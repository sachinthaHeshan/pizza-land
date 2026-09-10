import * as THREE from 'three';
import { box, wallRun, awning, yOnFloor } from '../utils/geometry.js';

export function createSideWing(materials, layout) {
  const group = new THREE.Group();
  group.name = 'sideWing';
  const s = layout.sideWing;
  const t = s.thickness;
  const w = s.window;
  const plinthY = yOnFloor([0, s.plinthHeight - layout.surfaceEps], layout.floorContact);

  // East face: solid.
  group.add(
    wallRun(materials.brick, {
      axis: 'z',
      at: s.footprint.x[1],
      span: s.footprint.z,
      y: plinthY,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'z',
      at: s.footprint.x[1],
      span: s.footprint.z,
      y: [s.plinthHeight, s.wallHeight],
      thickness: t,
    })
  );

  // Front face: plinth, header, and piers either side of the window.
  const bay = [w.centerX - w.width / 2, w.centerX + w.width / 2];
  const head = w.sill + w.height;

  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: w.z,
      span: s.footprint.x,
      y: plinthY,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.plaster, {
      axis: 'x',
      at: w.z,
      span: s.footprint.x,
      y: [head, s.wallHeight],
      thickness: t,
    })
  );
  for (const pier of [[s.footprint.x[0], bay[0]], [bay[1], s.footprint.x[1]]]) {
    if (pier[1] - pier[0] <= 0.001) continue;
    group.add(
      wallRun(materials.plaster, {
        axis: 'x',
        at: w.z,
        span: pier,
        y: [s.plinthHeight, head],
        thickness: t,
      })
    );
  }

  group.add(
    box(materials.glass, {
      x: bay,
      y: [w.sill, head],
      z: [w.z - 0.03, w.z + 0.03],
    })
  );
  const glow = box(materials.glow, {
    x: [bay[0] + 0.08, bay[1] - 0.08],
    y: [w.sill + 0.08, head - 0.08],
    z: [w.z - 0.16, w.z - 0.13],
  });
  glow.renderOrder = 2;
  group.add(glow);
  group.add(
    box(materials.greenPaint, {
      x: [bay[0] - 0.08, bay[1] + 0.08],
      y: [w.sill - 0.1, w.sill],
      z: [w.z - t / 2 - 0.06, w.z + t / 2 + 0.06],
    })
  );

  group.add(
    awning(materials.stripe, {
      x: s.awning.x,
      wallZ: w.z + t / 2,
      wallY: s.awning.wallY,
      frontZ: s.awning.frontZ,
      frontY: s.awning.frontY,
      valance: s.awning.valance,
    })
  );

  group.userData.windowAnchor = new THREE.Vector3(w.centerX, (w.sill + head) / 2, w.z - 0.6);

  return group;
}
