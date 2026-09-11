import * as THREE from 'three';

function stanchion(materials, layout, [x, z], b) {
  const parts = [];

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(b.baseRadius, b.baseRadius * 1.05, b.baseHeight, 20),
    materials.metalDark
  );
  base.position.set(x, layout.floorContact + b.baseHeight / 2, z);
  base.castShadow = true;
  base.receiveShadow = true;
  parts.push(base);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(b.postRadius, b.postRadius, b.height - b.baseHeight, 16),
    materials.metalDark
  );
  post.position.set(
    x,
    layout.floorContact + b.baseHeight + (b.height - b.baseHeight) / 2,
    z
  );
  post.castShadow = true;
  post.receiveShadow = true;
  parts.push(post);

  return parts;
}

// A rope slung between two posts, drooping slightly under its own weight.
function rope(materials, from, to, b) {
  const start = new THREE.Vector3(from[0], b.ropeY, from[1]);
  const end = new THREE.Vector3(to[0], b.ropeY, to[1]);
  const middle = start.clone().lerp(end, 0.5);
  middle.y -= start.distanceTo(end) * 0.09;

  const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, b.ropeRadius, 8, false),
    materials.rope
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createQueue(materials, layout) {
  const group = new THREE.Group();
  group.name = 'queue';
  const q = layout.queue;
  const b = q.barrier;

  for (const position of b.posts) {
    for (const part of stanchion(materials, layout, position, b)) group.add(part);
  }
  for (let i = 0; i < b.posts.length - 1; i++) {
    group.add(rope(materials, b.posts[i], b.posts[i + 1], b));
  }

  return group;
}
