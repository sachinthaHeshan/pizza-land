# Customer Cycle Simulation — Design

Date: 2026-09-10
Status: Approved
Builds on: `2026-09-10-pizza-shop-threejs-design.md`

## Goal

Bring the static diorama to life with a continuous loop: customers arrive by
car, park, walk to the counter, are handed a pizza, carry it back, and drive
away. Three customers run the cycle independently and the loop never ends.

## Scope

In scope:

- A low-poly car model in three body colours
- Three customers running the full cycle on independent, staggered timers
- Parking-bay and queue-slot allocation so two agents never claim the same one
- A walk cycle (swinging legs and arms) while customers are on foot
- A carried pizza box, existing only between the counter and the car
- A static cashier figure behind the service counter

Out of scope:

- Traffic other than the three simulated cars; no pedestrians passing by
- Doors opening, characters entering the shop interior, or seated diners
- Collision avoidance between agents beyond queue-slot separation
- Any change to the building itself

## Replaces

The five permanently-standing figures in `layout.queue.people` become
simulation-driven. `building/queue.js` keeps the rope barrier and gains the
static cashier; it no longer builds queued people.

## The cycle

Each customer is a state machine:

| State | Ends when |
|---|---|
| `APPROACHING` | the car reaches the bay-entry waypoint |
| `PARKING` | the car is stopped in its bay |
| `WALKING_IN` | the customer reaches its queue slot |
| `QUEUEING` | the customer has shuffled forward into slot 0 |
| `AT_COUNTER` | `serveSeconds` elapse; the pizza box appears |
| `WALKING_OUT` | the customer reaches the car door |
| `BOARDING` | `boardSeconds` elapse; the customer and box are hidden |
| `DEPARTING` | the car passes the exit x; the agent respawns |

Customers advance up the queue as those ahead of them leave, so a slot is
never occupied by two agents and never skipped.

## Paths

All coordinates derive from existing `layout` values; nothing is hard-coded
in the simulation modules.

**Driving.** Arrival waypoints are `(40, 20.5) -> (bayX, 20.5) -> (bayX,
16.5)`, leaving the car stopped nose-to-kerb. Departure is `(bayX, 16.5) ->
(bayX, 20.5) -> (-40, 20.5)`. Three bays are used, centred at `x = -11.7`,
`-6.5`, `-1.3`.

The car's heading follows its velocity except on the first departure segment,
which is flagged `reverse: true` — the car is parked nose-in, so it backs out
holding its heading and only turns once it is in the lane.

The car is 4.2 long and 1.8 wide, so parked at `z = 16.5` it spans `z 14.4 ->
18.6`: clear of the kerb at `z 14.0` and of the travel lane at `z 20.5`.

**Walking.** Waypoints are `door -> (doorX, 14.6) -> (doorX, 11.5) ->
(slotX, 8.6) -> slot`, where `doorX` is the car centre offset `1.1` in x and
`slotX` is the target queue slot's x. The `z = 8.6` waypoint sits on the
sidewalk rect, so the diagonal across it stays paved. The return path is the
same list reversed.

**Queue slots**, front to back — the positions the five static figures used:

`(1.2, 5.1)`, `(0.5, 5.9)`, `(-0.1, 6.5)`, `(-0.7, 7.1)`, `(-1.3, 7.7)`

Slot 0 is the counter position. Customers face the counter while queuing and
face their heading while moving.

## Timing

| Parameter | Value |
|---|---|
| Customers | 3 |
| Spawn gap | 9.0 s |
| Car speed | 7.5 units/s |
| Walk speed | 1.35 units/s |
| Serve dwell | 2.5 s |
| Board dwell | 0.8 s |

## Module structure

```
src/models/figure.js     moved from src/utils/; gains limb pivots
src/models/car.js        low-poly hatchback, colour chosen per agent
src/models/pizzaBox.js   small carried box
src/sim/pool.js          generic acquire/release for bays and queue slots
src/sim/paths.js         waypoint builders, derived from layout
src/sim/customer.js      one agent: state machine, movement, limb swing
src/sim/simulation.js    createSimulation(materials, layout)
src/building/queue.js    rope barrier + static cashier only
```

`src/utils/` keeps geometry helpers only; model factories move to
`src/models/`. Moving `figure.js` there is part of this work, since `car.js`
would otherwise land in an unrelated directory.

### Contracts

```js
createSimulation(materials, layout) -> {
  group: THREE.Group,      // named 'simulation', added to the shop
  update(dt: number): void // advances every agent
}
```

```js
createCustomer(materials, layout, { index, colour }) -> {
  group: THREE.Group,
  state: string,
  update(dt, context): void
}
```

`createShop` attaches the simulation to `shop.userData.simulation`, matching
how the oven's fire light is already exposed. `main.js` calls
`simulation.update(delta)` inside the existing render loop.

### Walk cycle

`createFigure` wraps each leg and arm in a pivot `Group` placed at the hip or
shoulder, with the limb hanging below it, and exposes them as
`figure.userData.limbs = { legL, legR, armL, armR }`. The simulation sets
`pivot.rotation.x` from a phase accumulator while a customer is walking and
eases it back to zero when stopped. Without this, figures slide rather than
walk, which reads as broken at this scale.

## Materials

New keys appended to `MATERIAL_KEYS`: `carGreen`, `carRed`, `carBlue`,
`carGlass`, `tyre`, `headlight`, `clothRed`, `pizzaBox`. Every new material
is flat-coloured, so each gets `userData.tile = null` from the existing
default and no UV scaling applies.

## Testing

The simulation is pure state and transforms — no WebGL — so it steps
deterministically under a fixed `dt` in the Vitest `node` environment.

1. **Pool** — acquiring reserves an item; releasing returns it; a pool never
   hands the same item to two callers; exhaustion returns `null`. With three
   customers and three bays the bay pool is effectively a fixed assignment,
   but it stays correct if either count changes.
2. **Paths** — every waypoint lies on a paved surface declared in
   `layout.ground`; no path has zero length.
3. **Customer** — stepping through a full cycle visits every state in order;
   per-step travel never exceeds `speed * dt` (no teleporting); the agent
   returns to its start; the pizza box exists only between `AT_COUNTER` and
   `BOARDING`.
4. **Simulation** — over a long simulated run no two agents ever hold the
   same bay or queue slot, every agent's state stays valid, and the group's
   child count does not grow (no leaked objects).
5. **Car** — the model's bounds match the declared size and it has four
   wheels.

## Decisions

- Waypoint state machines rather than precomputed timelines: a customer's
  queue wait depends on the customers ahead, so it cannot be precomputed.
- Cars drive one way, entering at `+x` and leaving at `-x`, so no oncoming
  traffic logic is needed.
- Customers are hidden rather than disposed when they board; the same three
  agents are reused for the life of the page, which keeps allocation flat.
- The camera direction returns to `[1, 0.82, 1]`, the reference angle, since
  the parking bays sit near the frame edge and the steeper angle pushes them
  further out.
