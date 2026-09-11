import * as THREE from 'three';
import { createPizzaBox } from './pizzaBox.js';

const ARC_HEIGHT = 0.6;
// More than can ever fly at once: pickups launch every 0.3 s and land in
// 0.3 s, and a sale happens far from the oven.
const BOXES = 4;

// Boxes that fly on an arc from a start point to a target that may move,
// re-aiming every frame. The same few boxes are reused for the whole game.
export function createPizzaHops(materials, layout) {
  const { hopSeconds, carriedBox } = layout.sim.pizza;
  const group = new THREE.Group();
  group.name = 'pizzaHops';

  const hops = [];
  for (let i = 0; i < BOXES; i++) {
    const box = createPizzaBox(materials, carriedBox.size, carriedBox.thickness);
    box.visible = false;
    group.add(box);
    hops.push({ box, from: new THREE.Vector3(), target: null, onLand: null, elapsed: 0 });
  }

  return {
    group,

    launch(from, target, onLand) {
      const hop = hops.find((h) => !h.box.visible);
      // Never lose a pizza for want of a box: land it without the flight.
      if (!hop) {
        onLand();
        return;
      }
      hop.from.copy(from);
      hop.target = target;
      hop.onLand = onLand;
      hop.elapsed = 0;
      hop.box.position.copy(from);
      hop.box.visible = true;
    },

    update(dt) {
      for (const hop of hops) {
        if (!hop.box.visible) continue;
        hop.elapsed += dt;
        const s = Math.min(1, hop.elapsed / hopSeconds);
        hop.box.position.lerpVectors(hop.from, hop.target(), s);
        hop.box.position.y += 4 * ARC_HEIGHT * s * (1 - s);
        if (s >= 1) {
          hop.box.visible = false;
          hop.onLand();
        }
      }
    },
  };
}
