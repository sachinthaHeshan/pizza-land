import * as THREE from 'three';
import { box } from '../utils/geometry.js';

export function createPizzaBox(materials, size = 0.42) {
  const group = new THREE.Group();
  group.name = 'pizzaBox';
  const half = size / 2;
  const thickness = size * 0.16;

  group.add(
    box(materials.pizzaBox, {
      x: [-half, half],
      y: [-thickness / 2, thickness / 2],
      z: [-half, half],
    })
  );

  // A darker seam so the lid reads as a lid.
  group.add(
    box(materials.woodDark, {
      x: [-half, half],
      y: [thickness / 2 - size * 0.03, thickness / 2 - size * 0.01],
      z: [-half, -half + size * 0.04],
    })
  );

  return group;
}
