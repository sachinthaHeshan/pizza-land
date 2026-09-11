import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { panTargetLimits, clampPanTarget } from '../../src/ui/panBounds.js';
import { layout } from '../../src/layout.js';

function makeCamera({ zoom = 1, aspect = 16 / 9 } = {}) {
  const c = layout.camera;
  const target = new THREE.Vector3(...c.target);
  const offset = new THREE.Vector3(...c.direction)
    .normalize()
    .multiplyScalar(c.distance);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  camera.zoom = zoom;
  const half = c.frustumSize / 2;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return { camera, target };
}

function limitsFor({ zoom = 1, aspect = 16 / 9 } = {}) {
  const { camera, target } = makeCamera({ zoom, aspect });
  return panTargetLimits({
    camera,
    target,
    bounds: layout.envelopes.ground,
    padding: layout.camera.panPadding ?? 0,
    preferred: { x: target.x, y: target.y, z: target.z },
  });
}

describe('panTargetLimits', () => {
  it('shrinks the allowed target range when zoomed out', () => {
    const zoomedOut = limitsFor({ zoom: 1 });
    const zoomedIn = limitsFor({ zoom: 2 });

    expect(zoomedIn.x[1] - zoomedIn.x[0]).toBeGreaterThan(
      zoomedOut.x[1] - zoomedOut.x[0]
    );
    expect(zoomedIn.z[1] - zoomedIn.z[0]).toBeGreaterThan(
      zoomedOut.z[1] - zoomedOut.z[0]
    );
  });

  it('keeps the default camera target inside the limits at min zoom', () => {
    const limits = limitsFor({ zoom: layout.camera.minZoom });
    const [tx, ty, tz] = layout.camera.target;

    expect(tx).toBeGreaterThanOrEqual(limits.x[0]);
    expect(tx).toBeLessThanOrEqual(limits.x[1]);
    expect(ty).toBeGreaterThanOrEqual(limits.y[0]);
    expect(ty).toBeLessThanOrEqual(limits.y[1]);
    expect(tz).toBeGreaterThanOrEqual(limits.z[0]);
    expect(tz).toBeLessThanOrEqual(limits.z[1]);
  });

  it('allows pan along both isometric axes at min zoom', () => {
    const limits = limitsFor({ zoom: 1, aspect: 16 / 9 });

    expect(limits.x[1] - limits.x[0]).toBeGreaterThan(0);
    expect(limits.z[1] - limits.z[0]).toBeGreaterThan(0);
  });
});

describe('clampPanTarget', () => {
  it('moves the camera by the same delta as the target', () => {
    const target = new THREE.Vector3(100, 1.2, 100);
    const cameraPosition = new THREE.Vector3(120, 30, 130);
    const limits = { x: [-10, 10], y: [1.2, 1.2], z: [-5, 20] };

    expect(clampPanTarget(target, cameraPosition, limits)).toBe(true);
    expect(target.x).toBe(10);
    expect(target.z).toBe(20);
    expect(cameraPosition.x).toBe(30);
    expect(cameraPosition.z).toBe(50);
  });

  it('returns false when the target is already inside the limits', () => {
    const target = new THREE.Vector3(0, 1.2, 13);
    const cameraPosition = new THREE.Vector3(10, 30, 20);
    const limits = { x: [-20, 20], y: [1.2, 1.2], z: [-10, 30] };

    expect(clampPanTarget(target, cameraPosition, limits)).toBe(false);
    expect(cameraPosition.x).toBe(10);
    expect(cameraPosition.z).toBe(20);
  });

  it('pulls a vertically drifted target back down to the locked height', () => {
    const target = new THREE.Vector3(0, 40, 13);
    const cameraPosition = new THREE.Vector3(-36.7, 70, 49.7);
    const limits = { x: [-10, 10], y: [1.2, 1.2], z: [1, 29] };

    expect(clampPanTarget(target, cameraPosition, limits)).toBe(true);
    expect(target.y).toBeCloseTo(1.2);
    expect(cameraPosition.y).toBeCloseTo(31.2);
  });
});
