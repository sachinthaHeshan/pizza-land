import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTextures, TEXTURE_KEYS } from '../src/textures.js';
import { stubCanvasFactory } from './helpers/stubs.js';

describe('createTextures', () => {
  it('returns exactly the declared texture keys', () => {
    const textures = createTextures(stubCanvasFactory());
    expect(Object.keys(textures).sort()).toEqual([...TEXTURE_KEYS].sort());
  });

  it('configures every texture for tiling in sRGB', () => {
    const textures = createTextures(stubCanvasFactory());
    for (const [name, texture] of Object.entries(textures)) {
      expect(texture, name).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.wrapS, name).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT, name).toBe(THREE.RepeatWrapping);
      expect(texture.colorSpace, name).toBe(THREE.SRGBColorSpace);
    }
  });

  it('draws a running-bond course for every brick row', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    const recording = (w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    };
    createTextures(recording);
    const brickCanvas = canvases[0];
    const rects = brickCanvas.__calls.filter(([method]) => method === 'fillRect');
    expect(rects.length).toBeGreaterThan(100);
  });

  it('draws alternating stripe bands', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const stripeCanvas = canvases[TEXTURE_KEYS.indexOf('stripe')];
    const rects = stripeCanvas.__calls.filter(([method]) => method === 'fillRect');
    expect(rects.length).toBeGreaterThanOrEqual(8);
  });
});
