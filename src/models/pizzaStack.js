import * as THREE from 'three';
import { createPizzaBox } from './pizzaBox.js';

// The boxes a player carries, built bottom-up from the stack's origin. Every
// box exists from the start and is only shown or hidden, so carrying
// allocates nothing.
export function createPizzaStack(materials, layout) {
  const { carryMax, carriedBox } = layout.sim.pizza;
  const group = new THREE.Group();
  group.name = 'pizzaStack';

  for (let i = 0; i < carryMax; i++) {
    const box = createPizzaBox(materials, carriedBox.size, carriedBox.thickness);
    box.position.y = (i + 0.5) * carriedBox.thickness;
    box.visible = false;
    group.add(box);
  }

  group.userData.setCount = (count) => {
    group.children.forEach((box, i) => {
      box.visible = i < count;
    });
  };

  group.userData.slotPosition = (index, out) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(out.set(0, (index + 0.5) * carriedBox.thickness, 0));
  };

  return group;
}
