import * as THREE from 'three';

const _near = new THREE.Vector3();
const _far = new THREE.Vector3();

function clampRange(lo, hi, preferred) {
  if (lo <= hi) return [lo, hi];
  const lock = preferred ?? (lo + hi) / 2;
  return [lock, lock];
}

function groundHit(camera, ndcX, ndcY, groundY) {
  _near.set(ndcX, ndcY, -1).unproject(camera);
  _far.set(ndcX, ndcY, 1).unproject(camera);
  const t = (groundY - _near.y) / (_far.y - _near.y);
  return {
    x: _near.x + (_far.x - _near.x) * t,
    z: _near.z + (_far.z - _near.z) * t,
  };
}

function clampAxis(value, limits) {
  if (!limits) return value;
  return THREE.MathUtils.clamp(value, limits[0], limits[1]);
}

export function panTargetLimits({
  camera,
  target,
  bounds,
  padding = 0,
  groundY = 0,
  preferred,
}) {
  // The isometric frustum cuts a parallelogram out of the ground, not an
  // axis-aligned box of size frustumSize. Unproject the screen corners onto
  // y = 0 and clamp so that parallelogram stays over the map; if it is
  // already larger than the map on an axis, lock that axis on the designed
  // target so the view cannot slide off into empty sky.
  camera.updateMatrixWorld();
  const corners = [
    groundHit(camera, -1, -1, groundY),
    groundHit(camera, -1, 1, groundY),
    groundHit(camera, 1, -1, groundY),
    groundHit(camera, 1, 1, groundY),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const corner of corners) {
    if (corner.x < minX) minX = corner.x;
    if (corner.x > maxX) maxX = corner.x;
    if (corner.z < minZ) minZ = corner.z;
    if (corner.z > maxZ) maxZ = corner.z;
  }

  const x = clampRange(
    bounds.min[0] - (minX - target.x) + padding,
    bounds.max[0] - (maxX - target.x) - padding,
    preferred?.x
  );
  const z = clampRange(
    bounds.min[2] - (minZ - target.z) + padding,
    bounds.max[2] - (maxZ - target.z) - padding,
    preferred?.z
  );
  const yLock = preferred?.y ?? target.y;
  return { x, y: [yLock, yLock], z };
}

export function clampPanTarget(target, cameraPosition, limits) {
  const x = clampAxis(target.x, limits.x);
  const y = clampAxis(target.y, limits.y);
  const z = clampAxis(target.z, limits.z);
  const dx = x - target.x;
  const dy = y - target.y;
  const dz = z - target.z;
  if (dx === 0 && dy === 0 && dz === 0) return false;

  target.x = x;
  target.y = y;
  target.z = z;
  cameraPosition.x += dx;
  cameraPosition.y += dy;
  cameraPosition.z += dz;
  return true;
}
