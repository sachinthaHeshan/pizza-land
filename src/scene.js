import * as THREE from 'three';
import { createGround } from './building/ground.js';
import { createParking } from './building/parking.js';
import { createPerimeter } from './building/perimeter.js';
import { createDiningWing } from './building/diningWing.js';
import { createStorefront } from './building/storefront.js';
import { createKitchen } from './building/kitchen.js';
import { createOven } from './building/oven.js';
import { createCounter } from './building/counter.js';
import { createSideWing } from './building/sideWing.js';
import { createQueue } from './building/queue.js';
import { createLighting } from './lighting.js';
import { createSimulation } from './sim/simulation.js';

export function createShop(materials, layout, { horn } = {}) {
  const shop = new THREE.Group();
  shop.name = 'shop';

  const ground = createGround(materials, layout);
  const parking = createParking(materials, layout);
  const perimeter = createPerimeter(materials, layout);
  const diningWing = createDiningWing(materials, layout);
  const storefront = createStorefront(materials, layout);
  const kitchen = createKitchen(materials, layout);
  const oven = createOven(materials, layout);
  const counter = createCounter(materials, layout);
  const sideWing = createSideWing(materials, layout);
  const queue = createQueue(materials, layout);
  const simulation = createSimulation(materials, layout, { horn });

  const s = layout.storefront;
  const lighting = createLighting(layout, {
    lamps: storefront.userData.lampAnchors,
    storefront: [
      new THREE.Vector3(-8.6, 1.8, s.z - 1.0),
      new THREE.Vector3(-4.6, 1.8, s.z - 1.0),
    ],
    sideWindow: sideWing.userData.windowAnchor,
  });

  shop.add(
    ground, parking, perimeter, diningWing, storefront, kitchen, oven,
    counter, sideWing, queue, simulation.group, lighting
  );
  shop.userData.fireLight = oven.userData.fireLight;
  shop.userData.simulation = simulation;

  return shop;
}
