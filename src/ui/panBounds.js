import * as THREE from 'three';

function clampAxis(min, max, half, padding) {
  const lo = min + half + padding;
  const hi = max - half - padding;
  if (lo <= hi) return [lo, hi];
  const mid = (lo + hi) / 2;
  return [mid, mid];
}

export function panTargetLimits({
  frustumSize,
  zoom,
  aspect,
  bounds,
  padding = 0,
}) {
  const halfH = frustumSize / zoom / 2;
  const halfW = halfH * aspect;
  const [xMin, xMax] = clampAxis(bounds.min[0], bounds.max[0], halfW, padding);
  const [zMin, zMax] = clampAxis(bounds.min[2], bounds.max[2], halfH, padding);
  return { x: [xMin, xMax], z: [zMin, zMax] };
}

export function clampPanTarget(target, cameraPosition, limits) {
  const x = THREE.MathUtils.clamp(target.x, limits.x[0], limits.x[1]);
  const z = THREE.MathUtils.clamp(target.z, limits.z[0], limits.z[1]);
  const dx = x - target.x;
  const dz = z - target.z;
  if (dx === 0 && dz === 0) return false;

  target.x = x;
  target.z = z;
  cameraPosition.x += dx;
  cameraPosition.z += dz;
  return true;
}
