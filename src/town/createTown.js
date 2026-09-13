import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { slab } from '../utils/geometry.js';
import { planTown } from './planTown.js';
import { createShop, createHouse } from './buildings.js';
import { createRoundTree, createPine } from './nature.js';
import { PROP_BUILDERS } from './props.js';

const KEEP = new Set(['position', 'normal', 'uv']);

// Every town piece as an ordinary mesh, before merging. Exposed so tests can
// check that merging moves and loses nothing.
export function buildTownParts(materials, layout, plan = planTown(layout)) {
  const parts = new THREE.Group();
  parts.name = 'townParts';
  for (const lot of plan.lots) {
    parts.add(lot.kind === 'shop' ? createShop(materials, lot) : createHouse(materials, lot));
  }
  for (const tree of plan.trees) {
    parts.add(tree.kind === 'pine' ? createPine(materials, tree) : createRoundTree(materials, tree));
  }
  for (const prop of plan.props) parts.add(PROP_BUILDERS[prop.kind](materials, prop));
  const lawnY = layout.ground.floorY.paving + layout.surfaceEps;
  for (const lawn of plan.lawns) {
    parts.add(slab(materials.planting, { x: lawn.x, z: lawn.z, y: lawnY, renderOrder: 1 }));
  }
  return parts;
}

// Bakes every mesh into world space and merges them into one mesh per
// material. Geometries are made non-indexed first, because indexed boxes and
// cones cannot otherwise merge with non-indexed extruded roofs.
export function mergeByMaterial(parts, name) {
  parts.updateMatrixWorld(true);
  const buckets = new Map();
  parts.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index !== null ? object.geometry.toNonIndexed() : object.geometry.clone();
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!KEEP.has(attribute)) geometry.deleteAttribute(attribute);
    }
    geometry.applyMatrix4(object.matrixWorld);
    if (!buckets.has(object.material)) buckets.set(object.material, []);
    buckets.get(object.material).push(geometry);
  });

  const group = new THREE.Group();
  group.name = name;
  for (const [material, geometries] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
    for (const geometry of geometries) geometry.dispose();
    mesh.name = `${name}-${material.name}`;
    const glowing = material.transparent || material.depthWrite === false;
    mesh.castShadow = !glowing;
    mesh.receiveShadow = !glowing;
    group.add(mesh);
  }
  return group;
}

export function createTown(materials, layout) {
  const parts = buildTownParts(materials, layout);
  const town = mergeByMaterial(parts, 'town');
  parts.traverse((object) => {
    if (object.isMesh) object.geometry.dispose();
  });
  return town;
}
