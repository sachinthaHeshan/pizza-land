# Far-Side Town — Design

Date: 2026-09-12
Status: Draft — awaiting review
Builds on: `2026-09-11-oven-pickup-and-carry-design.md`, and the user's widened
ground in `src/layout.js` (far sidewalk strip `x −80…80, z 40.9…95`)

## Goal

Fill the empty ground across the road with a small town, so panning past the
road shows shops, houses, trees and street furniture instead of blank paving.
The town is static scenery the player can walk into, and it never hides the
road or the cars.

## Scope

In scope:

- A kerb strip of street trees, lamps, benches, bins and one bus stop
- A first row of shops and houses and a second row of houses, on seeded lots
- Front gardens, hedges, fences, planters and a sparse tree line
- Collisions with town buildings, trees and props
- The sun's shadow area following the camera, so shadows exist wherever the
  player pans

Out of scope:

- The paving behind the pizza shop (`z −65…−8`)
- Moving people, cars or buses in the town (the bus stop is scenery)
- Interiors, lettering on signs, real lamp lights, night lighting, level of detail

## How the camera sees the town

The camera direction is `[-1, 0.82, 1]`, so the camera sits on the +z, −x side
of everything it looks at. Two consequences shape the whole design:

- **Only faces pointing +z or −x, and roofs, are ever visible.** A face pointing
  −z (toward the road, from the town) is never seen. Every shopfront, awning,
  sign and front door therefore faces +z.
- **A building hides the ground on its road side.** A ray toward the camera
  rises 0.82 m per metre of +z, so a building of height `h` whose road-side wall
  is at `z = B` hides ground with `z > B − h / 0.82`. The first row's road-side
  wall at `z 52` hides the far lane only above 10.9 m. At 7 m or lower it leaves
  the kerb strip (`z < 43.5`) visible at ground level.

In the default view the town shows in the bottom-right corner: kerb-strip
points with `x > −15.5` are on screen. Panning toward the far side shows the
town out to `z 95`.

## Layout

All bands run the full width `x −78…78`, leaving 2 m to the map edge. Nothing
is placed on the road or the far kerb (`z < 41`).

| Band | z | Contents |
|---|---|---|
| Kerb strip | 41–44 | street trees every 12 m from `x −72`; a lamp midway between each pair; a bench 3 m to the +x side of each tree, facing the road; a bin 3 m to the −x side of every other tree; one bus stop at `x −6`, in place of that bay's lamp |
| Rear yards | 44–52 | the first row's back walls face the road; low fences along each lot's side edges |
| First row | 52–61 | shops and houses, road-side wall at `z 52`, fronts on the `z 61` face |
| Front lane | 61–74 | paving in front of the first row; a planter beside each first-row door, and a bench in front of every second lot |
| Second row | 74–83 | houses, back wall at `z 74`, fronts on the `z 83` face |
| Front gardens | 83–88 | a lawn and a low hedge per house, with a gap at the door |
| Tree line | 89–93 | one tree per 12 m slot from `x −72`, shifted by up to ±1 m so trees stay at least 10 m apart; a pine with chance 0.7, otherwise a round tree; at most 6 m tall |

Tree-line trunks stand at z 90.2–92.8, at least 7.1 m in front of the
second-row fronts at z 83. A ray from a front door toward the camera passes
about 0.9 m over a 6 m pine there, so front doors show over and between the
trees.

### Lots

Each row is filled left to right from `x −78`:

- A lot is `10 + 4·r` m wide, where `r` comes from the seeded generator.
- After each lot, an alley `2 + 2·r` m wide follows with chance 0.35.
- A lot that would pass `x 78` is trimmed to fit, or dropped if that leaves less
  than 10 m.
- First row: a shop with chance 0.6, otherwise a house. A shop has 2 storeys
  with chance 0.4. First-row houses have 1 storey.
- Second row: houses with 2 storeys at chance 0.7, otherwise 1.

### Heights

| Building | Walls | Top | Total |
|---|---|---|---|
| Shop, 1 storey | 3.4 m | parapet 0.4 m | 3.8 m |
| Shop, 2 storeys | 6.4 m | parapet 0.4 m | 6.8 m |
| House, 1 storey | 3.0 m | roof rise 2.0 m | 5.0 m |
| House, 2 storeys | 6.0 m | roof rise 2.4 m | 8.4 m |

First-row buildings stay at 7 m or lower, and second-row buildings at 9 m or lower.

### Randomness

Every random choice (lot widths, alleys, kinds, storeys, colours, chimneys,
tree-line offsets and kinds)
comes from `mulberry32(layout.town.seed)`, so the town is identical on every
load and in every test. Nothing uses `Math.random`.

## Look

Chunky low-poly boxes like the pizza shop, sized to the 1.66 m figures (storeys
about 3 m, doors 2.1 m).

**Shops.** Brick or pastel plaster walls. On the `+z` face: a ground-floor glass
front with a door, a striped awning (red, blue or green with cream), and a
signboard above it with a stone border and no lettering. A flat roof with a low
parapet. Two-storey shops get upstairs windows with stone frames on the `+z` and
`−x` faces.

**Houses.** Pastel plaster walls (mint, peach, sky blue or butter yellow). A
pitched roof in terracotta red or slate grey, with its ridge running along x. A
front door with a step and white-framed windows on the `+z` face, windows on the
`−x` face, and a brick chimney on about half.

**Trees.** Round trees: a bark trunk under a faceted green canopy, 4.5–5.2 m
tall. Pines: a short trunk under two stacked cones, 5–6 m tall.

**Props.**
- Lamp: a dark pole with a glowing head, 3.8 m tall.
- Bench: wooden slats on metal legs.
- Bin: dark green with a metal lid.
- Bus stop: a roof, a glass back panel on the `+z` side, a bench inside and a
  sign post, 3.2 × 1.8 m and 2.6 m tall.
- Hedge: a dark green box 0.8 m tall.
- Fence: stone-coloured posts and two rails.
- Planter: a stone box with a round shrub.

**Ground.** Lawns are `materials.planting` slabs laid `surfaceEps` above the
user's far sidewalk, which stays a single strip.

**Shadows.** Everything casts and receives shadows, except glass and the lamp
glow.

## Module structure

```
src/town/planTown.js     NEW  plain logic: layout.town + seed → lots, trees, props and obstacle footprints
src/town/buildings.js    NEW  createShop / createHouse from a lot description
src/town/nature.js       NEW  createRoundTree / createPine
src/town/props.js        NEW  lamp, bench, bin, bus stop, hedge, fence, planter builders
src/town/createTown.js   NEW  builds the plan with the builders, then merges one mesh per material
src/sim/obstacles.js     playerObstacles also returns planTown(layout).obstacles
src/scene.js             adds the 'town' part; forwards the sun as shop.userData.sun
src/lighting.js          exposes the sun; exports followSun; shadow box sized to the view
src/main.js              one targeted call per frame: followSun(shop.userData.sun, controls.target, layout)
src/materials.js         new flat materials and two stripe materials (see Materials)
src/textures.js          the stripe generator takes a colour; adds stripeBlue and stripeGreen
src/layout.js            new town block and envelopes.town; lighting.sun.shadowBounds and shadowMapSize raised
```

Town files live together in `src/town/` because they change together.

### Contracts

```js
planTown(layout) -> {
  lots:    [{ row: 'first' | 'second', kind: 'shop' | 'house', x: [x0, x1], z: [back, front],
              storeys, walls, rise, height, wall, roof, awning, sign, chimney }],
           // walls: wall height; rise: roof rise (houses); height: total, including any chimney
  trees:   [{ kind: 'round' | 'pine', x, z, height }],
  props:   [{ kind: 'lamp' | 'bench' | 'bin' | 'busStop' | 'hedge' | 'fence' | 'planter',
              x, z, facing, size }],
  lawns:   [{ x: [x0, x1], z: [z0, z1] }],
  obstacles: [{ x: [x0, x1], z: [z0, z1] }],   // every lot, tree trunk and prop footprint
}

createShop(materials, lot)  -> THREE.Group   // front on the +z face at lot.z[1]
createHouse(materials, lot) -> THREE.Group
shopSignCentre(lot), houseDoorCentre(lot) -> THREE.Vector3
// the world points just in front of a shop's sign and a house's door; the
// builders and the visibility test both use them
createRoundTree(materials, tree) / createPine(materials, tree) -> THREE.Group
create<Prop>(materials, prop) -> THREE.Group

createTown(materials, layout) -> THREE.Group named 'town'
// Children are merged meshes, one per material, named `town-<materialName>`.

followSun(sun, target, layout): void
// Moves sun.target to target snapped to whole shadow texels, and the sun to
// that point plus layout.lighting.sun.position (now an offset from the target).
```

### Merging

`createTown` builds ordinary meshes into a temporary group, updates world
matrices, then for each material:

1. Clones each geometry and applies its mesh's world matrix.
2. Converts indexed geometries to non-indexed, so boxes, cones, cylinders and
   faceted canopies merge together.
3. Keeps only `position`, `normal` and `uv`, then calls `mergeGeometries` from
   `three/addons/utils/BufferGeometryUtils.js`.
4. Creates one mesh per material and disposes the temporary geometries.

Merged meshes cast and receive shadows unless the material is transparent or
does not write depth.

### Materials

New keys, all flat colours unless noted: `wallMint`, `wallPeach`, `wallSky`,
`wallButter`, `roofRed`, `roofSlate`, `foliage`, `pine`, `bark`, `hedge`, and
`stripeBlue` and `stripeGreen` on new stripe textures with the same tile size as
`stripe`.

Reused materials: `brick` (shop walls, chimneys), `stone` (frames, borders,
fences, planters, parapets), `glass`, `glow` (lamp heads), `greenPaint` (bins,
signs), `woodDark` and `wood` (benches, signs), `metalDark` (poles, legs, lids),
`planting` (lawns), `stripe`.

### Layout

```js
town: {
  seed: 20260912,
  x: [-78, 78],
  kerbStrip: { z: [41, 44], treeSpacing: 12, firstTreeX: -72, busStopX: -6 },
  firstRow:  { back: 52, front: 61, lane: [61, 74], shopChance: 0.6, twoStoreyChance: 0.4, maxHeight: 7 },
  secondRow: { back: 74, front: 83, garden: [83, 88], twoStoreyChance: 0.7, maxHeight: 9 },
  lot: { minWidth: 10, maxWidth: 14, alleyChance: 0.35, alleyWidth: [2, 4] },
  treeLine: { z: [89, 93], minSpacing: 10, maxHeight: 6 },
},
envelopes.town: { min: [-78, 0, 41], max: [78, 9, 95] },
```

`lighting.sun.shadowBounds` rises from 26 to 50, and the shadow camera's near
plane moves from 1 to −20 (orthographic shadow cameras accept a negative near
plane); both values move into layout as `shadowNear: -20` and `shadowFar: 120`.
Measured with the sun following the target at zoom 1, taking the ground and 9 m
corners of the view at the default target and at all four panned extremes: a
16:9 view needs a half-extent of 35.9 m, a nominal 21:9 view 45.2 m, and a real
3440×1440 ultrawide (2.389) 46.2 m. 50 covers up to 2.60, which leaves room for
a browser window dragged wider than any monitor. The same corners sit between
5.9 m on the sun's side of the target and 62.6 m beyond it, well inside −20 and
120. A test enforces the coverage.

`shadowMapSize` rises from 2048 to 4096 at the same time. Without it, widening
the box from 26 to 50 would nearly double the shadow texel, from 2.5 cm to
4.9 cm, and coarsen every shadow in the existing shop — the look the game
already has. At 4096 the texel is 2.4 cm, marginally finer than today, so
`shadowBias` stays at −0.0005. The cost is one 4096² depth map and four times
the shadow-map fill each frame; if that proves too slow on a weak GPU, dropping
back to 2048 is a one-line change that only softens shadows.

### Scene

The part order becomes `ground, parking, perimeter, diningWing, storefront,
kitchen, oven, counter, sideWing, queue, town, simulation, lighting`.

## Edge cases

- Mixed indexed and non-indexed geometries merge safely because every geometry
  is made non-indexed first.
- A row end too short for a 10 m lot is left empty.
- The bus stop takes the place of the lamp at `x −6`, and trees keep at least
  1.5 m clear of it.
- `followSun` snaps to the shadow map's grid, so the sun only ever moves in
  whole-texel steps and shadow edges don't shimmer while panning; a move that
  stays within the same texel leaves the sun where it is.
- The front-visibility test exempts foliage. The tree line stands nearer the
  camera than the second row, so a 6 m tree at z 89 crosses the sight line to a
  door at y 1.2; a house glimpsed through a tree is the intended look. Only
  buildings hiding a front count as a failure.
- The user's far sidewalk strip is never split or replaced. Town lawns are
  separate slabs above it.

## Testing

Every test is written first and watched failing.

| File | Catches |
|---|---|
| `tests/town/planTown.test.js` | same seed gives an identical plan; lots stay inside `x ±78` and their row's z range; lots never overlap; widths 10–14 m; row 1 has both shops and houses; row 1 at most 7 m, row 2 at most 9 m; kerb trees 12 m apart with a lamp between each pair; exactly one bus stop at `x −6`, with trees at least 1.5 m clear; tree-line trees at least 10 m apart and at most 6 m tall; nothing at `z < 41`; every lot, trunk and prop footprint appears in `obstacles` |
| `tests/town/buildings.test.js` | a shop's glass front, awning and sign sit on its `+z` face; it has a parapet; a house's roof ridge is above its walls and its door is on the `+z` face; each building fills its lot footprint and reaches its planned height |
| `tests/town/nature.test.js`, `tests/town/props.test.js` | each model stands on the ground at its planned size and names its group |
| `tests/town/createTown.test.js` | at most one mesh per material; merged bounds equal unmerged bounds; glass and glow cast no shadows while the rest do; the town adds no more than 30 meshes |
| `tests/sim/obstacles.test.js` (added) | a walker is stopped by a town building, a tree trunk and a bench, but can still cross the road and walk along the kerb strip |
| `tests/lighting.test.js` (added) | the shadow camera contains all four view corners at zoom 1, at the default target and panned fully over the town; moving the target moves the sun and its target together; the sun moves only in whole-texel steps, and a move that stays within one texel leaves it unchanged |
| `tests/scene.test.js` (changed) | `town` is in the part order; "no roof above the chimney" measures every part except `town`; the zone outlines stay visible; **every first-row sign and second-row front door is visible from the camera**, by ray casting as the outline test does |
| `tests/layout.test.js` (added) | the town's bands lie inside the far sidewalk strip; the user's existing ground tests keep passing unchanged |
| `tests/main.test.js` (added) | the render loop imports and calls `followSun(` |

At the end, a screenshot of the default view shows first-row fronts in the
bottom-right corner. Seeing the whole town needs panning, which the user checks
in the browser.

## Decisions

- **Fronts face +z.** The fixed camera only sees +z and −x faces and roofs, so
  road-facing fronts would never show.
- **Merged meshes per material.** Rejected: separate meshes (about 1,000 more
  draw calls on a 677-mesh scene), and instancing (more code for about 100
  props).
- **One plain plan** feeds both the visuals and the collisions, so what you see
  is what blocks you.
- **Shadows follow the view.** Rejected: fake shadows under town props, and no
  town shadows. Following the view also restores shadows at the far ends of the
  widened road.
- **Heights are capped by visibility:** first row at most 7 m, second row at
  most 9 m, tree line at most 6 m.
- **Build order.** Implementation starts after the oven build's final review.
  The user's edits stay, and nothing is committed unless asked.
