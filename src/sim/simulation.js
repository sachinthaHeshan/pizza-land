import * as THREE from 'three';
import { createCustomer } from './customer.js';
import { createPool } from './pool.js';

export function createSimulation(materials, layout) {
  const group = new THREE.Group();
  group.name = 'simulation';

  const bays = createPool(layout.sim.bays);
  const customers = [];

  for (let i = 0; i < layout.sim.customers; i++) {
    const customer = createCustomer(materials, layout, { index: i });
    customer.start(i * layout.sim.spawnGap);
    customers.push(customer);
    group.add(customer.group);
  }

  // Slot ownership is read straight off the agents, so there is exactly one
  // source of truth for who stands where.
  const world = {
    bays,
    isSlotFree(slotIndex) {
      return !customers.some((c) => c.slot === slotIndex);
    },
    firstFreeSlot() {
      for (let i = 0; i < layout.queue.slots.length; i++) {
        if (world.isSlotFree(i)) return i;
      }
      return null;
    },
  };

  return {
    group,
    customers,
    update(dt) {
      for (const customer of customers) customer.update(dt, world);
    },
  };
}
