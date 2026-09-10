import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLighting } from '../src/lighting.js';
import { layout } from '../src/layout.js';

const anchors = {
  lamps: [new THREE.Vector3(-9.5, 2.9, 2.5), new THREE.Vector3(-4, 2.9, 2.5)],
  storefront: [new THREE.Vector3(-8, 1.8, 1.2), new THREE.Vector3(-5, 1.8, 1.2)],
  sideWindow: new THREE.Vector3(7, 1.8, 5.4),
};

const group = createLighting(layout, anchors);

describe('createLighting', () => {
  it('returns a named group', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('lighting');
  });

  it('adds exactly one hemisphere light and one sun', () => {
    expect(group.children.filter((c) => c.isHemisphereLight)).toHaveLength(1);
    expect(group.children.filter((c) => c.isDirectionalLight)).toHaveLength(1);
  });

  it('makes the sun cast shadows with the configured bounds', () => {
    const sun = group.children.find((c) => c.isDirectionalLight);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.width).toBe(layout.lighting.sun.shadowMapSize);
    expect(sun.shadow.camera.right).toBe(layout.lighting.sun.shadowBounds);
    expect(sun.shadow.camera.bottom).toBe(-layout.lighting.sun.shadowBounds);
  });

  it('adds one warm point light per anchor', () => {
    const points = group.children.filter((c) => c.isPointLight);
    expect(points).toHaveLength(anchors.lamps.length + anchors.storefront.length + 1);
    for (const light of points) {
      expect(light.decay).toBe(layout.lighting.warm.decay);
      expect(light.distance).toBe(layout.lighting.warm.distance);
    }
  });

  it('places a point light at each supplied anchor', () => {
    const points = group.children.filter((c) => c.isPointLight);
    const at = points.some((l) => l.position.equals(anchors.sideWindow));
    expect(at).toBe(true);
  });
});
