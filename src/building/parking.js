import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

export function createParking(materials, layout) {
  const group = new THREE.Group();
  group.name = 'parking';
  const P = layout.parking;
  const asphaltY = layout.ground.floorY.asphalt;

  // The lot surface, plus a strip through each island gap so cars entering
  // and leaving stay on asphalt rather than crossing paving.
  group.add(slab(materials.asphalt, { x: P.lot.x, z: P.lot.z, y: asphaltY }));
  for (const gap of [P.entrance, P.exit]) {
    group.add(slab(materials.asphalt, { x: gap.x, z: P.island.z, y: asphaltY }));
  }

  // Bay dividers: one line per boundary, five per row of four bays.
  const half = P.baySpacing / 2;
  const edges = [P.bayX[0] - half, ...P.bayX.map((x) => x + half)];
  for (const row of P.rows) {
    for (const edge of edges) {
      group.add(
        slab(materials.roadPaint, {
          x: [edge - P.lineWidth / 2, edge + P.lineWidth / 2],
          z: row.z,
          y: asphaltY + 0.01,
        })
      );
    }
  }

  // Kerbed planting island, broken by the entrance and exit gaps.
  const inset = P.island.bedInset;
  for (const segment of P.segments) {
    group.add(
      box(materials.stone, {
        x: segment.x,
        y: [asphaltY, asphaltY + P.island.kerbHeight],
        z: P.island.z,
      })
    );
    group.add(
      slab(materials.planting, {
        x: [segment.x[0] + inset, segment.x[1] - inset],
        z: [P.island.z[0] + inset, P.island.z[1] - inset],
        y: asphaltY + P.island.kerbHeight + 0.01,
      })
    );
  }

  return group;
}
