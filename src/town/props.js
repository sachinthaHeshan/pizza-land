import * as THREE from 'three';
import { box } from '../utils/geometry.js';

// Street furniture for the town. Each builder keeps every part inside the
// prop's footprint (size.w along x, size.d along z), because the plan blocks
// the player with exactly that footprint. `facing` is the z direction a seat
// or shelter opens toward.

const FLOOR = 0.01;

function named(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function createLamp(materials, { x, z, size }) {
  const lamp = named('lamp');
  const half = size.w / 2;
  lamp.add(box(materials.metalDark, { x: [x - half, x + half], y: [FLOOR, 0.2], z: [z - half, z + half] }));
  lamp.add(box(materials.metalDark, { x: [x - 0.05, x + 0.05], y: [0.2, size.h - 0.2], z: [z - 0.05, z + 0.05] }));
  lamp.add(box(materials.metalDark, { x: [x - half, x + half], y: [size.h - 0.2, size.h], z: [z - half, z + half] }));
  const glow = box(materials.glow, { x: [x - 0.12, x + 0.12], y: [size.h - 0.25, size.h - 0.2], z: [z - 0.12, z + 0.12] });
  glow.castShadow = false;
  lamp.add(glow);
  return lamp;
}

export function createBench(materials, { x, z, facing, size }) {
  const bench = named('bench');
  const hw = size.w / 2;
  const hd = size.d / 2;
  bench.add(box(materials.wood, { x: [x - hw, x + hw], y: [0.42, 0.5], z: [z - hd, z + hd] }));
  for (const lx of [x - hw + 0.1, x + hw - 0.15]) {
    bench.add(box(materials.metalDark, { x: [lx, lx + 0.05], y: [FLOOR, 0.42], z: [z - hd + 0.05, z + hd - 0.05] }));
  }
  // The backrest stands on the side behind the sitter.
  const back = facing < 0 ? [z + hd - 0.08, z + hd] : [z - hd, z - hd + 0.08];
  bench.add(box(materials.wood, { x: [x - hw, x + hw], y: [0.5, size.h], z: back }));
  return bench;
}

export function createBin(materials, { x, z, size }) {
  const bin = named('bin');
  const half = size.w / 2;
  bin.add(box(materials.greenPaint, { x: [x - half + 0.03, x + half - 0.03], y: [FLOOR, size.h - 0.1], z: [z - half + 0.03, z + half - 0.03] }));
  bin.add(box(materials.metalDark, { x: [x - half, x + half], y: [size.h - 0.1, size.h], z: [z - half, z + half] }));
  return bin;
}

export function createBusStop(materials, { x, z, facing, size }) {
  const stop = named('busStop');
  const hw = size.w / 2;
  const hd = size.d / 2;
  // Open toward `facing`; the glass back panel and the bench are on the far side.
  const back = facing < 0 ? [z + hd - 0.08, z + hd] : [z - hd, z - hd + 0.08];
  const seat = facing < 0 ? [z + hd - 0.6, z + hd - 0.1] : [z - hd + 0.1, z - hd + 0.6];
  const front = facing < 0 ? [z - hd, z - hd + 0.08] : [z + hd - 0.08, z + hd];

  stop.add(box(materials.metalDark, { x: [x - hw, x + hw], y: [size.h - 0.1, size.h], z: [z - hd, z + hd] }));
  stop.add(box(materials.glass, { x: [x - hw + 0.1, x + hw - 0.1], y: [0.3, size.h - 0.2], z: back }));
  for (const px of [x - hw, x + hw - 0.08]) {
    stop.add(box(materials.metalDark, { x: [px, px + 0.08], y: [FLOOR, size.h - 0.1], z: back }));
  }
  stop.add(box(materials.wood, { x: [x - hw + 0.4, x + hw - 0.4], y: [0.42, 0.5], z: seat }));
  stop.add(box(materials.metalDark, { x: [x + hw - 0.08, x + hw], y: [FLOOR, size.h - 0.1], z: front }));
  stop.add(box(materials.greenPaint, { x: [x + hw - 0.5, x + hw - 0.08], y: [size.h - 0.6, size.h - 0.15], z: front }));
  return stop;
}

export function createHedge(materials, { x, z, size }) {
  const hedge = named('hedge');
  hedge.add(box(materials.hedge, { x: [x - size.w / 2, x + size.w / 2], y: [FLOOR, size.h], z: [z - size.d / 2, z + size.d / 2] }));
  return hedge;
}

export function createFence(materials, { x, z, size }) {
  const fence = named('fence');
  const hw = size.w / 2;
  const z0 = z - size.d / 2;
  const z1 = z + size.d / 2;
  const posts = Math.max(2, Math.ceil(size.d / 1.2) + 1);
  for (let i = 0; i < posts; i++) {
    const pz = z0 + ((z1 - z0 - 0.1) * i) / (posts - 1);
    fence.add(box(materials.stone, { x: [x - hw, x + hw], y: [FLOOR, size.h], z: [pz, pz + 0.1] }));
  }
  for (const rail of [[0.35, 0.43], [0.7, 0.78]]) {
    fence.add(box(materials.stone, { x: [x - hw * 0.6, x + hw * 0.6], y: rail, z: [z0, z1] }));
  }
  return fence;
}

export function createPlanter(materials, { x, z, size }) {
  const planter = named('planter');
  const half = size.w / 2;
  planter.add(box(materials.stone, { x: [x - half, x + half], y: [FLOOR, 0.5], z: [z - half, z + half] }));
  const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5), materials.foliage);
  shrub.position.set(x, size.h - 0.3, z);
  shrub.castShadow = true;
  shrub.receiveShadow = true;
  planter.add(shrub);
  return planter;
}

export const PROP_BUILDERS = {
  lamp: createLamp,
  bench: createBench,
  bin: createBin,
  busStop: createBusStop,
  hedge: createHedge,
  fence: createFence,
  planter: createPlanter,
};
