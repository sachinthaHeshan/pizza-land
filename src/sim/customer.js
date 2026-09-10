import * as THREE from 'three';
import { createFigure } from '../models/figure.js';
import { createCar } from '../models/car.js';
import { createPizzaBox } from '../models/pizzaBox.js';
import {
  arrivalPath,
  departurePath,
  walkInPath,
  walkOutPath,
  doorPosition,
} from './paths.js';

export const STATES = Object.freeze([
  'IDLE',
  'APPROACHING',
  'PARKING',
  'WALKING_IN',
  'QUEUEING',
  'AT_COUNTER',
  'WALKING_OUT',
  'BOARDING',
  'DEPARTING',
]);

// Walks a follower along a list of {x, z} waypoints at a fixed speed.
function createFollower() {
  return {
    path: null,
    index: 0,
    x: 0,
    z: 0,
    heading: Math.PI,
    done: true,

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
        if (!target.reverse) {
          this.heading = Math.atan2(dx, dz);
        }
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

export function createCustomer(materials, layout, { index }) {
  const sim = layout.sim;
  const person = sim.people[index % sim.people.length];
  const colour = sim.car.colours[index % sim.car.colours.length];

  const group = new THREE.Group();
  group.name = `customer-${index}`;
  group.visible = false;

  const car = createCar(materials, { colour, ...sim.car });
  const figure = createFigure(materials, { ...person, x: 0, z: 0, facing: 0 });
  const pizzaBox = createPizzaBox(materials);
  pizzaBox.visible = false;

  // Car and figure move independently, so they are siblings under a group that
  // stays at the origin; each carries its own world position.
  group.add(car, figure, pizzaBox);

  const follower = createFollower();
  let state = 'IDLE';
  let timer = 0;
  let stridePhase = 0;
  let bay = null;
  let slot = null;

  const boxHeight = person.height * 0.52;
  const boxReach = person.height * 0.16;

  function setState(next) {
    state = next;
    timer = 0;
  }

  // Eases toward a heading by the shortest arc, so the car sweeps through its
  // turns instead of snapping when a waypoint changes direction.
  function turnCar(target, dt) {
    const delta = ((target - car.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    car.rotation.y += delta * Math.min(1, dt * 6);
  }

  function placeCar(x, z, heading, dt) {
    car.position.set(x, 0, z);
    if (dt === undefined) car.rotation.y = heading;
    else turnCar(heading, dt);
  }

  function placeFigure(x, z, heading) {
    figure.position.set(x, 0, z);
    figure.rotation.y = heading;
    pizzaBox.position.set(
      x + Math.sin(heading) * boxReach,
      boxHeight,
      z + Math.cos(heading) * boxReach
    );
    pizzaBox.rotation.y = heading;
  }

  function animateLegs(dt, moving) {
    const limbs = figure.userData.limbs;
    if (moving) {
      stridePhase += dt * sim.stride.frequency;
      const swing = Math.sin(stridePhase) * sim.stride.amplitude;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * sim.stride.armScale;
      limbs.armR.rotation.x = swing * sim.stride.armScale;
    } else {
      for (const limb of Object.values(limbs)) {
        limb.rotation.x *= Math.max(0, 1 - dt * 8);
      }
    }
  }

  function rollWheels(distance) {
    const radius = sim.car.height * 0.21;
    for (const wheel of car.userData.wheels) {
      wheel.rotation.x -= distance / radius;
    }
  }

  const customer = {
    group,
    figure,
    car,

    get state() {
      return state;
    },
    get bay() {
      return bay;
    },
    get slot() {
      return slot;
    },
    get hasBox() {
      return pizzaBox.visible;
    },

    figurePosition() {
      return figure.position.clone();
    },

    start(delay = 0) {
      setState('IDLE');
      timer = -delay;
    },

    update(dt, world) {
      switch (state) {
        case 'IDLE': {
          timer += dt;
          if (timer < 0) return;
          bay = world.bays.acquire();
          if (bay === null) return;
          group.visible = true;
          figure.visible = false;
          follower.set(arrivalPath(layout, bay));
          placeCar(follower.x, follower.z, -Math.PI / 2);
          setState('APPROACHING');
          return;
        }

        case 'APPROACHING': {
          const moved = follower.step(dt, sim.speeds.car);
          rollWheels(moved);
          placeCar(follower.x, follower.z, follower.heading, dt);
          if (follower.done) setState('PARKING');
          return;
        }

        case 'PARKING': {
          timer += dt;
          if (timer < 0.4) return;
          slot = world.firstFreeSlot();
          if (slot === null) return;
          const target = layout.queue.slots[slot];
          const door = doorPosition(layout, bay);
          // The turn-in easing may not have finished; square the car up.
          car.rotation.y = bay.facing;
          figure.visible = true;
          follower.set(walkInPath(layout, bay, target));
          placeFigure(door.x, door.z, layout.queue.facing);
          setState('WALKING_IN');
          return;
        }

        case 'WALKING_IN': {
          follower.step(dt, sim.speeds.walk);
          placeFigure(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            placeFigure(follower.x, follower.z, layout.queue.facing);
            setState(slot === 0 ? 'AT_COUNTER' : 'QUEUEING');
          }
          return;
        }

        case 'QUEUEING': {
          animateLegs(dt, !follower.done);
          if (!follower.done) {
            follower.step(dt, sim.speeds.walk);
            placeFigure(follower.x, follower.z, follower.heading);
            if (follower.done) {
              placeFigure(follower.x, follower.z, layout.queue.facing);
              if (slot === 0) setState('AT_COUNTER');
            }
            return;
          }
          // Shuffle forward whenever the slot ahead is free.
          const ahead = slot - 1;
          if (ahead >= 0 && world.isSlotFree(ahead)) {
            slot = ahead;
            const target = layout.queue.slots[slot];
            follower.set([
              { x: figure.position.x, z: figure.position.z },
              { x: target[0], z: target[1] },
            ]);
          }
          return;
        }

        case 'AT_COUNTER': {
          animateLegs(dt, false);
          timer += dt;
          if (timer >= sim.serveSeconds) {
            pizzaBox.visible = true;
            const target = layout.queue.slots[slot];
            follower.set(walkOutPath(layout, bay, target));
            slot = null;
            setState('WALKING_OUT');
          }
          return;
        }

        case 'WALKING_OUT': {
          follower.step(dt, sim.speeds.walk);
          placeFigure(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) setState('BOARDING');
          return;
        }

        case 'BOARDING': {
          animateLegs(dt, false);
          timer += dt;
          if (timer >= sim.boardSeconds) {
            figure.visible = false;
            pizzaBox.visible = false;
            follower.set(departurePath(layout, bay));
            setState('DEPARTING');
          }
          return;
        }

        case 'DEPARTING': {
          const moved = follower.step(dt, sim.speeds.car);
          rollWheels(moved);
          placeCar(follower.x, follower.z, follower.heading, dt);
          if (follower.done) {
            world.bays.release(bay);
            bay = null;
            group.visible = false;
            setState('IDLE');
            timer = -sim.respawnDelay;
          }
          return;
        }

        default:
          return;
      }
    },
  };

  return customer;
}
