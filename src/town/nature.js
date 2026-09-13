import * as THREE from 'three';

// Low-poly trees. Canopy and trunk segment counts are even so each tree is
// symmetric about its spot; the flat-shaded materials give the facets.

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRoundTree(materials, { x, z, height }) {
  const group = new THREE.Group();
  group.name = 'roundTree';
  const trunkHeight = height * 0.35;
  const radius = height * 0.3;
  group.add(part(new THREE.CylinderGeometry(0.18, 0.24, trunkHeight, 8), materials.bark, x, trunkHeight / 2, z));
  group.add(part(new THREE.SphereGeometry(radius, 8, 5), materials.foliage, x, height - radius, z));
  return group;
}

export function createPine(materials, { x, z, height }) {
  const group = new THREE.Group();
  group.name = 'pine';
  const trunkHeight = height * 0.2;
  const lower = height * 0.55;
  const upper = height * 0.45;
  group.add(part(new THREE.CylinderGeometry(0.15, 0.2, trunkHeight, 8), materials.bark, x, trunkHeight / 2, z));
  group.add(part(new THREE.ConeGeometry(height * 0.26, lower, 8), materials.pine, x, trunkHeight + lower / 2, z));
  group.add(part(new THREE.ConeGeometry(height * 0.18, upper, 8), materials.pine, x, height - upper / 2, z));
  return group;
}
