import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A single-deck bus: one long slab with a window band and six wheels.
export function createBus(materials, { length, width, height }) {
  const group = new THREE.Group();
  group.name = 'bus';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.14;
  const bodyBottom = wheelRadius * 0.9;
  const body = materials.busBody;

  // The body sits a hair inside so the window band, which is proud of it,
  // is what defines the declared width.
  group.add(
    box(body, { x: [-halfW + 0.02, halfW - 0.02], y: [bodyBottom, height], z: [-halfL, halfL] })
  );

  // Window band down both sides and across the front.
  group.add(
    box(materials.carGlass, {
      x: [-halfW, halfW],
      y: [height * 0.52, height * 0.82],
      z: [-halfL + 0.5, halfL - 0.3],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.7 - 0.18, side * halfW * 0.7 + 0.18],
        y: [height * 0.2, height * 0.32],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  // 16 radial segments, not 14: divisible by four, so a vertex rather than
  // a flat faces down once the wheel is rotated onto its axle and the tyre
  // sits flush on the road.
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.12, 16);
  for (const sx of [-1, 1]) {
    for (const sz of [0.68, -0.34, -0.62]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.09), wheelRadius, sz * halfL);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  group.userData.wheels = wheels;

  return group;
}
