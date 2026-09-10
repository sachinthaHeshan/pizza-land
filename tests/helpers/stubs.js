import * as THREE from 'three';
import { MATERIAL_KEYS } from '../../src/materials.js';

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
  return materials;
}
