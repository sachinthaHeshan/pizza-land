import * as THREE from 'three';
import { createPedestrian } from './pedestrian.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPool } from './pool.js';
import { createOvenStock } from './ovenStock.js';
import { createZoneMarker } from '../models/zoneMarker.js';
import { createPizzaHops } from '../models/pizzaHops.js';

function inside(position, zone) {
  return (
    position.x >= zone.x[0] && position.x <= zone.x[1] &&
    position.z >= zone.z[0] && position.z <= zone.z[1]
  );
}

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

  const PIZZA_PRICE = 5;
  let balance = 0;

  const pizza = layout.sim.pizza;
  const player = createPlayer(materials, layout);
  const oven = createOvenStock(layout);
  const hops = createPizzaHops(materials, layout);
  const sellZone = layout.queue.sellZone;
  const pickupZone = layout.oven.pickupZone;
  const mouth = layout.oven.mouth;
  // Picked-up boxes leave from the middle of the oven's arch.
  const ovenMouth = new THREE.Vector3(mouth.x, mouth.sill + mouth.height / 2, layout.oven.dome.center[2]);
  // Counts change at launch; the stack only shows a box once it has landed.
  let inFlightToPlayer = 0;

  const world = {
    isSlotFree(slotIndex) {
      return !pedestrians.some((p) => p.slot === slotIndex);
    },
    queueLength() {
      return pedestrians.filter((p) => p.slot !== null).length;
    },
    // FIFO: a slot is claimed when the person reaches the line, behind
    // whoever is already standing there.
    enqueueSlot() {
      let last = -1;
      for (const pedestrian of pedestrians) {
        if (pedestrian.slot !== null && pedestrian.slot > last) last = pedestrian.slot;
      }
      return last + 1;
    },
    // Customers are only served by a cashier in the sell zone with a pizza.
    canServe() {
      return inside(player.figure.position, sellZone) && player.carried >= 1;
    },
    recordSale(pedestrian) {
      balance += PIZZA_PRICE;
      const from = player.stack.userData.slotPosition(
        Math.max(0, player.carried - 1),
        new THREE.Vector3()
      );
      player.handOver();
      const aim = new THREE.Vector3();
      hops.launch(from, () => pedestrian.boxPosition(aim), () => pedestrian.showBox());
    },
  };

  function pickUp() {
    const slot = player.carried;
    player.receive();
    inFlightToPlayer++;
    const aim = new THREE.Vector3();
    hops.launch(
      ovenMouth,
      () => player.stack.userData.slotPosition(slot, aim),
      () => {
        inFlightToPlayer--;
      }
    );
  }

  function compactQueue() {
    const holders = pedestrians
      .filter((p) => p.slot !== null)
      .sort((a, b) => a.slot - b.slot);
    holders.forEach((p, i) => p.reassignSlot(i));
  }

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

  group.add(player.figure);
  group.add(hops.group);

  // The cashier's outline sits just above the counter top, because the
  // counter hides the floor behind it from the game camera. The oven's
  // outline can sit on the floor, where the camera sees it.
  const sellPoint = createZoneMarker(materials, {
    name: 'sellPoint',
    zone: sellZone,
    outlineY: layout.counter.topHeight + layout.surfaceEps * 2,
    bannerMaterial: materials.sellBanner,
    banner: layout.queue.sellBanner,
  });
  const ovenPoint = createZoneMarker(materials, {
    name: 'ovenPoint',
    zone: pickupZone,
    outlineY: layout.ground.floorY.terracotta + layout.surfaceEps,
    bannerMaterial: materials.ovenBanner,
    banner: layout.oven.banner,
  });
  group.add(sellPoint, ovenPoint);

  return {
    group,
    pedestrians,
    traffic,
    player,
    oven,
    hops,
    sellPoint,
    ovenPoint,
    world,
    get balance() {
      return balance;
    },
    update(dt, keys) {
      player.update(dt, keys);
      const released = oven.update(dt, {
        inZone: inside(player.figure.position, pickupZone),
        room: pizza.carryMax - player.carried,
      });
      for (let i = 0; i < released; i++) pickUp();

      traffic.update(dt);
      compactQueue();
      for (const pedestrian of pedestrians) pedestrian.update(dt, world);
      hops.update(dt);
      player.stack.userData.setCount(Math.max(0, player.carried - inFlightToPlayer));

      // The guidance table from the spec.
      const waiting = pedestrians.some((p) => p.state === 'AT_COUNTER');
      const carrying = player.carried >= 1;
      const callToSell = waiting && carrying && !inside(player.figure.position, sellZone);
      sellPoint.userData.update(dt, { pulse: callToSell, showBanner: callToSell });
      ovenPoint.userData.update(dt, { pulse: waiting && !carrying, showBanner: true });
      materials.ovenBanner.map.userData.setCount(oven.stock, pizza.ovenCapacity);
    },
  };
}
