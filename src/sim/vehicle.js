import * as THREE from 'three';
import { createCar } from '../models/car.js';
import { createVan } from '../models/van.js';
import { createBus } from '../models/bus.js';
import { createHornBurst } from '../models/hornBurst.js';
import { safeSpeed } from './following.js';
import { lotEntryPath, lotExitPath } from './paths.js';

export const VEHICLE_STATES = Object.freeze([
  'PARKED_OFF',
  'CRUISING',
  'MERGING',
  'APPROACHING_LOT',
  'WAITING',
  'ENTERING',
  'PARKED',
  'LEAVING',
]);

const BUILDERS = { car: createCar, van: createVan, bus: createBus };

// Walks a follower along {x, z} waypoints; `reverse` holds the heading so a
// car can back out of a bay without spinning round.
function createFollower() {
  return {
    path: null, index: 0, x: 0, z: 0, heading: 0, done: true,
    set(path) {
      this.path = path;
      this.index = 1;
      this.x = path[0].x;
      this.z = path[0].z;
      this.done = path.length < 2;
    },
    step(dt, speed) {
      if (this.done || !this.path) return 0;
      let budget = speed * dt;
      let travelled = 0;
      while (budget > 0 && this.index < this.path.length) {
        const target = this.path[this.index];
        const dx = target.x - this.x;
        const dz = target.z - this.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= 1e-6) {
          this.index++;
          continue;
        }
        if (!target.reverse) this.heading = Math.atan2(dx, dz);
        const move = Math.min(budget, distance);
        this.x += (dx / distance) * move;
        this.z += (dz / distance) * move;
        budget -= move;
        travelled += move;
        if (move >= distance - 1e-6) this.index++;
      }
      if (this.index >= this.path.length) this.done = true;
      return travelled;
    },
  };
}

export function createVehicle(materials, layout, { index, type, horn }) {
  const T = layout.traffic;
  const group = new THREE.Group();
  group.name = `vehicle-${index}`;
  group.visible = false;

  const colour = type.colours[index % type.colours.length];
  const body = BUILDERS[type.model](materials, { colour, ...type });
  const burst = createHornBurst(materials);
  burst.position.y = type.height + 0.45;
  group.add(body, burst);

  const follower = createFollower();
  let state = 'PARKED_OFF';
  let lane = null;
  let x = 0;
  let z = 0;
  let speed = 0;
  let heading = 0;
  let timer = 0;
  let hornTimer = 0;
  let burstPhase = 0;
  let bay = null;
  let pedestrian = null;
  let wantsPizza = false;
  let changeFrom = 0;
  let changeTo = 0;
  let changeT = 0;

  function place() {
    group.position.set(x, 0, z);
    body.rotation.y = heading;
  }

  function rollWheels(distance) {
    const radius = type.height * 0.18;
    for (const wheel of body.userData.wheels) wheel.rotation.x -= distance / radius;
  }

  // Accelerate or brake toward a target, never jumping to it.
  function approachSpeed(target, dt) {
    const limit = target > speed ? T.follow.accel * dt : T.follow.decel * dt;
    speed += Math.max(-limit, Math.min(limit, target - speed));
    speed = Math.max(0, speed);
  }

  function gapToLeader(world) {
    const leader = world.leaderFor(vehicle);
    if (!leader) return { gap: Infinity, leaderSpeed: 0 };
    const along = Math.abs(leader.x - x);
    return { gap: along - (type.length + leader.length) / 2, leaderSpeed: leader.speed };
  }

  function driveAlongLane(dt, world) {
    const { gap, leaderSpeed } = gapToLeader(world);
    const target = safeSpeed({
      gap,
      leaderSpeed,
      cruise: type.cruise,
      minGap: T.follow.minGap,
      headway: T.follow.headway,
    });
    approachSpeed(target, dt);
    const moved = speed * dt * lane.direction;
    x += moved;
    rollWheels(Math.abs(moved));
    heading = lane.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  }

  function pastDespawn() {
    return lane.direction === -1 ? x <= lane.despawnX : x >= lane.despawnX;
  }

  function beginChange(toLane) {
    changeFrom = z;
    changeTo = toLane.z;
    changeT = 0;
    lane = toLane;
    state = 'MERGING';
  }

  const vehicle = {
    group,
    type,
    length: type.length,

    get state() { return state; },
    get x() { return x; },
    get z() { return z; },
    get speed() { return speed; },
    get lane() { return lane; },
    get bay() { return bay; },
    get wantsPizza() { return wantsPizza; },

    isActive() {
      return state !== 'PARKED_OFF';
    },

    // A vehicle in the lot still remembers the lane it came from, so anything
    // reasoning about traffic must ask this rather than isActive(). Without
    // it, cars on the road brake for a car parked in a bay.
    onRoad() {
      return ['CRUISING', 'MERGING', 'APPROACHING_LOT', 'WAITING'].includes(state);
    },

    spawn(inLane, atX, pizza) {
      lane = inLane;
      x = atX;
      z = inLane.z;
      speed = type.cruise;
      wantsPizza = Boolean(pizza) && type.wantsPizza && inLane.direction === -1;
      bay = null;
      pedestrian = null;
      timer = 0;
      heading = inLane.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
      group.visible = true;
      burst.visible = false;
      state = 'CRUISING';
      place();
    },

    update(dt, world) {
      switch (state) {
        case 'PARKED_OFF':
          return;

        case 'CRUISING': {
          driveAlongLane(dt, world);
          if (pastDespawn()) {
            group.visible = false;
            state = 'PARKED_OFF';
            place();
            return;
          }
          if (wantsPizza) {
            // Distance still to run before the entrance, along the direction
            // of travel. Only -1 lanes ever seek pizza, so this is x - entrance.
            const entrance = layout.parking.entrance.centreX;
            const distance = (x - entrance) * -lane.direction;
            if (distance <= T.laneChange.mergeDistance && distance > 0) {
              if (lane.index === 0) {
                state = 'APPROACHING_LOT';
              } else if (world.laneIsClear(0, x, T.laneChange.changeClearance, type.length)) {
                beginChange(world.lanes[0]);
              }
            }
          } else {
            // Overtake: if the leader has stopped close ahead and the
            // neighbouring lane is clear, pull out and pass.
            const leader = world.leaderFor(vehicle);
            if (leader && leader.speed < 0.4 && lane.neighbour !== null) {
              const ahead = Math.abs(leader.x - x) - (type.length + leader.length) / 2;
              if (
                ahead < T.laneChange.overtakeGap &&
                world.laneIsClear(lane.neighbour, x, T.laneChange.changeClearance, type.length)
              ) {
                beginChange(world.lanes[lane.neighbour]);
              }
            }
          }
          place();
          return;
        }

        case 'MERGING': {
          driveAlongLane(dt, world);
          changeT = Math.min(1, changeT + dt / T.laneChange.changeSeconds);
          z = changeFrom + (changeTo - changeFrom) * changeT;
          if (changeT >= 1) {
            z = changeTo;
            state = wantsPizza && lane.index === 0 ? 'APPROACHING_LOT' : 'CRUISING';
          }
          place();
          return;
        }

        case 'APPROACHING_LOT': {
          const entrance = layout.parking.entrance.centreX;
          const remaining = x - entrance;
          // Easing toward the entrance is not enough on its own: a second car
          // heading for the same entrance would drive into the back of the
          // first. Whichever of the two limits is lower wins.
          const { gap, leaderSpeed } = gapToLeader(world);
          const following = safeSpeed({
            gap,
            leaderSpeed,
            cruise: type.cruise,
            minGap: T.follow.minGap,
            headway: T.follow.headway,
          });
          const approach =
            remaining <= 0.05 ? 0 : Math.min(type.cruise, Math.max(0.6, remaining * 0.9));
          approachSpeed(Math.min(following, approach), dt);
          const moved = Math.min(speed * dt, Math.max(0, remaining));
          x -= moved;
          rollWheels(moved);
          if (remaining <= 0.06) {
            x = entrance;
            speed = 0;
            bay = world.bays.acquire();
            if (bay) {
              pedestrian = world.takePedestrian();
              if (!pedestrian) {
                world.bays.release(bay);
                bay = null;
              }
            }
            if (bay) {
              follower.set(lotEntryPath(layout, bay));
              state = 'ENTERING';
            } else {
              timer = 0;
              hornTimer = 0;
              burst.visible = true;
              state = 'WAITING';
            }
          }
          place();
          return;
        }

        case 'WAITING': {
          speed = 0;
          timer += dt;
          hornTimer += dt;
          burstPhase += dt * 9;
          burst.userData.setPhase(burstPhase);
          if (hornTimer >= T.hornInterval) {
            hornTimer = 0;
            horn.play();
          }

          bay = world.bays.acquire();
          if (bay) {
            pedestrian = world.takePedestrian();
            if (!pedestrian) {
              world.bays.release(bay);
              bay = null;
            }
          }
          if (bay) {
            burst.visible = false;
            follower.set(lotEntryPath(layout, bay));
            state = 'ENTERING';
            return;
          }
          if (timer >= T.waitSeconds) {
            burst.visible = false;
            wantsPizza = false;
            state = 'CRUISING';
          }
          return;
        }

        case 'ENTERING': {
          const moved = follower.step(dt, type.cruise * 0.42);
          rollWheels(moved);
          x = follower.x;
          z = follower.z;
          heading = follower.heading;
          if (follower.done) {
            heading = bay.facing;
            pedestrian.start(bay);
            state = 'PARKED';
          }
          place();
          return;
        }

        case 'PARKED': {
          speed = 0;
          if (pedestrian.isDone()) {
            world.releasePedestrian(pedestrian);
            pedestrian = null;
            follower.set(lotExitPath(layout, bay));
            state = 'LEAVING';
          }
          place();
          return;
        }

        case 'LEAVING': {
          const moved = follower.step(dt, type.cruise * 0.42);
          rollWheels(moved);
          x = follower.x;
          z = follower.z;
          heading = follower.heading;
          if (follower.done) {
            // Wait at the mouth of the exit until there is a gap; otherwise
            // the car would appear in the lane on top of passing traffic.
            if (!world.laneIsClear(0, x, T.laneChange.changeClearance, type.length)) {
              speed = 0;
              place();
              return;
            }
            world.bays.release(bay);
            bay = null;
            wantsPizza = false;
            lane = world.lanes[0];
            z = lane.z;
            speed = 0;
            state = 'CRUISING';
          }
          place();
          return;
        }

        default:
          return;
      }
    },
  };

  return vehicle;
}
