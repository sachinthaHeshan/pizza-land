import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTown, buildTownParts } from '../../src/town/createTown.js';
import { createMaterials } from '../../src/materials.js';
import { createTextures } from '../../src/textures.js';
import { layout } from '../../src/layout.js';
import { stubCanvasFactory } from '../helpers/stubs.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';

// Real materials: which pieces cast shadows depends on glass being transparent
// and glow not writing depth, which stub materials don't model.
const materials = createMaterials(createTextures(stubCanvasFactory()));
const town = createTown(materials, layout);

describe('createTown', () => {
  it('returns a group named town, with finite bounds inside its envelope', () => {
    expect(town).toBeInstanceOf(THREE.Group);
    expect(town.name).toBe('town');
    const bounds = boundsOf(town);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.town);
  });

  it('merges the whole town into one mesh per material', () => {
    const used = new Set();
    buildTownParts(materials, layout).traverse((o) => {
      if (o.isMesh) used.add(o.material);
    });
    expect(town.children.every((child) => child.isMesh)).toBe(true);
    expect(town.children).toHaveLength(used.size);
    expect(new Set(town.children.map((child) => child.material)).size).toBe(town.children.length);
    expect(town.children.length).toBeLessThanOrEqual(30);
  });

  it('moves nothing while merging', () => {
    const before = boundsOf(buildTownParts(materials, layout));
    const after = boundsOf(town);
    // Merging bakes each part's world position into a float32 position
    // attribute, so a coordinate out at the town's ±78 m edge rounds by up to
    // a few microns (float32 steps by 7.6e-6 out there). Anything larger than
    // that would be a real move, not rounding.
    for (const corner of ['min', 'max']) {
      for (const axis of ['x', 'y', 'z']) {
        expect(after[corner][axis], `${corner}.${axis}`).toBeCloseTo(before[corner][axis], 4);
      }
    }
  });

  it('keeps every vertex, so no piece is lost in merging', () => {
    let before = 0;
    buildTownParts(materials, layout).traverse((o) => {
      if (o.isMesh) before += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    });
    let after = 0;
    for (const mesh of town.children) after += mesh.geometry.attributes.position.count;
    expect(after).toBe(before);
  });

  it('casts shadows from solid pieces but not from glass or the lamp glow', () => {
    const byMaterial = Object.fromEntries(town.children.map((mesh) => [mesh.material.name, mesh]));
    expect(byMaterial.glass.castShadow).toBe(false);
    expect(byMaterial.glass.receiveShadow).toBe(false);
    expect(byMaterial.glow.castShadow).toBe(false);
    expect(byMaterial.stone.castShadow).toBe(true);
    expect(byMaterial.metalDark.castShadow).toBe(true);
    expect(byMaterial.foliage.castShadow).toBe(true);
    expect(byMaterial.planting.receiveShadow).toBe(true);
  });

  it('names each merged mesh after its material', () => {
    for (const mesh of town.children) expect(mesh.name).toBe(`town-${mesh.material.name}`);
  });
});
