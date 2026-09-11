export const layout = {
  units: "meters",
  // Small lifts that keep coplanar surfaces from fighting in the depth buffer.
  surfaceEps: 0.02,
  floorContact: 0.01,

  ground: {
    // A base apron sits under everything so no gap of sky shows around the lot.
    apron: { x: [-80, 80], z: [-65, 95], y: -0.2 },
    road: { x: [-80, 80], z: [26.5, 40.5], y: -0.15 },
    kerbs: [
      // Sidewalk down to the parking lot.
      { x: [-80, 80], z: [10.5, 10.9], y: [-0.15, 0] },
      // Far side of the road.
      { x: [-80, 80], z: [40.5, 40.9], y: [-0.15, 0] },
    ],
    sidewalk: [
      { x: [-80, 80], z: [8, 10.5] },
      { x: [-24, -11], z: [-8, 8] },
      { x: [-80, 80], z: [40.9, 95] },
      // Paving behind the shop, so the other isometric axis has ground to pan.
      { x: [-80, 80], z: [-65, -8] },
      // Paving either side of the parking lot.
      { x: [-80, -8.5], z: [10.9, 26.5] },
      { x: [8.5, 80], z: [10.9, 26.5] },
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
    floorY: { terracotta: 0.02, paving: 0.0, asphalt: -0.15 },
    lanes: [
      { z: 28.25, direction: -1 },
      { z: 31.75, direction: -1 },
      { z: 35.25, direction: 1 },
      { z: 38.75, direction: 1 },
    ],
    laneMarks: {
      dashed: [30.0, 37.0],
      centre: 33.5,
      centreGap: 0.22,
      width: 0.14,
      dash: 2.2,
      gap: 1.8,
      x: [-80, 80],
    },
  },

  // Two rows of four bays either side of a drive aisle, fenced off from the
  // road by a kerbed planting island with an entrance and an exit gap.
  parking: {
    lot: { x: [-8.5, 8.5], z: [10.9, 24.0] },
    bayX: [-3.9, -1.3, 1.3, 3.9],
    baySpacing: 2.6,
    rows: [
      { z: [11.0, 15.6], carZ: 13.3, facing: Math.PI },
      { z: [19.4, 24.0], carZ: 21.7, facing: 0 },
    ],
    aisle: { z: [15.6, 19.4], centreZ: 17.5 },
    island: { z: [24.0, 26.5], kerbHeight: 0.18, bedInset: 0.35 },
    entrance: { x: [5.0, 8.5], centreX: 6.75 },
    exit: { x: [-8.5, -5.0], centreX: -6.75 },
    segments: [{ x: [-80, -8.5] }, { x: [-5.0, 5.0] }, { x: [8.5, 80] }],
    walkwayX: 0,
    lineWidth: 0.12,
    sidewalkZ: 10.2,
  },

  wall: { thickness: 0.4, height: 1.2, capHeight: 0.15, capWidth: 0.55 },

  perimeter: {
    runs: [
      { axis: "x", z: -8, x: [-11, 9] },
      // Meets the side-wing east face at its inner edge (z = 2 − t/2).
      { axis: "z", x: 9, z: [-8, 1.85] },
    ],
    pillars: [
      [-11, -8],
      [9, -8],
      [9, 6],
      [-11, 2],
    ],
    pillarSize: 0.7,
    pillarHeight: 1.5,
    pillarCapWidth: 0.82,
  },

  kitchen: {
    tileWall: { x: [-3, 6], z: -8, y: [1.2, 2.2], thickness: 0.12 },
    backCounter: {
      x: [-3, 6],
      z: [-7.8, -6.8],
      height: 0.9,
      lip: 0.04,
      shelfY: 0.25,
    },
    island: { x: [-1.5, 3.5], z: [-5.2, -3.6], height: 0.9, shelfY: 0.25 },
    wallShelf: {
      x: [0, 5],
      z: -7.9,
      depth: 0.4,
      y: 1.75,
      railY: 1.6,
      thickness: 0.06,
    },
  },

  diningWing: {
    footprint: { x: [-11, -3], z: [-6, 2] },
    plinthHeight: 1.1,
    wallHeight: 2.2,
    thickness: 0.3,
    west: { x: -11, z: [-8, 2] },
    north: { z: -6, x: [-11, -3] },
    partition: { x: -3, z: [-6, 2], door: [-1, 0.2], lintelY: 1.95 },
    windows: {
      sill: 1.1,
      head: 2.0,
      bays: [
        [-5.3, -3.1],
        [-2.1, 0.1],
      ],
    },
  },

  storefront: {
    z: 2,
    x: [-11, -3],
    thickness: 0.3,
    plinth: [0, 0.9],
    glass: [0.9, 1.95],
    header: [1.95, 2.2],
    posts: [-10.8, -8.6, -6.2, -4.6, -3.2],
    postSize: 0.22,
    door: { x: [-6.2, -4.6] },
    awning: {
      x: [-11, -3.4],
      wallY: 2.3,
      frontY: 1.85,
      frontZ: 3.3,
      valance: 0.25,
    },
    sign: { x: [-8.8, -4.2], y: [2.4, 3.5], thickness: 0.18, archRise: 0.45 },
    lamps: { xs: [-9.5, -4.0], y: 2.4, reach: 0.55, shadeRadius: 0.28 },
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
    mouth: {
      x: 5.65,
      width: 1.1,
      height: 0.85,
      sill: 1.15,
      recess: 0.6,
      frameDepth: 0.22,
    },
    chimney: { center: [7.9, -5.6], size: 0.7, y: [2.4, 4.3] },
    flue: { radius: 0.28, y: [4.3, 5.0], capRadius: 0.36 },
    // Where the player stands to collect pizzas. The kitchen island hides
    // the floor from the camera west of x 4.6, and the player cannot stand
    // past x 5.35 against the oven base.
    pickupZone: { x: [4.6, 5.5], z: [-5.5, -4.1] },
    banner: { y: 3.1, width: 2.2, height: 1.1, bob: 0.08 },
  },

  sideWing: {
    footprint: { x: [5, 9], z: [2, 6] },
    plinthHeight: 1.0,
    wallHeight: 2.2,
    thickness: 0.3,
    window: { z: 6, width: 2.4, height: 0.9, sill: 1.1, centerX: 7 },
    awning: { x: [5, 9], wallY: 2.3, frontY: 1.85, frontZ: 7.1, valance: 0.22 },
  },

  // The queue forms on the plaza off the counter's customer side (+Z) and is
  // fenced by a stanchion-and-rope lane, as in the reference. Who stands in
  // the queue is owned by the simulation, not placed here.
  queue: {
    facing: Math.PI,
    barrier: {
      posts: [
        [2.8, 4.9],
        [2.8, 6.3],
        [2.8, 7.7],
      ],
      height: 0.95,
      postRadius: 0.055,
      baseRadius: 0.17,
      baseHeight: 0.06,
      ropeY: 0.74,
      ropeRadius: 0.028,
    },
    slots: [
      [1.2, 5.1],
      [1.2, 5.9],
      [1.2, 6.5],
      [1.2, 7.1],
      [1.2, 7.7],
    ],
    cashier: {
      x: 2.0,
      z: 3.0,
      facing: 0,
      height: 1.66,
      cloth: "clothRed",
      hair: "hairDark",
      skin: "skin",
      cap: true,
    },
    // The cashier only serves from this patch of floor behind the counter.
    // It is centred on the spawn, so the shop sells before the player moves.
    sellZone: { x: [1.2, 2.8], z: [2.3, 3.4] },
    sellBanner: { y: 3.3, width: 2.8, height: 1.4, bob: 0.08 },
  },

  sim: {
    // One per bay, so the lot itself is what fills up rather than the
    // pedestrian pool. More pedestrians than marked queue slots just join
    // behind the last person in line rather than waiting at the car.
    pedestrians: 8,
    spawnGap: 9.0,
    respawnDelay: 2.0,
    serveSeconds: 0.7,
    boardSeconds: 0.8,
    speeds: { car: 7.5, walk: 1.35 },
    lane: { z: 28.25, enterX: 45, exitX: -45 },
    // Interleaved by row. The pool hands out bays in order, so listing all of
    // row 0 first would leave row 1 permanently empty while only three cars
    // are simulated — and the row 1 walkway route would never be exercised.
    bays: [
      { x: -3.9, z: 13.3, facing: Math.PI, row: 0 },
      { x: 1.3, z: 21.7, facing: 0, row: 1 },
      { x: 1.3, z: 13.3, facing: Math.PI, row: 0 },
      { x: -3.9, z: 21.7, facing: 0, row: 1 },
      { x: -1.3, z: 13.3, facing: Math.PI, row: 0 },
      { x: 3.9, z: 21.7, facing: 0, row: 1 },
      { x: 3.9, z: 13.3, facing: Math.PI, row: 0 },
      { x: -1.3, z: 21.7, facing: 0, row: 1 },
    ],
    car: {
      length: 4.2,
      width: 1.8,
      height: 1.55,
      colours: ["carGreen", "carRed", "carBlue"],
    },
    walk: { doorOffset: 1.1, sidewalkZ: 10.2, plazaZ: 8.6 },
    stride: { frequency: 5.2, amplitude: 0.52, armScale: 0.7 },
    pizza: {
      bakeSeconds: 5,
      ovenCapacity: 10,
      pickupSeconds: 0.3,
      carryMax: 10,
      hopSeconds: 0.3,
      // Thicker than a customer's box so each one in a stack reads at
      // default zoom.
      carriedBox: { size: 0.42, thickness: 0.1 },
    },
    people: [
      { height: 1.72, cloth: "clothBlue", hair: "hairDark", skin: "skin" },
      {
        height: 1.66,
        cloth: "clothPink",
        hair: "hairDark",
        skin: "skinDeep",
        longHair: true,
      },
      {
        height: 1.62,
        cloth: "clothYellow",
        hair: "hairLight",
        skin: "skin",
        longHair: true,
      },
    ],
  },

  traffic: {
    seed: 20260910,
    perLane: 6,
    spawnGap: 14,
    spawnX: 68,
    // High enough that the lot genuinely fills and cars have to wait. At the
    // originally specced 0.18 the honking never once triggered in a ten-minute
    // run; the lot peaked at five of eight bays. Measured: 0.6 is where it
    // first fills, 0.7 gives regular honking and occasional balking.
    pizzaChance: 0.7,
    follow: { minGap: 1.6, headway: 0.9, accel: 4.5, decel: 9.0 },
    laneChange: {
      changeSeconds: 1.2,
      mergeDistance: 26,
      overtakeGap: 9,
      // A bumper-to-bumper gap, not centre-to-centre.
      changeClearance: 4,
    },
    waitSeconds: 10,
    hornInterval: 1.2,
    types: [
      {
        key: "car",
        model: "car",
        share: 0.7,
        cruise: 9.0,
        length: 4.2,
        width: 1.8,
        height: 1.55,
        wantsPizza: true,
        colours: ["carGreen", "carRed", "carBlue"],
      },
      {
        key: "van",
        model: "van",
        share: 0.22,
        cruise: 8.0,
        length: 5.2,
        width: 2.0,
        height: 2.3,
        wantsPizza: false,
        colours: ["vanBody"],
      },
      {
        key: "bus",
        model: "bus",
        share: 0.08,
        cruise: 7.0,
        length: 9.0,
        width: 2.4,
        height: 3.0,
        wantsPizza: false,
        colours: ["busBody"],
      },
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
    frustumSize: 34,
    direction: [-1, 0.82, 1],
    distance: 60,
    target: [0, 1.2, 13],
    minZoom: 1,
    maxZoom: 2,
    panPadding: 0,
  },

  envelopes: {
    ground: { min: [-80, -0.25, -65], max: [80, 0.1, 95] },
    parking: { min: [-80, -0.2, 10.5], max: [80, 0.6, 26.6] },
    perimeter: { min: [-11.5, 0, -8.5], max: [9.5, 1.7, 6.5] },
    diningWing: { min: [-11.4, 0, -8.4], max: [-2.8, 2.3, 2.2] },
    storefront: { min: [-11.4, 0, 1.7], max: [-2.9, 4.2, 3.6] },
    kitchen: { min: [-3.2, 0, -8.2], max: [6.2, 2.3, -3.5] },
    oven: { min: [5.4, 0, -6.6], max: [9.0, 5.1, -3.0] },
    counter: { min: [-1.2, 0, 1.3], max: [5.2, 1.2, 4.6] },
    sideWing: { min: [4.8, 0, 1.8], max: [9.4, 2.4, 7.3] },
    queue: { min: [-2.0, 0, 4.6], max: [3.1, 1.8, 8.0] },
    simulation: { min: [-74, 0, 4], max: [74, 2.2, 42] },
    traffic: { min: [-80, 0, 25], max: [80, 3.4, 42] },
  },
};
