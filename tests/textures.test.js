import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTextures, TEXTURE_KEYS } from '../src/textures.js';
import { layout } from '../src/layout.js';
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

  it('letters SELL PIZZA onto the sell banner', () => {
    expect(TEXTURE_KEYS).toContain('sellBanner');
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const banner = canvases[TEXTURE_KEYS.indexOf('sellBanner')];
    const words = banner.__calls
      .filter(([method]) => method === 'fillText')
      .map(([, text]) => text);
    expect(words).toEqual(expect.arrayContaining(['SELL', 'PIZZA']));
  });

  it('redraws the oven banner with its count, only when the count changes', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    const textures = createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const banner = textures.ovenBanner;
    const calls = canvases[TEXTURE_KEYS.indexOf('ovenBanner')].__calls;
    const words = () => calls.filter(([m]) => m === 'fillText').map(([, text]) => text);

    const version = banner.version;
    banner.userData.setCount(3, 10);
    expect(words()).toContain('3/10');
    expect(banner.userData.count).toBe(3);
    expect(banner.version).toBeGreaterThan(version);

    const drawn = calls.length;
    const redrawn = banner.version;
    banner.userData.setCount(3, 10);
    expect(calls.length).toBe(drawn);
    expect(banner.version).toBe(redrawn);
  });

  it('keeps the oven banner sprite the same shape as its count canvas', () => {
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const canvas = canvases[TEXTURE_KEYS.indexOf('ovenBanner')];
    expect(layout.oven.banner.width / layout.oven.banner.height).toBeCloseTo(
      canvas.width / canvas.height
    );
  });

  it('draws ten-band blue and green awning stripes alongside the red one', () => {
    expect(TEXTURE_KEYS).toEqual(expect.arrayContaining(['stripe', 'stripeBlue', 'stripeGreen']));
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const colours = (key) =>
      new Set(
        canvases[TEXTURE_KEYS.indexOf(key)].__calls
          .filter(([method, prop]) => method === 'set' && prop === 'fillStyle')
          .map(([, , value]) => value)
      );
    for (const key of ['stripe', 'stripeBlue', 'stripeGreen']) {
      const rects = canvases[TEXTURE_KEYS.indexOf(key)].__calls.filter(([m]) => m === 'fillRect');
      expect(rects, key).toHaveLength(10);
    }
    // Colour is the only thing that distinguishes the three.
    expect(colours('stripe')).toEqual(new Set(['#d8382f', '#f6efe4']));
    expect(colours('stripeBlue')).toEqual(new Set(['#2f6fb0', '#f6efe4']));
    expect(colours('stripeGreen')).toEqual(new Set(['#3f8a4f', '#f6efe4']));
  });

  it('letters SERVE onto the table banner', () => {
    expect(TEXTURE_KEYS).toContain('tableBanner');
    const factory = stubCanvasFactory();
    const canvases = [];
    createTextures((w, h) => {
      const c = factory(w, h);
      canvases.push(c);
      return c;
    });
    const banner = canvases[TEXTURE_KEYS.indexOf('tableBanner')];
    const words = banner.__calls
      .filter(([method]) => method === 'fillText')
      .map(([, text]) => text);
    expect(words).toEqual(expect.arrayContaining(['SERVE']));
    expect(layout.dining.banner.width / layout.dining.banner.height).toBeCloseTo(
      banner.width / banner.height
    );
  });
});
