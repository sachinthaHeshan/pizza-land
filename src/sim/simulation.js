import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';

export function createSimulation(materials, layout) {
  const group = new THREE.Group();
  group.name = 'simulation';

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

  return {
    group,
    pedestrians,
    world,
    update(dt) {
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
    },
  };
}
