import * as THREE from 'three';
import { expect } from 'vitest';

export function boundsOf(object3D) {
  object3D.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object3D);
}

export function expectFinite(box) {
  for (const v of [box.min, box.max]) {
    for (const axis of ['x', 'y', 'z']) {
      expect(Number.isFinite(v[axis]), `${axis} is ${v[axis]}`).toBe(true);
    }
  }
}

export function expectWithin(box, envelope, tol = 0.5) {
  const axes = ['x', 'y', 'z'];
  axes.forEach((axis, i) => {
    expect(box.min[axis], `min ${axis}`).toBeGreaterThanOrEqual(envelope.min[i] - tol);
    expect(box.max[axis], `max ${axis}`).toBeLessThanOrEqual(envelope.max[i] + tol);
  });
}
