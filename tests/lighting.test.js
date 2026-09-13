import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLighting, followSun } from '../src/lighting.js';
import { layout } from '../src/layout.js';
import { panTargetLimits, clampPanTarget } from '../src/ui/panBounds.js';

const anchors = {
  lamps: [new THREE.Vector3(-9.5, 2.9, 2.5), new THREE.Vector3(-4, 2.9, 2.5)],
  storefront: [new THREE.Vector3(-8, 1.8, 1.2), new THREE.Vector3(-5, 1.8, 1.2)],
  sideWindow: new THREE.Vector3(7, 1.8, 5.4),
};

const c = layout.camera;
const home = new THREE.Vector3(...c.target);
const viewOffset = new THREE.Vector3(...c.direction).normalize().multiplyScalar(c.distance);

function viewCamera(target, aspect) {
  const half = c.frustumSize / 2;
  const camera = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 400);
  camera.position.copy(target).add(viewOffset);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function cornersAt(camera, y) {
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sy]) => {
    const near = new THREE.Vector3(sx, sy, -1).unproject(camera);
    const far = new THREE.Vector3(sx, sy, 1).unproject(camera);
    return near.clone().lerp(far, (y - near.y) / (far.y - near.y));
  });
}

function pannedTarget(wish, aspect) {
  const target = wish.clone();
  const camera = viewCamera(target, aspect);
  const limits = panTargetLimits({
    camera,
    target,
    bounds: layout.envelopes.ground,
    padding: c.panPadding ?? 0,
    preferred: { x: home.x, y: home.y, z: home.z },
  });
  clampPanTarget(target, camera.position, limits);
  return target;
}

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

  it('exposes the sun for the render loop', () => {
    expect(group.userData.sun).toBe(group.children.find((child) => child.isDirectionalLight));
  });

  it('takes its shadow depth range from layout', () => {
    const sun = group.userData.sun;
    expect(sun.shadow.camera.near).toBe(layout.lighting.sun.shadowNear);
    expect(sun.shadow.camera.far).toBe(layout.lighting.sun.shadowFar);
  });
});

describe('followSun', () => {
  it('keeps every corner of the view inside the shadow box while panning', () => {
    const sun = group.userData.sun;
    const { shadowBounds, shadowNear, shadowFar } = layout.lighting.sun;
    const roofHeight = layout.envelopes.town.max[1];
    const wishes = [
      home,
      new THREE.Vector3(0, home.y, 200),
      new THREE.Vector3(-200, home.y, 200),
      new THREE.Vector3(200, home.y, 200),
      new THREE.Vector3(-200, home.y, -200),
      new THREE.Vector3(200, home.y, -200),
    ];
    // 2.389 is a 3440x1440 ultrawide; 2.5 is a window dragged wider still.
    for (const aspect of [16 / 9, 21 / 9, 2.389, 2.5]) {
      for (const wish of wishes) {
        const target = wish === home ? home.clone() : pannedTarget(wish, aspect);
        followSun(sun, target, layout);
        sun.shadow.updateMatrices(sun);
        const camera = viewCamera(target, aspect);
        const label = `aspect ${aspect.toFixed(2)}, target (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`;
        for (const point of [...cornersAt(camera, 0), ...cornersAt(camera, roofHeight)]) {
          const local = point.clone().applyMatrix4(sun.shadow.camera.matrixWorldInverse);
          expect(Math.abs(local.x), label).toBeLessThanOrEqual(shadowBounds);
          expect(Math.abs(local.y), label).toBeLessThanOrEqual(shadowBounds);
          expect(-local.z, label).toBeGreaterThanOrEqual(shadowNear);
          expect(-local.z, label).toBeLessThanOrEqual(shadowFar);
        }
      }
    }
  });

  it('keeps the sun at its configured offset from what it lights', () => {
    const sun = group.userData.sun;
    followSun(sun, new THREE.Vector3(12, 1.2, 60), layout);
    const offset = sun.position.clone().sub(sun.target.position);
    const [ox, oy, oz] = layout.lighting.sun.position;
    expect(offset.x).toBeCloseTo(ox, 6);
    expect(offset.y).toBeCloseTo(oy, 6);
    expect(offset.z).toBeCloseTo(oz, 6);
  });

  it('moves the sun only in whole shadow texels', () => {
    const sun = group.userData.sun;
    const { position, shadowBounds, shadowMapSize } = layout.lighting.sun;
    const texel = (2 * shadowBounds) / shadowMapSize;
    const basis = new THREE.Matrix4().lookAt(
      new THREE.Vector3(...position),
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0)
    );
    const right = new THREE.Vector3().setFromMatrixColumn(basis, 0);

    followSun(sun, home, layout);
    const onGrid = sun.target.position.clone();
    const start = sun.position.clone();

    followSun(sun, onGrid.clone().addScaledVector(right, 0.4 * texel), layout);
    expect(sun.position.distanceTo(start)).toBeLessThan(1e-9);

    followSun(sun, onGrid.clone().addScaledVector(right, 0.6 * texel), layout);
    expect(sun.position.distanceTo(start)).toBeCloseTo(texel, 9);
  });
});
