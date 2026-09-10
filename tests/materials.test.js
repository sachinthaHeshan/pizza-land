import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMaterials, MATERIAL_KEYS } from '../src/materials.js';
import { createTextures } from '../src/textures.js';
import { stubCanvasFactory } from './helpers/stubs.js';

const materials = createMaterials(createTextures(stubCanvasFactory()));

describe('createMaterials', () => {
  it('returns exactly the declared material keys', () => {
    expect(Object.keys(materials).sort()).toEqual([...MATERIAL_KEYS].sort());
  });

  it('names every material after its key', () => {
    for (const [key, material] of Object.entries(materials)) {
      expect(material.name, key).toBe(key);
    }
  });

  it('makes glass transparent and not fully opaque', () => {
    expect(materials.glass.transparent).toBe(true);
    expect(materials.glass.opacity).toBeLessThan(1);
  });

  it('makes stainless metallic and rough surfaces non-metallic', () => {
    expect(materials.metal.metalness).toBeGreaterThan(0.5);
    expect(materials.brick.metalness).toBeLessThan(0.2);
    expect(materials.brick.roughness).toBeGreaterThan(0.7);
  });

  it('uses unlit materials for emissive glow surfaces', () => {
    expect(materials.glow).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(materials.ember).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('declares a positive world tile size for every mapped material', () => {
    for (const [key, material] of Object.entries(materials)) {
      if (!material.map) continue;
      const tile = material.userData.tile;
      if (key === 'sign') {
        expect(tile, key).toBeNull();
      } else {
        expect(tile, key).toBeGreaterThan(0);
      }
    }
  });

  it('maps the brick material to the brick texture', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.brick.map).toBe(textures.brick);
  });
});
