# Oven Pickup and Carrying — Design

Date: 2026-09-11
Status: Approved
Builds on: the cashier sell zone and SELL PIZZA marker (`src/models/sellPoint.js`,
`queue.sellZone`), added 2026-09-11 and not yet committed

## Goal

Make selling a two-step job for the player: collect pizzas from the oven,
carry them across the shop, and sell them at the cashier. The oven bakes on
its own; the player's stack is the only source of pizzas for customers.

## Scope

In scope:

- Oven stock that bakes one pizza every 5 s, up to 10
- A pickup zone on the floor in front of the oven mouth, with a count banner
- Picking up one pizza every 0.3 s while in the zone, carrying up to 10
- A stack of boxes held in the player's arms, with an arms-forward carry pose
- Boxes flying from the oven into the stack, and from the stack to a customer
- Sales that need at least one carried pizza
- Banner and pulse rules that point the player at the next step
- One shared zone-marker model for the oven and the cashier

Out of scope:

- Upgrades, costs, spoilage, or dropping pizzas
- A HUD readout of the carried count
- Sounds for baking, pickup, or sales
- Any change to customer routes, traffic, or the camera

## Rules

### Oven

- Starts empty. Bakes one pizza every `bakeSeconds` (5) while
  `stock < ovenCapacity` (10).
- At capacity the bake timer holds at 0. Baking restarts from 0 when a pizza
  is taken, so the next pizza is ready 5 s later.

### Pickup

- Runs while the player is inside `oven.pickupZone`, `stock >= 1`, and
  `carried < carryMax` (10).
- One pizza is released on the step the player enters the zone, then one
  every `pickupSeconds` (0.3). Leaving the zone resets the cooldown, so
  stepping back in releases one immediately.
- On release, `stock` drops by one, `carried` rises by one, and a box launches
  from the oven mouth. Counts change at launch; the box lands in the stack
  `hopSeconds` (0.3) later.

### Selling

- `world.canServe()` is true only while the player is inside `queue.sellZone`
  **and** `carried >= 1`.
- A customer's `serveSeconds` (2.5) timer runs only while `canServe()` is
  true and pauses otherwise, as it already does when the cashier steps away.
- `world.recordSale(pedestrian)` adds $5, drops `carried` by one, and launches
  the top box from the stack to the customer. The customer's own box appears
  when that box lands (`pedestrian.showBox()`); they start walking out at the
  sale, as today.

### Start state and idle play

The game starts with the oven at 0/10, empty hands, and $0. Nothing sells
until the player collects pizzas.

Measured with the current simulation and no sales for 8 simulated minutes:
no errors, all 8 bays fill, cars wait and honk (first honk at 43 s), and the
back of the queue stops at z 9.5, short of the car park edge at 10.9.

### Timing

Every timer runs on simulation time, so the 1x/2x/5x control scales baking,
pickup, hops, and serving together.

### Guidance

"Customers waiting" means at least one pedestrian is `AT_COUNTER`.

| Situation | Oven marker | Cashier marker |
|---|---|---|
| Always | banner shows `stock/10` | — |
| Customers waiting, `carried = 0` | outline and beam pulse | banner hidden, steady |
| Customers waiting, `carried >= 1`, player outside the sell zone | steady | banner shown, outline and beam pulse |
| Otherwise | steady | banner hidden, steady |

## Look

### Oven zone and banner

- A dashed glowing outline on the floor over `oven.pickupZone`, with a beam
  rising to the banner.
- The zone is x 4.6–5.5, z −5.5 to −4.1. A camera ray check over a wider
  patch found the floor hidden behind the kitchen island for x < 4.6, and the
  player cannot stand past x 5.35 (oven base plus player radius). Every
  floor point checked inside the chosen rectangle is visible. Points 2.6–3.6
  above the middle of the wider patch were visible; the banner's own position
  is confirmed by the browser screenshot.
- The banner uses the SELL PIZZA panel style (glassy fill, gold rim) with a
  pizza icon and the count, e.g. `3/10`. It is 2.2 × 1.1 at y 3.1, and its
  canvas is redrawn only when the count changes.

### Cashier marker

The look is unchanged: dashed outline just above the counter top (the counter
hides the floor behind it from this camera), beam, and SELL PIZZA banner. Only
its show and pulse rule changes, as in the guidance table.

### Carried stack

- Held in front of the chest. While `carried >= 1` both arms rotate forward
  and hold still; the legs keep walking. Empty hands restore the arm swing.
- Carried boxes are 0.42 wide and 0.1 thick. The customer box is 0.067 thick,
  about 2 px at default zoom, too thin to count. Ten carried boxes rise about
  1 m, above the player's head.
- The stack shows `max(0, carried − boxesInFlightToPlayer)` boxes.

### Flying boxes

- Each hop is a parabolic arc lasting `hopSeconds` that re-aims at its target
  every frame, so it follows a moving player or customer. The arc peaks above
  the straight line between its ends.
- A pickup hop flies from the oven mouth to the slot it will fill (index =
  `carried` before the pickup). A sale hop flies from the top slot to the
  customer's hands.
- Hop boxes come from a small fixed set and are reused.

## Module structure

```
src/sim/ovenStock.js      NEW   bake timer, stock 0–10, pickup cooldown; no three.js
src/models/zoneMarker.js  NEW   outline + beam + banner for any zone; replaces sellPoint.js
src/models/pizzaStack.js  NEW   up to 10 carried boxes, one slot per box
src/models/pizzaHops.js   NEW   reusable flying boxes on arcs to moving targets
src/sim/player.js         carried count, owns the stack, carry pose
src/sim/pedestrian.js     showBox(); passes itself to world.recordSale and no longer shows the box itself
src/sim/simulation.js     wires stock, carrying, hops, sales, and the guidance table
src/textures.js           ovenBanner texture that redraws for a count
src/materials.js          ovenBanner material; sellBeam/sellEdge renamed markerBeam/markerEdge
src/layout.js             oven.pickupZone, oven.banner, sim.pizza
```

`tests/models/sellPoint.test.js` becomes `tests/models/zoneMarker.test.js`.
`main.js` and `createShop` do not change: the oven marker lives in the
simulation group beside the cashier marker, and the count texture is built by
the existing `createTextures` call.

### Contracts

```js
createOvenStock(layout) -> {
  stock: number,                          // 0..sim.pizza.ovenCapacity
  update(dt, { inZone, room }): number,   // pizzas released this step (0 or 1)
}

createZoneMarker(materials, { name, zone, outlineY, bannerMaterial, banner })
  -> THREE.Group
// group.userData.update(dt, { pulse: boolean, showBanner: boolean })
// Clones markerBeam and markerEdge, so one marker's pulse never changes another's.

createPizzaStack(materials, layout) -> THREE.Group
// group.userData.setCount(n)
// group.userData.slotPosition(index, out: Vector3) -> Vector3 (world space)

createPizzaHops(materials, layout) -> {
  group: THREE.Group,
  launch(from: Vector3, target: () => Vector3, onLand: () => void): void,
  update(dt): void,
}

createPlayer(materials, layout) -> {
  figure, stack, carried,
  receive(): void,     // carried + 1, capped at carryMax
  handOver(): void,    // carried − 1, floored at 0
  update(dt, keys): void,
}

pedestrian.showBox(): void
pedestrian.boxPosition(out: Vector3): Vector3 // where its hands hold the box, the sale hop's target

world.canServe(): boolean          // in sell zone && carried >= 1
world.recordSale(pedestrian): void // +$5, handOver, hop to the customer, showBox on landing

textures.ovenBanner.userData.setCount(count, capacity): void // redraws "count/capacity", sets needsUpdate
```

### Layout

```js
oven.pickupZone: { x: [4.6, 5.5], z: [-5.5, -4.1] },
oven.banner:     { y: 3.1, width: 2.2, height: 1.1, bob: 0.08 },
sim.pizza: {
  bakeSeconds: 5,
  ovenCapacity: 10,
  pickupSeconds: 0.3,
  carryMax: 10,
  hopSeconds: 0.3,
  carriedBox: { size: 0.42, thickness: 0.1 },
},
```

### Edge cases

- If every hop box is busy, the pizza transfers without a flying box and
  `onLand` runs at once, so counts never drift from what is shown.
- A hop still lands if the player leaves the zone while it is in flight.
- The stack's shown count never goes below zero.
- The count texture redraws only on a change, so at most 11 distinct draws.

## Testing

Every test is written first and watched failing. The simulation stays pure
state and transforms, stepped under a fixed `dt` in the Vitest `node`
environment.

### New tests

| File | Catches |
|---|---|
| `tests/sim/ovenStock.test.js` | nothing at 4.9 s and +1 at 5 s; stops at 10 and takes a full 5 s after a pizza is taken; one release on entering, then one per 0.3 s; none when empty or when `room` is 0; leaving stops releases; re-entering releases at once |
| `tests/models/zoneMarker.test.js` | the SELL marker tests carried over (outline matches the zone at `outlineY`, dashed, beam from outline to banner, undistorted banner, bob); `pulse` and `showBanner` act independently; two markers never pulse each other |
| `tests/models/pizzaStack.test.js` | shows exactly n boxes for n = 0–10, stacked upward without gaps |
| `tests/models/pizzaHops.test.js` | starts at `from`, reaches the target after 0.3 s and calls `onLand` once; follows a moving target; peaks above the straight line; reuses boxes so the child count stays flat over many launches |
| `tests/sim/player.test.js` (added) | `carried` stays within 0–10; arms hold forward while carrying and swing when empty |
| `tests/scene.test.js` (added) | the camera can see both markers' outlines, by ray casting from the game camera direction |
| `tests/textures.test.js` (added) | the count banner draws the new count text and flags the texture for upload |
| `tests/layout.test.js` (added) | the pickup zone is reachable by the player and clear of the island and oven |

### Simulation tests

In `tests/sim/simulation.test.js`:

- No sale with empty hands, even inside the sell zone
- A sale uses one carried pizza and adds $5
- The full loop: bake, stand in the pickup zone, collect, walk to the
  cashier, and the customer is served
- With 10 carried, pickup stops and the oven keeps its stock
- Each row of the guidance table, checked in the running loop

### Existing tests that change

- `tests/sim/simulation.test.js`: the "serve only from inside the sell zone"
  and "holds every sale until the cashier returns" tests give the player
  pizzas first through `player.receive()`; the two SELL banner and pulse tests
  are rewritten around the guidance table
- `tests/models/sellPoint.test.js`: becomes `zoneMarker.test.js`
- `tests/materials.test.js`: renamed marker materials; `ovenBanner` joins the
  stretched-once artwork
- `tests/sim/pedestrian.test.js`: the fake world calls `showBox()` in
  `recordSale`

The long honking test and the queue-position test stay unchanged; the
no-sales run above shows both still hold.

### In the browser

A screenshot of the running game showing both markers, cropped and checked as
for the SELL marker.

## Decisions

- Rules live in plain modules and visuals only read them. Rejected: keeping
  counts and timers inside the 3D models (rules tangled with meshes), and an
  event bus (machinery nothing needs yet).
- Counts change when a box launches, not when it lands, so no rule depends on
  animation timing; the visuals trail by 0.3 s.
- One shared zone marker instead of two near-identical models. Each marker
  clones its glow materials.
- The oven outline sits on the floor and the cashier outline above the
  counter, each where the fixed camera can see it.
- Carried boxes are thicker than customer boxes so a stack reads at default
  zoom.
