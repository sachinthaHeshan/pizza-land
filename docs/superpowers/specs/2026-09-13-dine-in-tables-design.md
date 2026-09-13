# Dine-in tables — design

Status: Approved

## Goal

Fill the shop's empty dining wing with four tables. Customers who already
arrive by car choose, on reaching the plaza, between the counter queue and a
table. Diners sit, a banner and a dashed zone ask for a pizza, and the player
delivers one by standing in the zone. The table eats for 40 seconds and leaves.

## What the player sees

A table waiting for a pizza pulses its dashed floor outline and floats a
banner above it. Standing in that table's zone with at least one pizza in hand
hands one over: the balance rises by $8 and a box hops from the player's stack
onto the tabletop. The banner and the pulse stop, the box sits there while the
diners eat, and forty seconds later the diners stand, walk out and the box
disappears. A table nobody serves gives up after sixty seconds and empties, so
the dining room can never deadlock.

## Where it goes

The dining wing (`layout.diningWing.footprint`, x −11…−3, z −6…2) is already
built and empty: brick plinth, windows on the west wall, a plank floor at
y 0.06, a storefront wall at z 2 with a door at x −6.2…−4.6, and a partition at
x −3 with a door at z −1…0.2. Customers enter through the storefront door;
the player comes from the kitchen through the partition door.

Every position below was chosen by raycasting the built scene along
`layout.camera.direction`, because this camera only ever sees faces pointing
+z or −x and the west wall, storefront plinth and sign each cast a blind spot
across the floor.

| Table | Centre | Chairs (z ± 0.75) | Delivery zone |
|---|---|---|---|
| 0 | (−8.4, −2.6) | −1.85, −3.35 | x −7.70…−7.00, z −3.05…−2.15 |
| 1 | (−5.2, −2.6) | −1.85, −3.35 | x −6.60…−5.90, z −3.05…−2.15 |
| 2 | (−8.4, −4.8) | −4.05, −5.55 | x −7.70…−7.00, z −5.25…−4.35 |
| 3 | (−5.2, −4.8) | −4.05, −5.55 | x −6.60…−5.90, z −5.25…−4.35 |

Tabletops are 1.0 m square with the top surface at y 0.78–0.84. Both columns
are served from the central aisle — the left column from its +x side, the
right from its −x side — leaving a 0.40 m gap between the two zones so the
player is never inside two at once. Serving from the east wall instead was
measured and rejected: the storefront hides two corners of that zone's floor
in every grid position tried.

Measured result, with the furniture standing in the room: all four tabletops
(every corner), all eight chair heads, all four banners at y 2.3 and all
sixteen zone corners at outline height are visible.
The single exception is one corner of the front-right table's +z chair seat
cushion at (−4.98, 0.46, −1.85), which sits behind the storefront plinth; the
diner sitting in that chair is fully visible, so it is accepted.

The back row's chairs reach z −5.55, clearing the north wall's inner face at
z −5.85 by 0.10 m.

## Rules

`src/sim/dining.js` holds the rules as plain logic — no three.js, no DOM —
the same shape as `src/sim/ovenStock.js`, so the state machine is testable on
its own.

```js
createDiningRoom(layout) -> {
  tables,                       // four { state, seats, secondsLeft }
  claimSeat(),                  // -> { table, seat } indices, or null
  serve(table),                 // WAITING -> EATING, returns true if served
  wants(table),                 // true while the table is asking for a pizza
  update(dt) -> released        // indices of tables that emptied this step
}
```

`table` and `seat` are always indices. The module owns its own
`mulberry32(layout.dining.seed)`, following `src/sim/traffic.js`, and
`claimSeat()` makes the `dineInChance` draw itself before looking for a free
seat — so the whole decision is one seeded call and a test fixes the outcome
by setting `dineInChance` to 0 or 1.

Each table is `EMPTY`, `WAITING` or `EATING`:

- `EMPTY` → `WAITING` when the first diner sits. `secondsLeft` starts at
  `patienceSeconds`.
- `WAITING` → `EATING` when `serve()` is called. `secondsLeft` resets to
  `eatSeconds`.
- `WAITING` → `EMPTY` when patience runs out; the diners leave unfed.
- `EATING` → `EMPTY` when the meal finishes.

`claimSeat()` returns a free seat only at a table that is `EMPTY` or
`WAITING` — never one already eating, so nobody joins a meal in progress.
Seats fill independently, so two customers who arrived in different cars can
share a table and one pizza. Making them arrive as genuine pairs would mean
holding a seat empty until a second car happened to show up; the shared table
was chosen instead and is a deliberate simplification.

Every timer runs on simulation time, so the existing 1×/2×/5× speed control
scales eating and patience along with everything else.

## Customers

`PEDESTRIAN_STATES` gains `WALKING_TO_TABLE` and `SEATED`. On its first step
after leaving the car a customer asks the dining room for a seat; if the
seeded draw passes and a seat is free, it walks to that seat instead of
joining the queue. Deciding once, before any path is set, avoids retargeting a
walker mid-route and is invisible in play. Everything else about arrival, the
car and the walk out is unchanged.

`src/sim/paths.js` gains `walkToSeatPath(layout, bay, seat)`: the existing
walk-in route as far as the plaza, then through the storefront door at
x −5.4, then to the seat.

Seating reuses the figure's existing hip pivots: the figure drops so its hips
sit at chair height and both legs swing forward (`rotation.x = -PI/2`) under
the table, which hides them at this camera angle. `src/models/figure.js` gains
one exported constant, `LEG_PROPORTIONS = { hip: P.legTop }`, so the seated
height is derived rather than duplicated — the same fix the oven build applied
for `ARM_PROPORTIONS`. No geometry changes.

`update(dt)` frees the seats of every table that emptied this step — from a
finished meal or from lost patience — and returns those table indices.
`simulation.js` sends every customer seated at one of them to `WALKING_OUT`,
so a diner never polls the room. From there they retrace the path out of the
shop and board their car exactly as counter customers do today.

## Serving

The player hands a pizza to a table by standing in its zone carrying at least
one — the same rule as the sell zone, and no key press, matching how the
counter already works. `simulation.js` checks each waiting table in turn and
serves at most one per frame.

A sale pays `tablePrice` ($8) against the counter's $5, and reuses
`createPizzaHops` to arc a box from the top of the player's carried stack onto
the tabletop. The simulation owns one `createPizzaBox` per table, hidden until
the hop lands and hidden again when the table empties — the same "counts
change at launch, the model changes on landing" ordering the oven pickup
already uses. The table model itself stays pure furniture, so the dining wing
can build it without reaching into simulation state.

## Markers

Each table gets a `createZoneMarker` — which already draws the dashed outline,
the beam and a bobbing banner — with its outline at tabletop height
(`top.height + top.thickness + surfaceEps` = 0.86), not on the floor. Measured
with the furniture in place, a floor outline beside a table is hidden by that
table: the sight line to this camera runs −x and +z, passing straight under
the top. This is the same fix the cashier's zone already uses, where the
counter hides the floor behind it. The banner and the pulse show only while that table wants a
pizza, matching the rule already chosen for the cashier banner. All four
tables share one `tableBanner` texture and material, because they never need
to show different art at the same time.

Each table's banner floats over the **table**, not over its delivery zone:
`createZoneMarker` takes an optional `bannerCentre` for this, defaulting to the
zone centre so the cashier and oven markers are unchanged. Centred on the zones
— a metre to the side — two banners in a column came within 1.556 m of each
other on screen, and a banner is a camera-facing sprite, so screen separation
is what decides overlap, not distance in world space. Over the tables they are
clear at 1.5 x 0.75, trimmed from 1.6 x 0.8 because that closest pair is
1.556 m apart.

## Layout additions

```js
dining: {
  tables: [
    { x: -8.4, z: -2.6, zone: { x: [-7.70, -7.00], z: [-3.05, -2.15] } },
    { x: -5.2, z: -2.6, zone: { x: [-6.60, -5.90], z: [-3.05, -2.15] } },
    { x: -8.4, z: -4.8, zone: { x: [-7.70, -7.00], z: [-5.25, -4.35] } },
    { x: -5.2, z: -4.8, zone: { x: [-6.60, -5.90], z: [-5.25, -4.35] } },
  ],
  top: { size: 1.0, height: 0.78, thickness: 0.06 },
  pedestal: { radius: 0.12, footRadius: 0.32, footHeight: 0.05 },
  chair: { offset: 0.75, seatHeight: 0.45, size: 0.44, backHeight: 0.85 },
  banner: { y: 2.3, width: 1.5, height: 0.75, bob: 0.06 },
  seatsPerTable: 2,
  eatSeconds: 40,
  patienceSeconds: 60,
  dineInChance: 0.5,
  seed: 20260913,
  tablePrice: 8,
  doorX: -5.4,
}
```

## Files

| File | Responsibility |
|---|---|
| `src/layout.js` | the `dining` block above |
| `src/sim/dining.js` | the state machine, no three.js |
| `src/models/diningTable.js` | one table and two chairs, furniture only |
| `src/models/figure.js` | exports `LEG_PROPORTIONS` |
| `src/building/diningWing.js` | places the four tables |
| `src/sim/paths.js` | `walkToSeatPath` |
| `src/sim/pedestrian.js` | the two new states and the seated pose |
| `src/sim/simulation.js` | wires the room, markers, serving and payment |
| `src/sim/obstacles.js` | table footprints block the player |
| `src/textures.js`, `src/materials.js` | the `tableBanner` art and material |

## Testing

| Test | Covers |
|---|---|
| `tests/sim/dining.test.js` | every state transition, patience expiry, eating, `claimSeat` refusing an eating table, seats filling independently, `claimSeat` returning null at `dineInChance` 0 and a seat at 1, and `update` reporting each emptied table exactly once |
| `tests/models/diningTable.test.js` | the table stands on the dining floor at its layout height; two chairs at ±`offset`; the top is `size` square |
| `tests/building/diningWing.test.js` | four tables at exactly the layout positions |
| `tests/scene.test.js` | every tabletop corner, chair head, banner and zone corner is visible from the game camera — the measurement above, enforced |
| `tests/sim/obstacles.test.js` | a walker is stopped by a table and can still reach every delivery zone |
| `tests/sim/simulation.test.js` | serving pays $8 and spends one carried pizza; a table is served only from inside its zone with a pizza; banners show only while waiting; a customer takes a seat when the draw allows and queues otherwise |

## Edge cases

- A table nobody serves empties after `patienceSeconds`, so all four can never
  be locked by an inattentive player.
- `serve()` on a table that is not `WAITING` returns false and costs nothing,
  so a player standing in a zone during a meal does not lose a pizza.
- At most one table is served per frame, so one step of a fast simulation
  cannot empty the whole carried stack at once.
- A customer still walking to a seat when patience expires finds the table
  `EMPTY`, sits, and starts a fresh wait. Harmless, and it keeps the walk from
  needing to be cancelled.
- A customer that finds no free seat queues at the counter as before, so the
  dining room filling up never strands anybody.
- The delivery zones are 0.40 m apart, so the player is never inside two.

## Rejected alternatives

- **Serving tables from the east side.** The storefront wall hides two corners
  of that zone's floor at every grid position tried; the central aisle is
  clear.
- **Diners ordering at the counter first, then carrying their own box to a
  table.** Then the player never delivers to a table, which is the point of
  the feature.
- **A separate walk-in population.** A second arrival system to build and tune
  when the cars already deliver people.
- **A per-table banner texture with a countdown.** Four lit banners at all
  times, four canvases, and it contradicts the banner rule already chosen for
  the cashier.
- **Diners waiting forever.** An ignored dining room would permanently fill
  every table.
