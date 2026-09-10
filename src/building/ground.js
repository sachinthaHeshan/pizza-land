import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

// Lays a dashed line of paint along x at a given z.
function dashedLine(group, materials, { x, z, width, dash, gap, y }) {
  for (let cursor = x[0]; cursor < x[1]; cursor += dash + gap) {
    group.add(
      slab(materials.roadPaint, {
        x: [cursor, Math.min(cursor + dash, x[1])],
        z: [z, z + width],
        y,
      })
    );
  }
}

export function createGround(materials, layout) {
  const group = new THREE.Group();
  group.name = 'ground';
  const g = layout.ground;

  group.add(slab(materials.paving, { x: g.apron.x, z: g.apron.z, y: g.apron.y }));
  group.add(slab(materials.asphalt, { x: g.road.x, z: g.road.z, y: g.road.y }));

  for (const kerb of g.kerbs) {
    group.add(box(materials.stone, { x: kerb.x, y: kerb.y, z: kerb.z }));
  }
  for (const rect of g.sidewalk) {
    group.add(slab(materials.paving, { x: rect.x, z: rect.z, y: g.floorY.paving }));
  }
  for (const rect of g.plaza) {
    group.add(slab(materials.paving, { x: rect.x, z: rect.z, y: g.floorY.paving }));
  }
  for (const rect of g.terracotta) {
    group.add(slab(materials.terracotta, { x: rect.x, z: rect.z, y: g.floorY.terracotta }));
  }
  group.add(
    slab(materials.wood, { x: g.diningFloor.x, z: g.diningFloor.z, y: g.diningFloor.y })
  );

  const marks = g.laneMarks;
  const paintY = g.road.y + 0.01;

  for (const z of marks.dashed) {
    dashedLine(group, materials, {
      x: marks.x,
      z,
      width: marks.width,
      dash: marks.dash,
      gap: marks.gap,
      y: paintY,
    });
  }

  // Solid double centre line, one stripe either side of the centre.
  for (const offset of [-marks.centreGap / 2, marks.centreGap / 2]) {
    group.add(
      slab(materials.laneCentre, {
        x: marks.x,
        z: [marks.centre + offset, marks.centre + offset + marks.width],
        y: paintY,
      })
    );
  }

  return group;
}
