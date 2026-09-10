import * as THREE from 'three';

const mid = (range) => (range[0] + range[1]) / 2;
const size = (range) => range[1] - range[0];

export function box(material, { x, y, z }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size(x), size(y), size(z)), material);
  mesh.position.set(mid(x), mid(y), mid(z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function slab(material, { x, z, y = 0 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size(x), size(z)), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(mid(x), y, mid(z));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export function wallRun(material, { axis, at, span, y, thickness }) {
  const half = thickness / 2;
  if (axis === 'x') {
    return box(material, { x: span, y, z: [at - half, at + half] });
  }
  return box(material, { x: [at - half, at + half], y, z: span });
}

export function archFrame(material, { width, height, depth, thickness, center }) {
  const group = new THREE.Group();
  group.name = 'archFrame';
  const [cx, cy, cz] = center;
  const halfW = width / 2;
  const outer = halfW + thickness;

  for (const side of [-1, 1]) {
    group.add(
      box(material, {
        x: [cx - depth / 2, cx + depth / 2],
        y: [cy, cy + height],
        z: [cz + side * halfW, cz + side * outer],
      })
    );
  }

  const headGeometry = new THREE.CylinderGeometry(outer, outer, depth, 24, 1, false, 0, Math.PI);
  const head = new THREE.Mesh(headGeometry, material);
  head.rotation.z = Math.PI / 2;
  head.position.set(cx, cy + height, cz);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  return group;
}

export function awning(material, { x, wallZ, wallY, frontZ, frontY, valance }) {
  const group = new THREE.Group();
  group.name = 'awning';

  const depth = Math.hypot(frontZ - wallZ, wallY - frontY);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(size(x), depth), material);
  panel.rotation.x = -Math.atan2(wallY - frontY, frontZ - wallZ) - Math.PI / 2;
  panel.position.set(mid(x), (wallY + frontY) / 2, (wallZ + frontZ) / 2);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(size(x), valance), material);
  skirt.position.set(mid(x), frontY - valance / 2, frontZ);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);

  return group;
}
