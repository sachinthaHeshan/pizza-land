import { describe, it, expect } from 'vitest';
import { createShop, createHouse, shopSignCentre, houseDoorCentre } from '../../src/town/buildings.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const shopLot = {
  row: 'first', kind: 'shop', x: [10, 22], z: [52, 61], storeys: 2, walls: 6.4, rise: 0, height: 6.8,
  wall: 'wallMint', awning: 'stripeBlue', sign: 'woodDark', chimney: false,
};
const houseLot = {
  row: 'second', kind: 'house', x: [-20, -8], z: [74, 83], storeys: 2, walls: 6.0, rise: 2.4, height: 8.8,
  wall: 'wallPeach', roof: 'roofSlate', chimney: true,
};

function meshesWith(group, materialName) {
  const found = [];
  group.traverse((o) => {
    if (o.isMesh && o.material.name === materialName) found.push(o);
  });
  return found;
}

describe('createShop', () => {
  it('builds a named shop that fills its lot and reaches its planned height', () => {
    const shop = createShop(stubMaterials(), shopLot);
    expect(shop.name).toBe('shop');
    const all = boundsOf(shop);
    expectFinite(all);
    expect(all.min.y).toBeGreaterThanOrEqual(0);
    expect(all.max.y).toBeCloseTo(6.8, 5);
    const walls = boundsOf(meshesWith(shop, 'wallMint')[0]);
    expect(walls.min.x).toBeCloseTo(10.1, 5);
    expect(walls.max.x).toBeCloseTo(21.9, 5);
    expect(walls.min.z).toBeCloseTo(52, 5);
    expect(walls.max.z).toBeCloseTo(61, 5);
    expect(walls.max.y).toBeCloseTo(6.4, 5);
  });

  it('puts the glass front, awning and sign on the +z face', () => {
    const shop = createShop(stubMaterials(), shopLot);
    const glass = meshesWith(shop, 'glass').map(boundsOf);
    expect(glass.some((b) => b.min.z >= 61 - 1e-6 && b.max.y <= 2.6 + 1e-6)).toBe(true);
    for (const b of glass) expect(b.max.z).toBeGreaterThan(52.5);
    const awning = meshesWith(shop, 'stripeBlue').map(boundsOf);
    expect(awning.length).toBeGreaterThan(0);
    for (const b of awning) expect(b.min.z).toBeGreaterThanOrEqual(61 - 1e-6);
    const sign = meshesWith(shop, 'woodDark').map(boundsOf).filter((b) => b.min.y > 2.5);
    expect(sign).toHaveLength(1);
    expect(sign[0].min.z).toBeGreaterThanOrEqual(61);
  });

  it('tops the shop with a stone parapet', () => {
    const shop = createShop(stubMaterials(), shopLot);
    const caps = meshesWith(shop, 'stone').map(boundsOf).filter((b) => Math.abs(b.max.y - 6.8) < 1e-6);
    expect(caps).toHaveLength(1);
    expect(caps[0].min.y).toBeCloseTo(6.4, 5);
  });

  it('gives only a two-storey shop upstairs windows, on the +z and −x faces', () => {
    const upstairs = (lot) => meshesWith(createShop(stubMaterials(), lot), 'glass').map(boundsOf).filter((b) => b.min.y > 3.4);
    const two = upstairs(shopLot);
    expect(two.some((b) => b.min.z >= 61 - 1e-6)).toBe(true);
    expect(two.some((b) => b.max.x <= 10.1 + 1e-6)).toBe(true);
    expect(upstairs({ ...shopLot, storeys: 1, walls: 3.4, height: 3.8 })).toHaveLength(0);
  });

  it('aims the sign centre just in front of the sign board', () => {
    const board = meshesWith(createShop(stubMaterials(), shopLot), 'woodDark').map(boundsOf).find((b) => b.min.y > 2.5);
    const point = shopSignCentre(shopLot);
    expect(point.x).toBeCloseTo(16, 5);
    expect(point.y).toBeGreaterThan(board.min.y);
    expect(point.y).toBeLessThan(board.max.y);
    expect(point.z).toBeGreaterThan(board.max.z);
    expect(point.z).toBeLessThan(board.max.z + 0.05);
  });
});

describe('createHouse', () => {
  it('builds a named house whose roof ridge rises above its walls', () => {
    const house = createHouse(stubMaterials(), houseLot);
    expect(house.name).toBe('house');
    const walls = boundsOf(meshesWith(house, 'wallPeach')[0]);
    expect(walls.max.y).toBeCloseTo(6.0, 5);
    expect(walls.min.z).toBeCloseTo(74, 5);
    expect(walls.max.z).toBeCloseTo(83, 5);
    const roof = boundsOf(meshesWith(house, 'roofSlate')[0]);
    expect(roof.min.y).toBeCloseTo(6.0, 5);
    expect(roof.max.y).toBeCloseTo(8.4, 5);
    expect(roof.min.x).toBeCloseTo(-20, 5);
    expect(roof.max.x).toBeCloseTo(-8, 5);
  });

  it('puts the door and its step on the +z face', () => {
    const house = createHouse(stubMaterials(), houseLot);
    const door = boundsOf(meshesWith(house, 'woodDark')[0]);
    expect(door.min.z).toBeGreaterThanOrEqual(83 - 1e-6);
    const step = meshesWith(house, 'stone').map(boundsOf).filter((b) => b.max.y <= 0.2);
    expect(step).toHaveLength(1);
    expect(step[0].min.z).toBeGreaterThanOrEqual(83 - 1e-6);
  });

  it('gives each storey two front windows and two side windows', () => {
    const glass = meshesWith(createHouse(stubMaterials(), houseLot), 'glass').map(boundsOf);
    expect(glass.filter((b) => b.min.z >= 83 - 1e-6)).toHaveLength(4);
    expect(glass.filter((b) => b.max.x <= -19.9 + 1e-6)).toHaveLength(4);
  });

  it('adds a chimney, topping the planned height, only when the lot has one', () => {
    const withChimney = createHouse(stubMaterials(), houseLot);
    expect(meshesWith(withChimney, 'brick')).toHaveLength(1);
    expect(boundsOf(withChimney).max.y).toBeCloseTo(8.8, 5);
    const without = createHouse(stubMaterials(), { ...houseLot, chimney: false, height: 8.4 });
    expect(meshesWith(without, 'brick')).toHaveLength(0);
    expect(boundsOf(without).max.y).toBeCloseTo(8.4, 5);
  });

  it('aims the door centre just in front of the door', () => {
    const door = boundsOf(meshesWith(createHouse(stubMaterials(), houseLot), 'woodDark')[0]);
    const point = houseDoorCentre(houseLot);
    expect(point.x).toBeCloseTo(-14, 5);
    expect(point.y).toBeGreaterThan(door.min.y);
    expect(point.y).toBeLessThan(door.max.y);
    expect(point.z).toBeGreaterThan(door.max.z);
    expect(point.z).toBeLessThan(door.max.z + 0.05);
  });
});
