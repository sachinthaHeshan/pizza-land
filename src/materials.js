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
  'skin',
  'skinDeep',
  'hairDark',
  'hairLight',
  'denim',
  'shoe',
  'rope',
  'clothOrange',
  'clothPink',
  'clothGreen',
  'clothYellow',
  'clothBlue',
  'carGreen',
  'carRed',
  'carBlue',
  'carGlass',
  'tyre',
  'headlight',
  'clothRed',
  'pizzaBox',
  'planting',
  'laneCentre',
  'busBody',
  'vanBody',
  'horn',
];

// World units spanned by one full texture image. The geometry helpers scale
// each mesh's UVs by its own size divided by this, so texture density stays
// constant whether a surface is 1 unit wide or 20. `null` means "stretch the
// image across the face once" — used for the signboard artwork.
const TILE = {
  brick: 3.5,
  terracotta: 2.1,
  wallTile: 1.2,
  stripe: 3.5,
  wood: 1.5,
  plaster: 3.0,
  paving: 3.6,
  asphalt: 4.0,
  metal: 1.5,
  sign: null,
};

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
    metalDark: standard('metalDark', { color: 0x777d85, roughness: 0.45, metalness: 0.7 }),
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
    skin: standard('skin', { color: 0xf0c09a, roughness: 0.78, metalness: 0.0 }),
    skinDeep: standard('skinDeep', { color: 0xc98d63, roughness: 0.78, metalness: 0.0 }),
    hairDark: standard('hairDark', { color: 0x3a2418, roughness: 0.82, metalness: 0.0 }),
    hairLight: standard('hairLight', { color: 0xa9713a, roughness: 0.82, metalness: 0.0 }),
    denim: standard('denim', { color: 0x3f5c86, roughness: 0.8, metalness: 0.0 }),
    shoe: standard('shoe', { color: 0x4a3b30, roughness: 0.7, metalness: 0.0 }),
    rope: standard('rope', { color: 0xa32220, roughness: 0.75, metalness: 0.0 }),
    clothOrange: standard('clothOrange', { color: 0xe08133, roughness: 0.76, metalness: 0.0 }),
    clothPink: standard('clothPink', { color: 0xe6a0a6, roughness: 0.76, metalness: 0.0 }),
    clothGreen: standard('clothGreen', { color: 0x3f7a46, roughness: 0.76, metalness: 0.0 }),
    clothYellow: standard('clothYellow', { color: 0xe8c552, roughness: 0.76, metalness: 0.0 }),
    clothBlue: standard('clothBlue', { color: 0x3d6fa8, roughness: 0.76, metalness: 0.0 }),
    carGreen: standard('carGreen', { color: 0x6f9463, roughness: 0.38, metalness: 0.25 }),
    carRed: standard('carRed', { color: 0xb8443c, roughness: 0.38, metalness: 0.25 }),
    carBlue: standard('carBlue', { color: 0x3f6ca8, roughness: 0.38, metalness: 0.25 }),
    carGlass: standard('carGlass', {
      color: 0x2c3a45,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    }),
    tyre: standard('tyre', { color: 0x24262a, roughness: 0.9, metalness: 0.0 }),
    headlight: standard('headlight', { color: 0xfff0cc, roughness: 0.25, metalness: 0.0 }),
    clothRed: standard('clothRed', { color: 0xb8332c, roughness: 0.76, metalness: 0.0 }),
    pizzaBox: standard('pizzaBox', { color: 0xd8b98a, roughness: 0.85, metalness: 0.0 }),
    planting: standard('planting', { color: 0x5c7f4a, roughness: 0.92, metalness: 0.0 }),
    laneCentre: standard('laneCentre', { color: 0xe8d14a, roughness: 0.8, metalness: 0.0 }),
    busBody: standard('busBody', { color: 0xc9843a, roughness: 0.42, metalness: 0.2 }),
    vanBody: standard('vanBody', { color: 0xe4e1d8, roughness: 0.45, metalness: 0.18 }),
    horn: new THREE.MeshBasicMaterial({ name: 'horn', color: 0xffd66b }),
    glow: new THREE.MeshBasicMaterial({ name: 'glow', color: 0xffcf8a }),
    ember: new THREE.MeshBasicMaterial({ name: 'ember', color: 0xff7a2a }),
  };

  for (const [key, material] of Object.entries(materials)) {
    material.userData.tile = key in TILE ? TILE[key] : null;
  }

  return materials;
}
