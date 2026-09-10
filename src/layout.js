export const layout = {
  units: 'meters',

  ground: {
    // A base apron sits under everything so no gap of sky shows around the lot.
    apron: { x: [-40, 40], z: [-16, 40], y: -0.2 },
    road: { x: [-40, 40], z: [14, 40], y: -0.15 },
    curb: { x: [-40, 40], z: [13.6, 14], y: [-0.15, 0] },
    sidewalk: [
      { x: [-40, 40], z: [8, 13.6] },
      { x: [-24, -11], z: [-8, 8] },
    ],
    plaza: [
      { x: [-11, -3], z: [2, 8] },
      { x: [-3, 5], z: [4, 8] },
      { x: [5, 9], z: [6, 8] },
    ],
    terracotta: [
      { x: [-3, 9], z: [-8, 4] },
      { x: [5, 9], z: [4, 6] },
      { x: [-11, -3], z: [-8, -6] },
    ],
    diningFloor: { x: [-11, -3], z: [-6, 2], y: 0.06 },
    floorY: { terracotta: 0.02, paving: 0.0 },
    parking: { stripeWidth: 0.12, stripeLength: 5.0, spacing: 2.6, count: 9, startX: -13, z: [14.2, 19.2] },
    laneDivider: { z: 22, width: 0.14, dash: 2.0, gap: 1.6, x: [-40, 40] },
  },

  wall: { thickness: 0.4, height: 1.2, capHeight: 0.15, capWidth: 0.55 },

  perimeter: {
    runs: [
      { axis: 'x', z: -8, x: [-11, 9] },
      { axis: 'z', x: 9, z: [-8, 2] },
      { axis: 'z', x: -11, z: [-8, -6] },
    ],
    pillars: [[-11, -8], [9, -8], [9, 6], [-11, 2]],
    pillarSize: 0.7,
    pillarHeight: 1.5,
    pillarCapWidth: 0.82,
  },

  kitchen: {
    tileWall: { x: [-3, 6], z: -8, y: [1.2, 3.2], thickness: 0.12 },
    backCounter: { x: [-3, 6], z: [-7.8, -6.8], height: 0.9, lip: 0.04, shelfY: 0.25 },
    island: { x: [-1.5, 3.5], z: [-5.2, -3.6], height: 0.9, shelfY: 0.25 },
    wallShelf: { x: [0, 5], z: -7.9, depth: 0.4, y: 2.0, railY: 1.85, thickness: 0.06 },
  },

  diningWing: {
    footprint: { x: [-11, -3], z: [-6, 2] },
    plinthHeight: 1.1,
    wallHeight: 2.8,
    thickness: 0.3,
    west: { x: -11, z: [-6, 2] },
    north: { z: -6, x: [-11, -3] },
    partition: { x: -3, z: [-6, 2], door: [-1, 0.2], lintelY: 2.1 },
    windows: { sill: 1.1, head: 2.6, bays: [[-5.3, -3.1], [-2.1, 0.1]] },
  },

  storefront: {
    z: 2,
    x: [-11, -3],
    thickness: 0.3,
    plinth: [0, 0.9],
    glass: [0.9, 2.5],
    header: [2.5, 2.8],
    posts: [-10.8, -8.6, -6.2, -4.6, -3.2],
    postSize: 0.22,
    door: { x: [-6.2, -4.6] },
    awning: { x: [-11, -3.4], wallY: 2.9, frontY: 2.45, frontZ: 3.3, valance: 0.25 },
    sign: { x: [-8.8, -4.2], y: [3.0, 4.1], thickness: 0.18, archRise: 0.45 },
    lamps: { xs: [-9.5, -4.0], y: 3.1, reach: 0.55, shadeRadius: 0.28 },
  },

  counter: {
    main: { x: [-1, 5], z: [3.6, 4.4] },
    ret: { x: [4.2, 5], z: [1.5, 4.4] },
    baseHeight: 0.95,
    topHeight: 1.1,
    overhang: 0.12,
  },

  oven: {
    base: { x: [5.6, 8.8], z: [-6.4, -3.2], y: [0, 1.0] },
    cap: [1.0, 1.15],
    dome: { center: [7.2, 1.15, -4.8], radius: 1.55, scaleY: 0.95 },
    mouth: { x: 5.65, width: 1.1, height: 0.85, sill: 1.15, recess: 0.6, frameDepth: 0.22 },
    chimney: { center: [7.9, -5.6], size: 0.7, y: [2.4, 4.3] },
    flue: { radius: 0.28, y: [4.3, 5.0], capRadius: 0.36 },
  },

  sideWing: {
    footprint: { x: [5, 9], z: [2, 6] },
    plinthHeight: 1.0,
    wallHeight: 2.8,
    thickness: 0.3,
    window: { z: 6, width: 2.4, height: 1.4, sill: 1.1, centerX: 7 },
    awning: { x: [5, 9], wallY: 3.0, frontY: 2.55, frontZ: 7.1, valance: 0.22 },
  },

  // The queue forms on the plaza off the counter's customer side (+Z) and is
  // fenced by a stanchion-and-rope lane, as in the reference.
  queue: {
    facing: Math.PI,
    barrier: {
      posts: [[2.8, 4.9], [2.8, 6.3], [2.8, 7.7]],
      height: 0.95,
      postRadius: 0.055,
      baseRadius: 0.17,
      baseHeight: 0.06,
      ropeY: 0.74,
      ropeRadius: 0.028,
    },
    people: [
      { x: 1.2, z: 5.1, height: 1.72, cloth: 'clothBlue', hair: 'hairDark', skin: 'skin' },
      { x: 0.5, z: 5.9, height: 1.62, cloth: 'clothYellow', hair: 'hairLight', skin: 'skin', longHair: true },
      { x: -0.1, z: 6.5, height: 1.28, cloth: 'clothGreen', hair: 'hairLight', skin: 'skin' },
      { x: -0.7, z: 7.1, height: 1.66, cloth: 'clothPink', hair: 'hairDark', skin: 'skinDeep', longHair: true },
      { x: -1.3, z: 7.7, height: 1.3, cloth: 'clothOrange', hair: 'hairDark', skin: 'skin', cap: true },
    ],
  },

  lighting: {
    hemi: { sky: 0xbcd6ff, ground: 0x6b5a45, intensity: 0.55 },
    sun: {
      color: 0xfff2dd,
      intensity: 2.1,
      position: [-18, 26, 14],
      shadowMapSize: 2048,
      shadowBounds: 26,
      shadowBias: -0.0005,
    },
    warm: { color: 0xffb066, intensity: 12, distance: 9, decay: 2 },
    fire: { color: 0xff7a2a, intensity: 18, distance: 8, decay: 2 },
  },

  camera: {
    frustumSize: 26,
    direction: [0.4, 1, 0.4],
    distance: 60,
    target: [0, 1.2, -0.5],
  },

  envelopes: {
    ground: { min: [-40, -0.25, -16], max: [40, 0.1, 40] },
    perimeter: { min: [-11.5, 0, -8.5], max: [9.5, 1.7, 6.5] },
    diningWing: { min: [-11.4, 0, -6.4], max: [-2.8, 2.9, 2.2] },
    storefront: { min: [-11.4, 0, 1.7], max: [-2.9, 4.8, 3.6] },
    kitchen: { min: [-3.2, 0, -8.2], max: [6.2, 3.3, -3.5] },
    oven: { min: [5.4, 0, -6.6], max: [9.0, 5.1, -3.0] },
    counter: { min: [-1.2, 0, 1.3], max: [5.2, 1.2, 4.6] },
    sideWing: { min: [4.8, 0, 1.8], max: [9.4, 3.2, 7.3] },
    queue: { min: [-2.0, 0, 4.6], max: [3.1, 1.8, 8.0] },
  },
};
