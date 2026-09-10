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
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.updateProjectionMatrix();

  group.add(sun);
  group.add(sun.target);

  const warmAnchors = [...anchors.lamps, ...anchors.storefront, anchors.sideWindow];
  for (const anchor of warmAnchors) {
    const light = new THREE.PointLight(l.warm.color, l.warm.intensity, l.warm.distance, l.warm.decay);
    light.position.copy(anchor);
    group.add(light);
  }

  return group;
}
