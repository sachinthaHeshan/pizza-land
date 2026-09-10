import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A boxy delivery van, built nose-toward +Z and standing on y = 0, matching
// createCar so the same heading maths applies.
export function createVan(materials, { length, width, height }) {
  const group = new THREE.Group();
  group.name = 'van';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.16;
  const bodyBottom = wheelRadius * 0.8;
  const body = materials.vanBody;

  // One tall box for the load area, a shorter nose in front of it.
  group.add(
    box(body, { x: [-halfW, halfW], y: [bodyBottom, height], z: [-halfL, halfL * 0.35] })
  );
  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, height * 0.62],
      z: [halfL * 0.35, halfL],
    })
  );

  group.add(
    box(materials.carGlass, {
      x: [-halfW * 0.94, halfW * 0.94],
      y: [height * 0.36, height * 0.58],
      z: [halfL * 0.36, halfL - 0.05],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.68 - 0.16, side * halfW * 0.68 + 0.16],
        y: [height * 0.2, height * 0.32],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  // 16 radial segments, not 14: divisible by four, so a vertex rather than
  // a flat faces down once the wheel is rotated onto its axle and the tyre
  // sits flush on the road.
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.13, 16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.1), wheelRadius, sz * halfL * 0.62);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  group.userData.wheels = wheels;

  return group;
}
