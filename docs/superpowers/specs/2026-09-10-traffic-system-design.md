# Traffic System — Design (Part B)

Date: 2026-09-10
Status: Approved
Builds on: `2026-09-10-parking-lot-and-road-design.md`

## Goal

Fill the four-lane road with continuous mixed traffic. Some cars decide they
want pizza, merge to the kerb lane, and turn into the lot. If the lot is
full they stop at the entrance and honk for ten seconds, then give up and
drive on. Traffic behind them queues or overtakes rather than driving
through them.

## Scope

In scope:

- Continuous two-way traffic: cars, vans and a bus, ~24 on the road
- Car-following, so vehicles in a lane never overlap
- Lane changes: to reach the kerb lane, and to overtake a stopped vehicle
- Random pizza intent on cars in the shop-side lanes
- Stopping and honking at a full lot, then balking after ten seconds
- A synthesised two-tone horn behind a click-to-enable gate, plus a visual
  horn burst that works with the sound off
- Splitting today's `customer.js` into a driving `vehicle` and a walking
  `pedestrian`

Out of scope:

- Left turns across oncoming traffic (see Simplifications)
- Traffic lights, junctions, pedestrians crossing the road
- Collision response; car-following is what prevents overlap

## Simplifications

**Only shop-side traffic stops for pizza.** Lanes 2 and 3 run `+X`, so a car
there would have to turn left across two lanes of oncoming traffic. Modelling
that needs gap acceptance and blocking the opposing lanes for an unbounded
time. Vehicles in those lanes always drive past. The road still reads as
two-way and busy.

**Vehicles are recycled, never disposed.** A fixed pool is created at
startup and hidden when off-road, matching how the existing customers work.

## Vehicles

| Type | Length | Width | Height | Cruise | Share |
|---|---|---|---|---|---|
| car | 4.2 | 1.8 | 1.55 | 9.0 | 0.62 |
| van | 5.2 | 2.0 | 2.30 | 8.0 | 0.22 |
| bus | 9.0 | 2.4 | 3.00 | 7.0 | 0.16 |

Only cars may want pizza; a van or bus never fits the bay geometry and
never stops.

## Lanes

Lane centres come from `layout.ground.lanes`, already in place:

| Lane | Centre `z` | Direction | Spawn `x` | Despawn `x` |
|---|---|---|---|---|
| 0 (kerb) | `28.25` | `-1` | `40` | `-40` |
| 1 | `31.75` | `-1` | `40` | `-40` |
| 2 | `35.25` | `+1` | `-40` | `40` |
| 3 | `38.75` | `+1` | `-40` | `40` |

Each lane holds a target of 6 vehicles. A lane spawns when its rearmost
vehicle has travelled at least `spawnGap = 14` from the entry point, which
regulates density without a global counter.

## Following model

`safeSpeed({ gap, leaderSpeed, cruise, minGap, headway })` is a pure
function returning the speed a vehicle should aim for:

- no leader (`gap` not finite) → `cruise`
- `gap <= minGap` → `0`
- otherwise, with `desiredGap = minGap + cruise * headway` and
  `t = clamp((gap - minGap) / (desiredGap - minGap), 0, 1)`, the result is
  `min(cruise, leaderSpeed * (1 - t) + cruise * t)`

So a vehicle closing on a stopped leader eases to a halt at `minGap`, and one
with a clear road runs at `cruise`. `minGap = 1.6`, `headway = 0.9`.

Actual speed is rate-limited toward that target: `accel = 4.5`,
`decel = 9.0` units/s². `gap` is bumper to bumper, using each vehicle's own
length.

## Lane changes

A lane change interpolates `z` from the current lane centre to the target
over `changeSeconds = 1.2` while the vehicle keeps moving forward. Two
triggers:

1. **Seeking the lot** — a pizza car in lane 1 moves to lane 0 once it is
   within `mergeDistance = 26` of the entrance.
2. **Overtaking** — a vehicle in lane 0 whose leader is stopped and closer
   than `overtakeGap = 9` moves to lane 1.

Either is allowed only if the target lane has no vehicle within
`changeClearance = 7` ahead or behind at the same `x`.

## Lot routing

`sim/paths.js` today builds a whole journey starting from the road at
`lane.enterX`. A Part B vehicle is already driving on the road when it
decides, so those two builders are replaced by lot-only legs:

- `lotEntryPath(layout, bay)` — `(entrance.centreX, lane0.z) →
  (entrance.centreX, aisle.centreZ) → (bay.x, aisle.centreZ) →
  (bay.x, bay.z)`
- `lotExitPath(layout, bay)` — `(bay.x, bay.z) → (bay.x, aisle.centreZ)
  reverse → (exit.centreX, aisle.centreZ) → (exit.centreX, lane0.z)`

`arrivalPath` and `departurePath` are removed; nothing else uses them.
`walkInPath`, `walkOutPath`, `doorPosition` and `pathLength` are unchanged.

A vehicle waiting for a space stops with its **centre at
`entrance.centreX`**, so it sits square with the gap it is waiting to turn
into.

## Vehicle states

| State | Ends when |
|---|---|
| `CRUISING` | it passes its despawn `x`, or it wants pizza and reaches the merge point |
| `MERGING` | the lane change completes |
| `APPROACHING_LOT` | it reaches the entrance `x` |
| `WAITING` | a bay frees, or `waitSeconds = 10` elapse |
| `ENTERING` | it reaches its bay |
| `PARKED` | its pedestrian finishes the buy cycle |
| `LEAVING` | it reaches the kerb lane through the exit gap |
| `BALKING` | it rejoins the lane after giving up; becomes `CRUISING` |

A vehicle that balks keeps its pizza intent off, so it does not immediately
try again.

## Honking

`createHorn(audioContextFactory)` returns `{ enable(), play(), enabled }`.
It builds no `AudioContext` until `enable()` is called from a user gesture,
and every method is a no-op when no factory is supplied — which is how it
stays testable in Node.

A honking vehicle plays a two-tone beep every `hornInterval = 1.2` seconds
and shows a `hornBurst`: two small arcs above the roof that pulse in time.
The visual runs whether or not sound is enabled.

The page shows a small "click for sound" control in a corner; clicking calls
`enable()`.

## Pedestrians

`customer.js` becomes `pedestrian.js`, keeping the figure, pizza box, walk
cycle, queue slots and buy timing, and losing everything about the car.

- `createPedestrian(materials, layout, { index })` → `{ group, state,
  start(bay), update(dt, world), isDone() }`
- States: `IDLE`, `WALKING_IN`, `QUEUEING`, `AT_COUNTER`, `WALKING_OUT`,
  `DONE`

A parked vehicle acquires a pedestrian from a pool, calls `start(bay)`, and
stays `PARKED` until `isDone()`. The pool holds 6 — fewer than the 8 bays,
since a vehicle without a free pedestrian simply does not seek pizza.
`layout.sim.customers` is replaced by `layout.sim.pedestrians`.

## Modules

```
src/models/bus.js         long single-deck bus
src/models/van.js         boxy delivery van
src/models/hornBurst.js   the pulsing horn arcs
src/sim/lanes.js          lane records, spawn/despawn x, lane-change targets
src/sim/following.js      safeSpeed, pure
src/sim/vehicle.js        one road vehicle: state machine and movement
src/sim/traffic.js        pool, spawner, per-lane ordering, update
src/sim/audio.js          the horn, behind a click-to-enable gate
src/sim/pedestrian.js     renamed from customer.js, car removed
src/sim/simulation.js     reworked: owns traffic and the pedestrian pool
```

## Enabling sound

`index.html` gains a small fixed-position button reading "click for sound".
`main.js` wires it to `horn.enable()` and hides it once enabled. Everything
else works untouched with sound off, so the button is the only UI in the
project and stays out of the render loop.

## Testing

1. **following** — no leader gives cruise; touching gap gives zero; a stopped
   leader at `minGap` gives zero; a distant leader gives cruise; the result
   never exceeds cruise and is never negative; it rises monotonically with
   gap.
2. **lanes** — every lane's spawn and despawn sit outside the visible road
   and on opposite sides for opposing directions; lane-change targets are
   adjacent and same-direction.
3. **vehicle** — a cruising vehicle crosses the road and despawns; a pizza
   car reaches a bay; a pizza car facing a full lot honks, and balks after
   exactly `waitSeconds`; a balked vehicle never re-seeks; no state steps
   further than `speed * dt`.
4. **traffic** — over a long run, **no two vehicles in the same lane ever
   overlap**, counting each vehicle's own length; the population stays within
   bounds; the scene graph does not grow; every lane keeps flowing (no
   permanent gridlock).
5. **audio** — `play()` before `enable()` is silent and does not throw;
   `enable()` builds exactly one context; with no factory every call is a
   no-op.
6. **pedestrian** — the existing customer cycle assertions, minus driving.

## Decisions

- Car-following is a pure function of gap and speeds rather than a physics
  step, so the overlap invariant can be tested exhaustively without a
  renderer.
- Lane density is regulated per lane at the spawn point rather than by a
  global count, so a jam in one lane cannot starve the others.
- A balking vehicle clears its pizza intent, otherwise a full lot would
  produce a permanent queue of vehicles cycling back to try again.
