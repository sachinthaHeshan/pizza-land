import * as THREE from 'three';

const mid = (range) => (range[0] + range[1]) / 2;
const size = (range) => range[1] - range[0];

// Lifts ranges that sit on the ground plane so bottoms do not z-fight paving.
export function yOnFloor(y, contact = 0.01) {
  return y[0] <= 0 ? [contact, y[1]] : y;
}

// Shortens a wall span so it stops at the inner face of an adjoining wall.
export function trimSpan(span, { start = 0, end = 0 } = {}) {
  const trimmed = [span[0] + start, span[1] - end];
  return trimmed[1] - trimmed[0] <= 0.001 ? null : trimmed;
}

// Stops a span at pillar faces on its endpoints.
export function trimSpanAtPillars(span, { axis, at, pillars, size }) {
  const half = size / 2;
  let [start, end] = span;
  for (const [px, pz] of pillars) {
    const onRun =
      axis === 'x' ? Math.abs(pz - at) < 0.01 : Math.abs(px - at) < 0.01;
    if (!onRun) continue;
    const edge = axis === 'x' ? px : pz;
    if (Math.abs(edge - start) < 0.01) start += half;
    if (Math.abs(edge - end) < 0.01) end -= half;
  }
  return end - start <= 0.001 ? null : [start, end];
}

// Meets a perpendicular wall's inner face without leaving a corner gap.
export function meetInnerFace(span, thickness, end) {
  const inset = thickness / 2;
  return end === 'start'
    ? trimSpan(span, { start: inset })
    : trimSpan(span, { end: inset });
}

function tileOf(material) {
  const tile = material && material.userData ? material.userData.tile : null;
  return typeof tile === 'number' && tile > 0 ? tile : null;
}

// Rescales a UV attribute in place so `spans[face]` world units map to one
// texture image. Without this, a 20-unit wall and a 1-unit post both get UVs
// 0..1 and the brick coursing smears to a different size on every surface.
export function scaleUVs(geometry, spans, tile) {
  if (!tile) return geometry;
  const uv = geometry.attributes.uv;
  const perFace = uv.count / spans.length;
  for (let face = 0; face < spans.length; face++) {
    const [su, sv] = spans[face];
    for (let i = 0; i < perFace; i++) {
      const index = face * perFace + i;
      uv.setXY(index, uv.getX(index) * (su / tile), uv.getY(index) * (sv / tile));
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

export function box(material, { x, y, z }) {
  const w = size(x);
  const h = size(y);
  const d = size(z);
  const geometry = new THREE.BoxGeometry(w, h, d);
  // BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z.
  scaleUVs(
    geometry,
    [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]],
    tileOf(material)
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(mid(x), mid(y), mid(z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function slab(material, { x, z, y = 0, renderOrder = 0 }) {
  const geometry = new THREE.PlaneGeometry(size(x), size(z));
  scaleUVs(geometry, [[size(x), size(z)]], tileOf(material));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(mid(x), y, mid(z));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
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
  const tile = tileOf(material);
  const panelGeometry = new THREE.PlaneGeometry(size(x), depth);
  scaleUVs(panelGeometry, [[size(x), depth]], tile);
  const panel = new THREE.Mesh(panelGeometry, material);
  panel.rotation.x = -Math.atan2(wallY - frontY, frontZ - wallZ) - Math.PI / 2;
  panel.position.set(mid(x), (wallY + frontY) / 2, (wallZ + frontZ) / 2);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const skirtGeometry = new THREE.PlaneGeometry(size(x), valance);
  scaleUVs(skirtGeometry, [[size(x), valance]], tile);
  const skirt = new THREE.Mesh(skirtGeometry, material);
  skirt.position.set(mid(x), frontY - valance / 2, frontZ);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);

  return group;
}
