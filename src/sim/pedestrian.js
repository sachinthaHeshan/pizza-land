import * as THREE from 'three';
import { createFigure } from '../models/figure.js';
import { createPizzaBox } from '../models/pizzaBox.js';
import { walkInPath, walkOutPath, doorPosition } from './paths.js';

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

  return {
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

    isDone() {
      return state === 'DONE';
    },

    start(atBay) {
      bay = atBay;
      slot = null;
      pizzaBox.visible = false;
      group.visible = true;
      const door = doorPosition(layout, bay);
      place(door.x, door.z, layout.queue.facing);
      setState('WALKING_IN');
    },

    update(dt, world) {
      switch (state) {
        case 'WALKING_IN': {
          if (slot === null) {
            slot = world.firstFreeSlot();
            if (slot === null) return;
            follower.set(walkInPath(layout, bay, layout.queue.slots[slot]));
          }
          follower.step(dt, sim.speeds.walk);
          place(follower.x, follower.z, follower.heading);
          animateLegs(dt, !follower.done);
          if (follower.done) {
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
            follower.set(walkOutPath(layout, bay, layout.queue.slots[slot]));
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
}
