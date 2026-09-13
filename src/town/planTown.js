import { mulberry32 } from '../utils/random.js';

// Plain logic for the town across the road: it turns layout.town and its seed
// into lots, trees, props, lawns and obstacle footprints. The builders draw
// the plan and the player's obstacles read it, so what you see is what blocks
// you. No three.js here, so the rules step deterministically in tests.

const SHOP_WALLS = ['brick', 'wallMint', 'wallPeach', 'wallSky', 'wallButter'];
const HOUSE_WALLS = ['wallMint', 'wallPeach', 'wallSky', 'wallButter'];
const ROOFS = ['roofRed', 'roofSlate'];
const AWNINGS = ['stripe', 'stripeBlue', 'stripeGreen'];
const SIGNS = ['greenPaint', 'roofRed', 'roofSlate', 'woodDark'];

// Footprint (w along x, d along z) and height of each prop, in metres.
const PROP_SIZES = {
  lamp: { w: 0.3, d: 0.3, h: 3.8 },
  bench: { w: 1.6, d: 0.5, h: 0.9 },
  bin: { w: 0.5, d: 0.5, h: 0.9 },
  busStop: { w: 3.2, d: 1.8, h: 2.6 },
  planter: { w: 0.8, d: 0.8, h: 1.1 },
  hedge: { d: 0.4, h: 0.8 },
  fence: { w: 0.1, h: 0.9 },
};
const TRUNK_SIZE = 0.5;

const pick = (list, roll) => list[Math.floor(roll * list.length)];
const between = ([lo, hi], roll) => lo + (hi - lo) * roll;
const footprint = (x, z, w, d) => ({ x: [x - w / 2, x + w / 2], z: [z - d / 2, z + d / 2] });
const prop = (kind, x, z, facing, size) => ({ kind, x, z, facing, size });

// Splits the town's width into lots from left to right, with occasional alleys.
function lotSpans(rng, town) {
  const { minWidth, maxWidth, alleyChance, alleyWidth } = town.lot;
  const spans = [];
  let x = town.x[0];
  while (town.x[1] - x >= minWidth) {
    const width = Math.min(between([minWidth, maxWidth], rng()), town.x[1] - x);
    spans.push([x, x + width]);
    x += width;
    if (rng() < alleyChance) x += between(alleyWidth, rng());
  }
  return spans;
}

export function planTown(layout) {
  const t = layout.town;
  const rng = mulberry32(t.seed);
  const lots = [];
  const trees = [];
  const props = [];
  const lawns = [];

  // First row: shops and one-storey houses. Each lot draws its rolls in a
  // fixed order, so one rule change never reshuffles the rest of the town.
  for (const x of lotSpans(rng, t)) {
    const [kindRoll, storeyRoll, wallRoll, roofRoll, awningRoll, signRoll, chimneyRoll] =
      [rng(), rng(), rng(), rng(), rng(), rng(), rng()];
    const z = [t.firstRow.back, t.firstRow.front];
    if (kindRoll < t.firstRow.shopChance) {
      const storeys = storeyRoll < t.firstRow.twoStoreyChance ? 2 : 1;
      const walls = t.shopWalls[storeys - 1];
      lots.push({
        row: 'first', kind: 'shop', x, z, storeys, walls, rise: 0, height: walls + t.parapet,
        wall: pick(SHOP_WALLS, wallRoll), awning: pick(AWNINGS, awningRoll), sign: pick(SIGNS, signRoll),
        chimney: false,
      });
    } else {
      const walls = t.houseWalls[0];
      const rise = t.roofRise[0];
      const chimney = chimneyRoll < t.chimney.chance;
      lots.push({
        row: 'first', kind: 'house', x, z, storeys: 1, walls, rise,
        height: walls + rise + (chimney ? t.chimney.rise : 0),
        wall: pick(HOUSE_WALLS, wallRoll), roof: pick(ROOFS, roofRoll), chimney,
      });
    }
  }

  // Second row: houses.
  for (const x of lotSpans(rng, t)) {
    const [storeyRoll, wallRoll, roofRoll, chimneyRoll] = [rng(), rng(), rng(), rng()];
    const storeys = storeyRoll < t.secondRow.twoStoreyChance ? 2 : 1;
    const walls = t.houseWalls[storeys - 1];
    const rise = t.roofRise[storeys - 1];
    const chimney = chimneyRoll < t.chimney.chance;
    lots.push({
      row: 'second', kind: 'house', x, z: [t.secondRow.back, t.secondRow.front], storeys, walls, rise,
      height: walls + rise + (chimney ? t.chimney.rise : 0),
      wall: pick(HOUSE_WALLS, wallRoll), roof: pick(ROOFS, roofRoll), chimney,
    });
  }

  // Kerb strip: a tree every 12 m with a bench beside it and a bin at every
  // other tree, then a lamp midway between each pair — or the bus stop.
  const k = t.kerbStrip;
  const kerbTreeXs = [];
  for (let x = k.firstTreeX, i = 0; x + k.benchOffset + PROP_SIZES.bench.w / 2 <= t.x[1]; x += k.treeSpacing, i++) {
    kerbTreeXs.push(x);
    trees.push({ kind: 'round', x, z: k.treeZ, height: between(t.trees.round, rng()) });
    props.push(prop('bench', x + k.benchOffset, k.benchZ, -1, PROP_SIZES.bench));
    if (i % 2 === 0) props.push(prop('bin', x - k.binOffset, k.binZ, -1, PROP_SIZES.bin));
  }
  const stopZ = k.lampZ - PROP_SIZES.lamp.d / 2 + PROP_SIZES.busStop.d / 2;
  for (let i = 1; i < kerbTreeXs.length; i++) {
    const mid = (kerbTreeXs[i - 1] + kerbTreeXs[i]) / 2;
    if (Math.abs(mid - k.busStopX) < 1e-6) {
      props.push(prop('busStop', mid, stopZ, -1, PROP_SIZES.busStop));
    } else {
      props.push(prop('lamp', mid, k.lampZ, -1, PROP_SIZES.lamp));
    }
  }

  // Rear yards: a low fence along every first-row lot edge, shared edges once.
  const firstLots = lots.filter((lot) => lot.row === 'first');
  const fenceXs = [];
  for (const lot of firstLots) {
    for (const x of lot.x) if (!fenceXs.some((f) => Math.abs(f - x) < 1e-6)) fenceXs.push(x);
  }
  const [fenceZ0, fenceZ1] = t.rearFence.z;
  for (const x of fenceXs) {
    const size = { w: PROP_SIZES.fence.w, d: fenceZ1 - fenceZ0, h: PROP_SIZES.fence.h };
    props.push(prop('fence', x, (fenceZ0 + fenceZ1) / 2, 1, size));
  }

  // Front lane: a planter beside each first-row door, a bench at every second lot.
  firstLots.forEach((lot, i) => {
    const cx = (lot.x[0] + lot.x[1]) / 2;
    props.push(prop('planter', cx + t.laneProps.planterOffset, t.laneProps.planterZ, 1, PROP_SIZES.planter));
    if (i % 2 === 1) props.push(prop('bench', cx, t.laneProps.benchZ, 1, PROP_SIZES.bench));
  });

  // Front gardens: a lawn and a hedge with a gap at the door for each house.
  const g = t.gardenHedge;
  for (const lot of lots.filter((l) => l.row === 'second')) {
    lawns.push({ x: [...lot.x], z: [...t.secondRow.garden] });
    const cx = (lot.x[0] + lot.x[1]) / 2;
    const segments = [
      [lot.x[0] + g.inset, cx - g.doorGap / 2],
      [cx + g.doorGap / 2, lot.x[1] - g.inset],
    ];
    for (const [a, b] of segments) {
      const size = { w: b - a, d: PROP_SIZES.hedge.d, h: PROP_SIZES.hedge.h };
      props.push(prop('hedge', (a + b) / 2, g.z, 1, size));
    }
  }

  // Tree line: one tree per slot, nudged a little, mostly pines.
  const tl = t.treeLine;
  for (let x = tl.firstX; x <= t.x[1] - tl.spacing / 2; x += tl.spacing) {
    const [jitterRoll, zRoll, kindRoll, heightRoll] = [rng(), rng(), rng(), rng()];
    const kind = kindRoll < tl.pineChance ? 'pine' : 'round';
    trees.push({
      kind,
      x: x + (jitterRoll * 2 - 1) * tl.jitter,
      z: between(tl.treeZ, zRoll),
      height: between(t.trees[kind], heightRoll),
    });
  }

  const obstacles = [
    ...lots.map((lot) => ({ x: [...lot.x], z: [...lot.z] })),
    ...trees.map((tree) => footprint(tree.x, tree.z, TRUNK_SIZE, TRUNK_SIZE)),
    ...props.map((p) => footprint(p.x, p.z, p.size.w, p.size.d)),
  ];

  return { lots, trees, props, lawns, obstacles };
}
