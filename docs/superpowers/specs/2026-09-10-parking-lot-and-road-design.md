# Parking Lot and Four-Lane Road — Design (Part A)

Date: 2026-09-10
Status: Approved
Builds on: `2026-09-10-customer-cycle-simulation-design.md`
Followed by: Part B, the traffic system

## Goal

Replace the painted-on-the-road parking with a real parking lot in front of
the shop — two rows of four bays either side of a drive aisle — separated
from the road by a kerbed planting island. Remark the road as four lanes,
two each way. Re-route the three simulated cars through the lot's entrance,
aisle and bays.

## Scope

In scope:

- A dedicated asphalt parking lot with eight marked bays in two rows
- A drive aisle between the rows, entered and exited through gaps in the island
- A kerbed planting island dividing the lot from the road
- The road remarked as four lanes: two heading `-X`, two heading `+X`, with
  dashed lane dividers and a solid double centre line
- A pedestrian walkway from the aisle to the sidewalk, clear of the bays
- Camera reframed so the shop and all four lanes are visible at once
- The three existing simulated cars routed through the new lot

Out of scope — these are Part B:

- Continuous mixed traffic, bus and van models, 12–16 vehicles
- Car-following, lane changes, overtaking
- Random pizza intent, honking, balking when the lot is full

## Geometry

Bands front to back. `z` grows away from the shop; the shop's plaza ends at
`z = 8`.

| Band | `z` range | Surface |
|---|---|---|
| Sidewalk | `8 → 10.5` | paving |
| Kerb (sidewalk to lot) | `10.5 → 10.9` | stone, `y -0.15 → 0` |
| Row A bays, nose toward the shop | `11.0 → 15.6` | asphalt |
| Drive aisle | `15.6 → 19.4` | asphalt |
| Row B bays, nose toward the road | `19.4 → 24.0` | asphalt |
| Kerbed planting island | `24.0 → 26.5` | kerb + planting |
| Road | `26.5 → 40.5` | asphalt |
| Kerb (far side) | `40.5 → 40.9` | stone |
| Paving behind | `40.9 → 46` | paving |

The parking lot surface spans `x = -8.5 → 8.5`; beyond that the sidewalk
paving continues, so the lot reads as its own area rather than more road.

### Bays

Eight bays, four per row, 2.6 apart, centred on the shop:

- Bay `x` centres: `-3.9`, `-1.3`, `1.3`, `3.9`
- Row A car centre `z = 13.3`, facing `-Z` (nose toward the shop)
- Row B car centre `z = 21.7`, facing `+Z` (nose toward the road)

Both rows are entered nose-first from the shared aisle, as in a real lot. A
car is 4.2 long and 1.8 wide, so a 4.6-deep, 2.6-wide bay clears it.

### Island and gaps

The island runs `z 24.0 → 26.5` with a raised kerb and a low planting bed,
broken by two gaps:

- **Entrance** at `x 5.0 → 8.5`, centre `6.75`
- **Exit** at `x -8.5 → -5.0`, centre `-6.75`

Traffic in the kerb lane runs `-X`, so cars turn in on the right and rejoin
on the left, which keeps entering and leaving traffic from crossing. Island
segments are therefore `x -40 → -8.5`, `-5.0 → 5.0`, and `8.5 → 40`.

### Road lanes

Four lanes of 3.5, from the island outward:

| Lane | Centre `z` | Direction |
|---|---|---|
| 0 (kerb lane) | `28.25` | `-X` |
| 1 | `31.75` | `-X` |
| 2 | `35.25` | `+X` |
| 3 | `38.75` | `+X` |

Markings: dashed dividers at `z = 30.0` and `z = 37.0`, and a solid double
centre line at `z = 33.5`.

## Routing

**Arrival** — `(45, 28.25) → (6.75, 28.25) → (6.75, 17.5) → (bayX, 17.5) →
(bayX, bayZ)`. The car cruises the kerb lane, turns down the entrance into
the aisle, runs along the aisle, then noses into its bay.

**Departure** — `(bayX, bayZ) → (bayX, 17.5) reverse → (-6.75, 17.5) →
(-6.75, 28.25) → (-45, 28.25)`. It backs out into the aisle, drives to the
exit gap, and rejoins the kerb lane.

**Walking** — the walkway sits at `x = 0`, which is a *boundary between two
bays* (bay edges fall at `-5.2, -2.6, 0, 2.6, 5.2`), so no parked car ever
stands on it. A walkway at `x = 6.0` would have been wrong: the entrance
path runs down `x = 6.75` and a car is 1.8 wide, occupying `5.85 → 7.65`,
so pedestrians and entering cars would overlap.

The door is always at `bayX + 1.1`, which lands inside the car's own bay and
clear of the car itself (a car at `bayX` spans `bayX ± 0.9`), so the two
routes are:

- **Row A** — `door → (doorX, 10.2) → (slotX, 8.6) → slot`. It noses toward
  the shop already, so its occupant walks straight out the front.
- **Row B** — `door → (doorX, 17.5) → (0, 17.5) → (0, 10.2) →
  (slotX, 8.6) → slot`. Along the aisle, then down the walkway.

Return paths are these reversed.

## Camera

At `frustumSize: 26` the view reaches only about `z = 26` at `x = 0`, so a
road at `z = 40` falls outside the frame entirely. The camera becomes:

- `frustumSize: 34`
- `target: [0, 1.2, 13]`

This puts the shop upper-right and the road lower-left with both fully in
frame. The shop renders smaller; that is the unavoidable cost of showing
four lanes. Exact values are confirmed by visual verification.

## Modules

```
src/building/parking.js   lot surface, bay lines, kerbed planting island
src/building/ground.js    reworked: sidewalk, four-lane road, lane markings
src/sim/paths.js          gains lot entrance, aisle and bay routing
src/layout.js             gains layout.parking; ground and camera reshaped
src/materials.js          gains `planting` and `laneCentre`
```

`createParking(materials, layout) -> THREE.Group` named `'parking'`, added to
the shop between `ground` and `perimeter`.

## Testing

1. **Layout** — the eight bays are disjoint and lie inside the lot surface;
   the aisle separates the rows without overlapping either; the island gaps
   are wide enough for a car; lane centres are evenly spaced and sit inside
   the road band.
2. **Parking module** — the group builds, has finite bounds inside its
   envelope, draws five divider lines per row (ten in total, one per bay
   boundary), builds three island segments, and leaves both gaps unbuilt.
3. **Paths** — arrival ends at the bay centre; departure starts there and
   ends at the exit `x`; the first departure segment is flagged `reverse`;
   every driving waypoint lies on the lot or the road; no walking waypoint
   falls inside a bay rectangle.
4. **Existing suites** stay green: the customer cycle and simulation
   invariants are unchanged by the new geometry.

## Decisions

- Separate entrance and exit gaps rather than one shared gap, so entering
  and leaving cars never meet head-on in a 3.5-wide opening. This also
  matters for Part B, where a dozen vehicles use the lot.
- Pedestrians route along a dedicated walkway rather than straight from bay
  to sidewalk, which would walk them through parked cars in Row A.
- The lot keeps its own asphalt rectangle rather than extending the road
  surface, so the two read as separate places even before the island is
  visible.
- The walkway runs on a bay boundary rather than down a clear strip at the
  edge of the lot, because every edge strip is either a bay or the entrance
  path. A boundary line is free space by construction.
