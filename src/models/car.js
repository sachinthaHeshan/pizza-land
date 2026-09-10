import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// A stylised hatchback, built nose-toward +Z so a heading can be applied as
// rotation.y = atan2(dir.x, dir.z). Sits with its tyres on y = 0.
export function createCar(materials, { colour, length, width, height }) {
  const group = new THREE.Group();
  group.name = 'car';

  const halfL = length / 2;
  const halfW = width / 2;
  const wheelRadius = height * 0.21;
  const bodyBottom = wheelRadius * 0.75;
  const bodyTop = height * 0.7;
  const body = materials[colour];

  group.add(
    box(body, {
      x: [-halfW, halfW],
      y: [bodyBottom, bodyTop],
      z: [-halfL, halfL],
    })
  );

  // Cabin, set back from the nose.
  const cabinFront = halfL * 0.35;
  const cabinBack = -halfL * 0.62;
  group.add(
    box(body, {
      x: [-halfW * 0.92, halfW * 0.92],
      y: [bodyTop, height],
      z: [cabinBack, cabinFront],
    })
  );

  // Glasshouse: a slightly inset dark band around the cabin.
  group.add(
    box(materials.carGlass, {
      x: [-halfW * 0.95, halfW * 0.95],
      y: [bodyTop + (height - bodyTop) * 0.18, height - (height - bodyTop) * 0.22],
      z: [cabinBack + 0.06, cabinFront - 0.06],
    })
  );

  for (const side of [-1, 1]) {
    group.add(
      box(materials.headlight, {
        x: [side * halfW * 0.72 - 0.16, side * halfW * 0.72 + 0.16],
        y: [bodyTop - 0.26, bodyTop - 0.06],
        z: [halfL - 0.05, halfL + 0.02],
      })
    );
  }

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, width * 0.14, 16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - width * 0.06), wheelRadius, sz * halfL * 0.62);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  group.userData.wheels = wheels;

  return group;
}
