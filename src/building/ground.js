import * as THREE from 'three';
import { box, slab } from '../utils/geometry.js';

export function createGround(materials, layout) {
  const group = new THREE.Group();
  group.name = 'ground';
  const g = layout.ground;

  group.add(slab(materials.paving, { x: g.apron.x, z: g.apron.z, y: g.apron.y }));
  group.add(slab(materials.asphalt, { x: g.road.x, z: g.road.z, y: g.road.y }));
  group.add(box(materials.stone, { x: g.curb.x, y: g.curb.y, z: g.curb.z }));

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
    slab(materials.wood, {
      x: g.diningFloor.x,
      z: g.diningFloor.z,
      y: g.diningFloor.y,
    })
  );

  const paintY = g.road.y + 0.01;
  const p = g.parking;
  for (let i = 0; i < p.count; i++) {
    const x = p.startX + i * p.spacing;
    group.add(
      slab(materials.roadPaint, { x: [x, x + p.stripeWidth], z: p.z, y: paintY })
    );
  }

  const d = g.laneDivider;
  for (let x = d.x[0]; x < d.x[1]; x += d.dash + d.gap) {
    group.add(
      slab(materials.roadPaint, {
        x: [x, Math.min(x + d.dash, d.x[1])],
        z: [d.z, d.z + d.width],
        y: paintY,
      })
    );
  }

  return group;
}
