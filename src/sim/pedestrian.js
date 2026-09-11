import * as THREE from 'three';
import { createFigure } from '../models/figure.js';
import { createPizzaBox } from '../models/pizzaBox.js';
import { walkInPath, walkOutPath, doorPosition, slotPosition } from './paths.js';

export const PEDESTRIAN_STATES = Object.freeze([
  'IDLE',
  'WALKING_IN',
  'QUEUEING',
  'AT_COUNTER',
  'WALKING_OUT',
  'DONE',
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

    // Steer the remaining destination without sending the walker back to
    // the start of the path. Unchanged targets are left alone so a walker
    // can actually arrive.
    retarget(dest, plazaZ) {
      if (!this.path || this.path.length < 2) return;
      const last = this.path[this.path.length - 1];
      if (Math.abs(last.x - dest[0]) < 1e-6 && Math.abs(last.z - dest[1]) < 1e-6) return;
      this.path[this.path.length - 1] = { x: dest[0], z: dest[1] };
      if (this.path.length >= 4) {
        this.path[this.path.length - 2] = { x: dest[0], z: plazaZ };
      }
      if (this.index >= this.path.length) this.index = this.path.length - 1;
      this.done = false;
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
        this.heading = Math.atan2(dx, dz);
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

export function createPedestrian(materials, layout, { index }) {
  const sim = layout.sim;
  const person = sim.people[index % sim.people.length];

  const group = new THREE.Group();
  group.name = `pedestrian-${index}`;
  group.visible = false;

  const figure = createFigure(materials, { ...person, x: 0, z: 0, facing: 0 });
  const pizzaBox = createPizzaBox(materials);
  pizzaBox.visible = false;
  group.add(figure, pizzaBox);

  const follower = createFollower();
  let state = 'IDLE';
  let timer = 0;
  let stridePhase = 0;
  let slot = null;
  let bay = null;

  const boxHeight = person.height * 0.52;
  const boxReach = person.height * 0.16;

  function setState(next) {
    state = next;
    timer = 0;
  }

  function place(x, z, heading) {
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

  const pedestrian = {
    group,
    figure,

    get state() {
      return state;
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

    showBox() {
      pizzaBox.visible = true;
    },

    boxPosition(out) {
      return out.copy(pizzaBox.position);
    },

    isDone() {
      return state === 'DONE';
    },

    start(atBay) {
      bay = atBay;
      slot = null;
      pizzaBox.visible = false;
      group.visible = true;
      follower.path = null;
      follower.done = true;
      const door = doorPosition(layout, bay);
      place(door.x, door.z, layout.queue.facing);
      setState('WALKING_IN');
    },

    reassignSlot(next) {
      if (slot === next) return;
      slot = next;
      if (state === 'WALKING_IN' || state === 'QUEUEING') {
        follower.retarget(slotPosition(layout, slot), sim.walk.plazaZ);
      }
    },

    update(dt, world) {
      switch (state) {
        case 'WALKING_IN': {
          // Join the line only on arrival. Holding a slot from the car lets
          // a slow walker keep a place in front of people already queued.
          const tail = slotPosition(layout, world.queueLength());
          if (!follower.path) {
            follower.set(walkInPath(layout, bay, tail));
          } else {
            follower.retarget(tail, sim.walk.plazaZ);
          }
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            slot = world.enqueueSlot();
            place(follower.x, follower.z, layout.queue.facing);
            setState(slot === 0 ? 'AT_COUNTER' : 'QUEUEING');
          }
          return;
        }

        case 'QUEUEING': {
          animateLegs(dt, !follower.done);
          if (!follower.done) {
            follower.step(dt, sim.speeds.walk);
            place(follower.x, follower.z, follower.heading);
            if (follower.done) {
              place(follower.x, follower.z, layout.queue.facing);
              if (slot === 0) setState('AT_COUNTER');
            }
            return;
          }
          const ahead = slot - 1;
          if (ahead >= 0 && world.isSlotFree(ahead)) {
            slot = ahead;
            const target = slotPosition(layout, slot);
            follower.set([
              { x: figure.position.x, z: figure.position.z },
              { x: target[0], z: target[1] },
            ]);
          }
          return;
        }

        case 'AT_COUNTER': {
          animateLegs(dt, false);
          // Serving needs the cashier in the sell zone. Stepping away pauses
          // the timer rather than resetting it.
          if (world.canServe()) timer += dt;
          if (timer >= sim.serveSeconds) {
            // The box appears in the customer's hands when the thrown one lands.
            world.recordSale(pedestrian);
            follower.set(walkOutPath(layout, bay, slotPosition(layout, slot)));
            slot = null;
            setState('WALKING_OUT');
          }
          return;
        }

        case 'WALKING_OUT': {
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
            group.visible = false;
            pizzaBox.visible = false;
            setState('DONE');
          }
          return;
        }

        default:
          return;
      }
    },
  };

  return pedestrian;
}
