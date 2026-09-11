import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { panTargetLimits, clampPanTarget } from '../../src/ui/panBounds.js';
import { layout } from '../../src/layout.js';

describe('panTargetLimits', () => {
  it('shrinks the allowed target range when zoomed out', () => {
    const zoomedOut = panTargetLimits({
      frustumSize: layout.camera.frustumSize,
      zoom: 1,
      aspect: 16 / 9,
      bounds: layout.envelopes.ground,
    });
    const zoomedIn = panTargetLimits({
      frustumSize: layout.camera.frustumSize,
      zoom: 2,
      aspect: 16 / 9,
      bounds: layout.envelopes.ground,
    });

    expect(zoomedIn.x[1] - zoomedIn.x[0]).toBeGreaterThan(
      zoomedOut.x[1] - zoomedOut.x[0]
    );
    expect(zoomedIn.z[1] - zoomedIn.z[0]).toBeGreaterThan(
      zoomedOut.z[1] - zoomedOut.z[0]
    );
  });

  it('keeps the default camera target inside the limits at min zoom', () => {
    const limits = panTargetLimits({
      frustumSize: layout.camera.frustumSize,
      zoom: layout.camera.minZoom,
      aspect: 16 / 9,
      bounds: layout.envelopes.ground,
    });
    const [tx, , tz] = layout.camera.target;

    expect(tx).toBeGreaterThanOrEqual(limits.x[0]);
    expect(tx).toBeLessThanOrEqual(limits.x[1]);
    expect(tz).toBeGreaterThanOrEqual(limits.z[0]);
    expect(tz).toBeLessThanOrEqual(limits.z[1]);
  });
});

describe('clampPanTarget', () => {
  it('moves the camera by the same delta as the target', () => {
    const target = new THREE.Vector3(100, 1.2, 100);
    const cameraPosition = new THREE.Vector3(120, 30, 130);
    const limits = { x: [-10, 10], z: [-5, 20] };

    expect(clampPanTarget(target, cameraPosition, limits)).toBe(true);
    expect(target.x).toBe(10);
    expect(target.z).toBe(20);
    expect(cameraPosition.x).toBe(30);
    expect(cameraPosition.z).toBe(50);
  });

  it('returns false when the target is already inside the limits', () => {
    const target = new THREE.Vector3(0, 1.2, 13);
    const cameraPosition = new THREE.Vector3(10, 30, 20);
    const limits = { x: [-20, 20], z: [-10, 30] };

    expect(clampPanTarget(target, cameraPosition, limits)).toBe(false);
    expect(cameraPosition.x).toBe(10);
    expect(cameraPosition.z).toBe(20);
  });
});
