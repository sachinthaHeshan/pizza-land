import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';
import { createTraffic } from './traffic.js';
import { createPool } from './pool.js';

export function createSimulation(materials, layout, { horn } = {}) {
  const group = new THREE.Group();
  group.name = 'simulation';
  const silentHorn = { play() {} };

  const pedestrians = [];
  for (let i = 0; i < layout.sim.pedestrians; i++) {
    const pedestrian = createPedestrian(materials, layout, { index: i });
    pedestrians.push(pedestrian);
    group.add(pedestrian.group);
  }

  const world = {
    isSlotFree(slotIndex) {
      return !pedestrians.some((p) => p.slot === slotIndex);
    },
    firstFreeSlot() {
      for (let i = 0; i < layout.queue.slots.length; i++) {
        if (world.isSlotFree(i)) return i;
      }
      return null;
    },
  };

  // Pedestrians go through a pool rather than a scan for an IDLE one. A
  // vehicle claims its passenger on approach but only calls start() once it
  // reaches the bay; scanning would hand the same pedestrian to a second
  // vehicle inside that window.
  const pedestrianPool = createPool(pedestrians);

  const traffic = createTraffic(materials, layout, {
    horn: horn || silentHorn,
    bays: createPool(layout.sim.bays),
    takePedestrian: () => pedestrianPool.acquire(),
    releasePedestrian: (pedestrian) => pedestrianPool.release(pedestrian),
  });
  group.add(traffic.group);

  return {
    group,
    pedestrians,
    traffic,
    world,
    update(dt) {
      traffic.update(dt);
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
    },
  };
}
