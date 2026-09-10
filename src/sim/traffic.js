import * as THREE from 'three';
import { createVehicle } from './vehicle.js';
import { buildLanes } from './lanes.js';
import { mulberry32 } from '../utils/random.js';

// Picks a vehicle type by its share of the mix.
function pickType(types, roll) {
  let cursor = 0;
  for (const type of types) {
    cursor += type.share;
    if (roll <= cursor) return type;
  }
  return types[types.length - 1];
}

export function createTraffic(materials, layout, { horn, bays, takePedestrian, releasePedestrian }) {
  const group = new THREE.Group();
  group.name = 'traffic';
  const T = layout.traffic;
  const lanes = buildLanes(layout);
  const rng = mulberry32(T.seed);

  // One vehicle per lane slot, built up front and recycled forever.
  const vehicles = [];
  const poolSize = lanes.length * T.perLane;
  for (let i = 0; i < poolSize; i++) {
    const type = pickType(T.types, rng());
    const vehicle = createVehicle(materials, layout, { index: i, type, horn });
    vehicles.push(vehicle);
    group.add(vehicle.group);
  }

  // The vehicle immediately ahead in the same lane, or null. Only vehicles
  // actually on the road count — one parked in a bay keeps its old lane.
  function leaderFor(vehicle) {
    let best = null;
    for (const other of vehicles) {
      if (other === vehicle || !other.onRoad()) continue;
      if (other.lane !== vehicle.lane) continue;
      const ahead = (other.x - vehicle.x) * vehicle.lane.direction;
      if (ahead <= 0) continue;
      if (!best || ahead < (best.x - vehicle.x) * vehicle.lane.direction) best = other;
    }
    return best;
  }

  // Clearance is a bumper-to-bumper gap, not a centre-to-centre distance: a
  // bus is 9 long, so two vehicles 7 apart by centre can already be
  // intersecting. `length` is the length of the vehicle wanting the space.
  function laneIsClear(laneIndex, atX, clearance, length = 0) {
    return !vehicles.some((v) => {
      if (!v.onRoad() || !v.lane || v.lane.index !== laneIndex) return false;
      const gap = Math.abs(v.x - atX) - (length + v.length) / 2;
      return gap < clearance;
    });
  }

  const world = { lanes, bays, leaderFor, laneIsClear, takePedestrian, releasePedestrian };

  function spawnIfRoom(lane) {
    const active = vehicles.filter((v) => v.onRoad() && v.lane === lane);
    if (active.length >= T.perLane) return;

    const rearmost = active.reduce((worst, v) => {
      const travelled = (v.x - lane.spawnX) * lane.direction;
      return worst === null || travelled < worst ? travelled : worst;
    }, null);
    if (rearmost !== null && rearmost < T.spawnGap) return;

    const free = vehicles.find((v) => !v.isActive());
    if (!free) return;
    free.spawn(lane, lane.spawnX, rng() < T.pizzaChance);
  }

  return {
    group,
    vehicles,
    lanes,
    update(dt) {
      for (const lane of lanes) spawnIfRoom(lane);
      for (const vehicle of vehicles) vehicle.update(dt, world);
    },
  };
}
