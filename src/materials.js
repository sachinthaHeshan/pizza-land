import * as THREE from 'three';

export const MATERIAL_KEYS = [
  'brick',
  'stone',
  'terracotta',
  'wallTile',
  'stripe',
  'wood',
  'woodDark',
  'plaster',
  'paving',
  'asphalt',
  'roadPaint',
  'metal',
  'metalDark',
  'glass',
  'glow',
  'greenPaint',
  'lampShade',
  'sign',
  'ember',
];

export function createMaterials(textures) {
  const standard = (name, options) =>
    new THREE.MeshStandardMaterial({ name, ...options });

  const materials = {
    brick: standard('brick', { map: textures.brick, roughness: 0.92, metalness: 0.02 }),
    stone: standard('stone', { color: 0xe4ddcd, roughness: 0.85, metalness: 0.02 }),
    terracotta: standard('terracotta', { map: textures.terracotta, roughness: 0.85, metalness: 0.02 }),
    wallTile: standard('wallTile', { map: textures.wallTile, roughness: 0.42, metalness: 0.04 }),
    stripe: standard('stripe', { map: textures.stripe, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide }),
    wood: standard('wood', { map: textures.wood, roughness: 0.68, metalness: 0.02 }),
    woodDark: standard('woodDark', { color: 0x5c3a22, roughness: 0.72, metalness: 0.02 }),
    plaster: standard('plaster', { map: textures.plaster, roughness: 0.95, metalness: 0.0 }),
    paving: standard('paving', { map: textures.paving, roughness: 0.9, metalness: 0.02 }),
    asphalt: standard('asphalt', { map: textures.asphalt, roughness: 0.97, metalness: 0.0 }),
    roadPaint: standard('roadPaint', { color: 0xf2efe6, roughness: 0.8, metalness: 0.0 }),
    metal: standard('metal', { map: textures.metal, roughness: 0.32, metalness: 0.82 }),
    metalDark: standard('metalDark', { color: 0x3a3d42, roughness: 0.45, metalness: 0.7 }),
    glass: standard('glass', {
      color: 0xbcd8e8,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
    greenPaint: standard('greenPaint', { color: 0x2f4a35, roughness: 0.6, metalness: 0.04 }),
    lampShade: standard('lampShade', {
      color: 0x2f4a35,
      roughness: 0.6,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    sign: standard('sign', { map: textures.sign, roughness: 0.6, metalness: 0.03 }),
    glow: new THREE.MeshBasicMaterial({ name: 'glow', color: 0xffcf8a }),
    ember: new THREE.MeshBasicMaterial({ name: 'ember', color: 0xff7a2a }),
  };

  return materials;
}
