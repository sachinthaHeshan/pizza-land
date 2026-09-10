# Isometric Pizza Shop in Three.js — Design

Date: 2026-09-10
Status: Approved

## Goal

Reproduce the reference illustration's pizza shop as a Three.js scene: the
building shell, its built-in fixtures, and the ground apron around it. No
food, crates, plants, cars, furniture props, or people. The result is a
foundation the props and characters can be added to later.

## Scope

In scope:

- Brick perimeter walls with stone caps and corner pillars
- Terracotta interior floor; wood plank floor in the dining wing
- Roofless cutaway (no roof geometry at all), matching the reference
- Left dining wing: brick plinth, glazed walls, interior partition, doorway
- Storefront facade: green timber frame, glazing, door, red/white striped
  awning, arched signboard, two gooseneck lamps
- Full-height cream tiled kitchen wall
- Stainless steel kitchen counter run, prep island, wall shelf and rail
- Brick dome pizza oven with arched mouth, fire glow, and chimney
- L-shaped service counter (brick base, wood top)
- Front-right wing with lit window and striped awning
- Ground apron: sidewalk paving, curb, asphalt road, painted parking bays

Out of scope:

- Any loose object: pizzas, ingredients, boxes, pots, plants, bins, crates
- Tables, chairs, stools, cash register, monitors
- People, vehicles, trees, street lamp, fences
- Animation beyond a subtle oven fire flicker

## Coordinate system

Right-handed, Y up. `+Z` points toward the street (the viewer). `+X` points
right. Origin sits at the centre of the shop floor at ground level. One world
unit is approximately one metre.

The camera looks from `(+X, +Y, +Z)` toward the origin, so the storefront
(negative X) reads on the left and the oven (positive X) on the right,
matching the reference.

## Massing plan

`src/layout.js` is the single source of truth for every dimension below.
No module may hard-code a position; all of them read from this object.

### Lot and ground

| Element | Extent | Y |
|---|---|---|
| Asphalt road | X `-40…40`, Z `14…40` | `-0.15` |
| Curb | X `-40…40`, Z `13.6…14.0` | `-0.15…0.0` |
| Sidewalk | X `-40…40`, Z `8…13.6`, plus X `-24…-11`, Z `-8…8` | `0.0` |
| Plaza paving | X `-11…9`, Z `2…8`, minus the front-right wing footprint | `0.0` |
| Terracotta shop floor | X `-11…9`, Z `-8…4`, plus X `5…9`, Z `4…6` | `0.02` |
| Dining wing wood floor | X `-11…-3`, Z `-6…2` (overlays the terracotta) | `0.06` |

Parking bays: white stripes on the asphalt perpendicular to the curb, 0.12
wide, 5.0 long, spaced 2.6 apart, running from Z `14.2` to Z `19.2`.
A dashed lane divider runs along Z `22`.

### Structure

| Element | Footprint | Height |
|---|---|---|
| Perimeter wall (brick, 0.4 thick) | back Z `-8`, X `-11…9`; right X `9`, Z `-8…2`; left X `-11`, Z `-8…-6` | `0…1.2` |
| Stone cap on perimeter wall | 0.55 wide, centred on wall | `1.2…1.35` |
| Corner pillars | 0.7 × 0.7 at `(-11,-8)`, `(9,-8)`, `(9,6)`, `(-11,2)` | `0…1.5` + cap |
| Kitchen tile wall (cream subway) | Z `-8` inner face, X `-3…6` | `1.2…3.2` |
| Dining wing outer walls | X `-11` (Z `-6…2`), Z `-6` (X `-11…-3`) | brick plinth `0…1.1`, plaster/timber `1.1…2.8` |
| Dining/kitchen partition | X `-3`, Z `-6…2`, doorway opening Z `-1…0.2` | `0…2.8` |
| Dining wing west windows | X `-11`, two bays 2.2 wide | sill `1.1`, head `2.6` |

Wall ownership is exclusive, so no two modules build geometry in the same
place. `perimeter.js` owns all four corner pillars and only the wall runs
listed above. `diningWing.js` owns the X `-11` face from Z `-6…2`;
`sideWing.js` owns the X `9` face from Z `2…6` and the whole Z `6` face.
Wing walls butt against the pillars rather than passing through them.

### Storefront (plane Z = 2, X `-11…-3`)

- Brick plinth `0…0.9`
- Green timber posts 0.22 square at X `-10.8`, `-8.6`, `-6.2`, `-3.2`,
  set inboard of the corner pillars
- Header beam `2.5…2.8`
- Glass panes `0.9…2.5`, tinted, transparent, warm glow plane behind
- Door bay X `-6.2…-4.6`, green frame with glass, inset 0.1
- Awning: red/white vertical stripes, X `-11…-3.4`, wall edge at y `2.9`
  sloping out and down to y `2.45` at Z `3.3`, with a 0.25 scalloped valance
- Arched signboard: X `-8.8…-4.2`, y `3.0…4.1`, dark green board with a
  procedural pizza-slice motif and a cream arch surround
- Gooseneck lamps at X `-9.5` and X `-4.0`, y `3.1`, dark green shades,
  each with a warm point light

### Fixtures

| Fixture | Footprint | Height |
|---|---|---|
| Service counter, main run | X `-1…5`, Z `3.6…4.4`, straddling the terracotta/plaza seam at Z `4` | brick base `0…0.95`, wood top `0.95…1.10`, 0.12 overhang |
| Service counter, return leg | X `4.2…5`, Z `1.5…4.4` | same |
| Kitchen back counter | X `-3…6`, Z `-7.8…-6.8` | `0…0.9` + 0.04 lip; under-shelf at `0.25` |
| Prep island | X `-1.5…3.5`, Z `-5.2…-3.6` | `0…0.9` + lower shelf |
| Wall shelf | X `0…5`, Z `-7.9`, depth 0.4 | `2.0`; hanging rail at `1.85` |

### Pizza oven (mouth faces `-X`, toward the shop interior)

- Brick base X `5.6…8.8`, Z `-6.4…-3.2`, y `0…1.0`; stone cap `1.0…1.15`
- Dome: hemisphere radius 1.55 centred `(7.2, 1.15, -4.8)`, Y-scaled 0.95
- Mouth: cream stone arch at X `5.65`, opening 1.1 wide × 0.85 tall, sill at
  y `1.15`; dark recess inset 0.6 deep
- Fire: emissive orange plane at the back of the recess plus a point light
  (`0xff7a2a`) with a subtle flicker driven from the render loop
- Chimney: brick box 0.7 × 0.7 at `(7.9, _, -5.6)` from y `2.4` to `4.3`,
  then a dark metal flue cylinder r `0.28` from `4.3` to `5.0` with a cap disc

### Front-right wing

- Footprint X `5…9`, Z `2…6`
- Brick plinth `0…1.0`, cream plaster `1.0…2.8` on the X `9` and Z `6` faces
- Window bay facing `+Z` at Z `6`: 2.4 wide × 1.4 tall, sill `1.1`, warm
  glow plane behind the glass
- Red/white striped awning above it, wall edge at y `3.0`, depth 1.1

## Module structure

```
pizza-land/
  package.json
  vite.config.js
  index.html
  src/
    main.js              renderer, camera, controls, resize, render loop
    layout.js            all dimensions and positions
    textures.js          procedural CanvasTexture generators
    materials.js         shared material cache built on textures
    lighting.js          hemisphere fill, directional sun, warm point lights
    building/
      ground.js          road, curb, sidewalk, parking markings, lot floors
      perimeter.js       brick boundary walls, caps, corner pillars
      diningWing.js      wing walls, windows, partition, doorway
      storefront.js      facade, glazing, door, awning, signboard, lamps
      kitchen.js         tiled wall, stainless counters, island, shelving
      oven.js            brick base, dome, arched mouth, fire, chimney
      counter.js         L-shaped service counter
      sideWing.js        front-right wing with awning and lit window
    utils/geometry.js    box(), arch(), awning(), plank(), stripePanel()
```

### Contract

Every module in `building/` exports exactly one factory:

```js
export function createX(materials, layout) // -> THREE.Group
```

The factory is pure: it reads `layout`, pulls materials from the shared
cache, and returns a named `THREE.Group` with `castShadow`/`receiveShadow`
already set on its meshes. It mutates nothing outside itself. `main.js`
calls each factory once and adds the groups to a single root group.

This keeps every piece independently replaceable, which is what makes adding
the props and characters later a purely additive change.

## Materials and textures

All textures are generated at runtime into a `<canvas>` and wrapped in
`THREE.CanvasTexture`. No image files ship with the project.

`textures.js` exports:

| Generator | Used for |
|---|---|
| `brickTexture` | perimeter walls, plinths, oven, chimney, counter base |
| `terracottaTileTexture` | shop floor |
| `wallTileTexture` | cream subway kitchen wall |
| `stripeTexture` | red/white awnings |
| `woodTexture` | counter tops, dining floor, timber frames |
| `plasterTexture` | upper wall surfaces |
| `pavingTexture` | sidewalk and plaza slabs |
| `asphaltTexture` | road |
| `metalTexture` | brushed stainless counters and shelving |
| `signTexture` | storefront signboard motif |

Each is 512 × 512 (256 for stripes), `SRGBColorSpace`, `RepeatWrapping`, with
anisotropy taken from the renderer's capabilities. `materials.js` builds each
`MeshStandardMaterial` once and hands the same instance to every consumer.

## Camera and rendering

- `OrthographicCamera`, frustum size 26, adjusted for aspect on resize
- Position along the normalized direction `(1, 0.82, 1)` at distance 60,
  target `(0, 1.2, -0.5)` — the reference's game-isometric angle
- `OrbitControls` with damping for inspection; `R` resets to the reference
  framing
- `ACESFilmicToneMapping`, sRGB output, `PCFSoftShadowMap`

Lighting:

- `HemisphereLight` sky `#bcd6ff` / ground `#6b5a45`, intensity 0.55
- `DirectionalLight` `#fff2dd` intensity 2.1 at `(-18, 26, 14)`, casting
  shadows, 2048 map, orthographic shadow bounds ±26, bias `-0.0005`
- Warm point lights: oven fire, two behind the storefront glass, two
  gooseneck lamps, one behind the side-wing window; all with `decay: 2` and
  a finite `distance`

## Testing

The scene graph builds without a WebGL context — only the renderer needs one.
Vitest runs in the `node` environment, and tests mock `src/textures.js` with
`vi.mock` so each generator returns a bare `THREE.Texture` instead of touching
a canvas. Geometry and transforms stay real.

Per building module:

1. The factory returns a `THREE.Group` with at least one child
2. Its world bounding box contains no `NaN` or `Infinity`
3. Its bounding box falls inside the envelope declared in `layout.js`,
   within a 0.5 unit tolerance

Plus a `layout.js` sanity test: every span is positive, and footprints that
must not overlap do not.

This catches the failure mode that matters — a mesh silently placed far off
its intended position — without pretending to test appearance. Visual
confirmation is running `npm run dev` and inspecting the result.

## Dependencies

`three`, `vite`, `vitest`. Versions pinned at install time and recorded in
`package.json`. Scripts: `dev`, `build`, `preview`, `test`.

## Decisions made

- The dining wing floor is wood plank, not terracotta, matching the
  reference's warmer interior.
- The oven mouth is a recessed dark cylinder behind a stone arch rather than
  a CSG boolean subtract, which would add a dependency for one visual.
- The building is roofless by design. There is no hidden roof to toggle.
