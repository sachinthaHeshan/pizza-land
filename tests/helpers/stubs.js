import * as THREE from 'three';
import { MATERIAL_KEYS } from '../../src/materials.js';
import { ovenBannerTexture } from '../../src/textures.js';

export function stubCanvasFactory() {
  return (width, height) => {
    const calls = [];
    const ctx = new Proxy(
      { calls, canvas: null },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          return (...args) => {
            calls.push([prop, ...args]);
          };
        },
        set(target, prop, value) {
          // Recorded too: colour is set, not called, so a test that only reads
          // the drawing calls cannot tell a red stripe from a blue one.
          calls.push(['set', prop, value]);
          target[prop] = value;
          return true;
        },
      }
    );
    return { width, height, getContext: () => ctx, __calls: calls };
  };
}

export function stubMaterials() {
  const materials = {};
  for (const key of MATERIAL_KEYS) {
    materials[key] = new THREE.MeshStandardMaterial({ name: key });
  }
  // The simulation sets the oven banner's count every frame (the texture
  // redraws only when the count changes), so the stub needs a working count
  // texture rather than a bare material.
  materials.ovenBanner.map = ovenBannerTexture(stubCanvasFactory());
  return materials;
}
