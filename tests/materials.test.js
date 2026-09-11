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
    // Artwork is stretched across its face once rather than tiled.
    const artwork = ['sign', 'sellBanner', 'ovenBanner'];
    for (const [key, material] of Object.entries(materials)) {
      if (!material.map) continue;
      const tile = material.userData.tile;
      if (artwork.includes(key)) {
        expect(tile, key).toBeNull();
      } else {
        expect(tile, key).toBeGreaterThan(0);
      }
    }
  });

  it('draws the sell banner as a see-through sprite that keeps its colours', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.sellBanner).toBeInstanceOf(THREE.SpriteMaterial);
    expect(m.sellBanner.map).toBe(textures.sellBanner);
    expect(m.sellBanner.transparent).toBe(true);
    expect(m.sellBanner.toneMapped).toBe(false);
  });

  // Both pulse by opacity, which only shows on a transparent material.
  it('keeps the zone marker glow unlit and able to fade', () => {
    for (const key of ['markerBeam', 'markerEdge']) {
      expect(materials[key], key).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(materials[key].transparent, key).toBe(true);
      expect(materials[key].depthWrite, key).toBe(false);
    }
    expect(materials.markerBeam.opacity).toBeLessThan(1);
  });

  it('draws the oven banner as a see-through sprite on the count texture', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.ovenBanner).toBeInstanceOf(THREE.SpriteMaterial);
    expect(m.ovenBanner.map).toBe(textures.ovenBanner);
    expect(m.ovenBanner.transparent).toBe(true);
    expect(m.ovenBanner.toneMapped).toBe(false);
  });

  it('maps the brick material to the brick texture', () => {
    const textures = createTextures(stubCanvasFactory());
    const m = createMaterials(textures);
    expect(m.brick.map).toBe(textures.brick);
  });
});
