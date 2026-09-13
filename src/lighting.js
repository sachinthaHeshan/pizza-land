import * as THREE from 'three';

export function createLighting(layout, anchors) {
  const group = new THREE.Group();
  group.name = 'lighting';
  const l = layout.lighting;

  group.add(new THREE.HemisphereLight(l.hemi.sky, l.hemi.ground, l.hemi.intensity));

  const sun = new THREE.DirectionalLight(l.sun.color, l.sun.intensity);
  sun.position.set(...l.sun.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(l.sun.shadowMapSize, l.sun.shadowMapSize);
  sun.shadow.bias = l.sun.shadowBias;

  const b = l.sun.shadowBounds;
  sun.shadow.camera.left = -b;
  sun.shadow.camera.right = b;
  sun.shadow.camera.top = b;
  sun.shadow.camera.bottom = -b;
  sun.shadow.camera.near = l.sun.shadowNear;
  sun.shadow.camera.far = l.sun.shadowFar;
  sun.shadow.camera.updateProjectionMatrix();

  group.add(sun);
  group.add(sun.target);

  const warmAnchors = [...anchors.lamps, ...anchors.storefront, anchors.sideWindow];
  for (const anchor of warmAnchors) {
    const light = new THREE.PointLight(l.warm.color, l.warm.intensity, l.warm.distance, l.warm.decay);
    light.position.copy(anchor);
    group.add(light);
  }

  group.userData.sun = sun;

  return group;
}

const _basis = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _back = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

// Moves the sun so its shadow box follows whatever the camera is looking at.
// The target is snapped to whole shadow texels first: without that, shadow
// edges crawl across every surface while the view pans.
export function followSun(sun, target, layout) {
  const { position, shadowBounds, shadowMapSize } = layout.lighting.sun;
  const texel = (2 * shadowBounds) / shadowMapSize;
  _offset.set(...position);
  _basis.lookAt(_offset, _origin, _worldUp);
  _right.setFromMatrixColumn(_basis, 0);
  _up.setFromMatrixColumn(_basis, 1);
  _back.setFromMatrixColumn(_basis, 2);

  const alongRight = Math.round(target.dot(_right) / texel) * texel;
  const alongUp = Math.round(target.dot(_up) / texel) * texel;
  const alongBack = target.dot(_back);

  sun.target.position
    .copy(_right)
    .multiplyScalar(alongRight)
    .addScaledVector(_up, alongUp)
    .addScaledVector(_back, alongBack);
  sun.position.copy(sun.target.position).add(_offset);
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
}
