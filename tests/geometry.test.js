import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { box, slab, wallRun, archFrame, awning, scaleUVs } from '../src/utils/geometry.js';
import { boundsOf, expectFinite } from './helpers/bounds.js';

const mat = new THREE.MeshStandardMaterial();

describe('box', () => {
  it('spans the given ranges and centres itself in them', () => {
    const mesh = box(mat, { x: [-1, 3], y: [0, 2], z: [4, 5] });
    const p = mesh.geometry.parameters;
    expect([p.width, p.height, p.depth]).toEqual([4, 2, 1]);
    expect(mesh.position.toArray()).toEqual([1, 1, 4.5]);
  });

  it('casts and receives shadows', () => {
    const mesh = box(mat, { x: [0, 1], y: [0, 1], z: [0, 1] });
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });
});

describe('UV world-scaling', () => {
  const tiled = new THREE.MeshStandardMaterial();
  tiled.userData.tile = 2;

  it('gives a 4-unit face twice the UV span of a 2-unit face', () => {
    const wide = box(tiled, { x: [0, 4], y: [0, 2], z: [0, 2] });
    const uv = wide.geometry.attributes.uv;
    // Face 4 is +Z: u runs along x (4 units), v along y (2 units).
    let maxU = 0;
    let maxV = 0;
    for (let i = 16; i < 20; i++) {
      maxU = Math.max(maxU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    expect(maxU).toBeCloseTo(4 / 2, 5);
    expect(maxV).toBeCloseTo(2 / 2, 5);
  });

  it('leaves UVs untouched when the material declares no tile size', () => {
    const plain = new THREE.MeshStandardMaterial();
    plain.userData.tile = null;
    const mesh = box(plain, { x: [0, 8], y: [0, 8], z: [0, 8] });
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getY(i)).toBeLessThanOrEqual(1);
    }
  });

  it('scales slab UVs by its footprint', () => {
    const mesh = slab(tiled, { x: [0, 6], z: [0, 2], y: 0 });
    const uv = mesh.geometry.attributes.uv;
    let maxU = 0;
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
    expect(maxU).toBeCloseTo(6 / 2, 5);
  });

  it('is a no-op without a tile size', () => {
    const geometry = new THREE.PlaneGeometry(4, 4);
    const before = geometry.attributes.uv.array.slice();
    scaleUVs(geometry, [[4, 4]], null);
    expect(Array.from(geometry.attributes.uv.array)).toEqual(Array.from(before));
  });
});

describe('slab', () => {
  it('lies flat at the given height', () => {
    const mesh = slab(mat, { x: [-2, 2], z: [0, 6], y: 0.5 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.y).toBeCloseTo(0.5, 5);
    expect(bounds.max.y).toBeCloseTo(0.5, 5);
    expect(bounds.min.x).toBeCloseTo(-2, 5);
    expect(bounds.max.z).toBeCloseTo(6, 5);
  });

  it('receives shadows without casting them', () => {
    const mesh = slab(mat, { x: [0, 1], z: [0, 1], y: 0 });
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.castShadow).toBe(false);
  });
});

describe('wallRun', () => {
  it('runs along x and is thin in z', () => {
    const mesh = wallRun(mat, { axis: 'x', at: -8, span: [-11, 9], y: [0, 1.2], thickness: 0.4 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.x).toBeCloseTo(-11, 5);
    expect(bounds.max.x).toBeCloseTo(9, 5);
    expect(bounds.min.z).toBeCloseTo(-8.2, 5);
    expect(bounds.max.z).toBeCloseTo(-7.8, 5);
    expect(bounds.max.y).toBeCloseTo(1.2, 5);
  });

  it('runs along z and is thin in x', () => {
    const mesh = wallRun(mat, { axis: 'z', at: 9, span: [-8, 2], y: [0, 1.2], thickness: 0.4 });
    const bounds = boundsOf(mesh);
    expect(bounds.min.z).toBeCloseTo(-8, 5);
    expect(bounds.max.z).toBeCloseTo(2, 5);
    expect(bounds.min.x).toBeCloseTo(8.8, 5);
    expect(bounds.max.x).toBeCloseTo(9.2, 5);
  });
});

describe('archFrame', () => {
  it('is as wide and tall as requested', () => {
    const group = archFrame(mat, {
      width: 1.1,
      height: 0.85,
      depth: 0.22,
      thickness: 0.16,
      center: [5.65, 1.15, -4.8],
    });
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(1.1 + 0.32, 1);
    expect(bounds.min.y).toBeCloseTo(1.15, 5);
    // Head radius is width/2 + thickness = 0.71.
    expect(bounds.max.y).toBeCloseTo(1.15 + 0.85 + 0.71, 1);
  });
});

describe('awning', () => {
  it('slopes down and outward from the wall', () => {
    const group = awning(mat, {
      x: [-11, -3.4],
      wallZ: 2,
      wallY: 2.9,
      frontZ: 3.3,
      frontY: 2.45,
      valance: 0.25,
    });
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expect(bounds.min.x).toBeCloseTo(-11, 1);
    expect(bounds.max.x).toBeCloseTo(-3.4, 1);
    expect(bounds.max.z).toBeCloseTo(3.3, 1);
    expect(bounds.max.y).toBeCloseTo(2.9, 1);
    expect(bounds.min.y).toBeCloseTo(2.45 - 0.25, 1);
  });
});
