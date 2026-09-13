import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDiningTable } from '../../src/models/diningTable.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.dining.tables[0];
const d = layout.dining;
const table = createDiningTable(stubMaterials(), layout, spec);

describe('createDiningTable', () => {
  it('returns a named group with finite bounds', () => {
    expect(table).toBeInstanceOf(THREE.Group);
    expect(table.name).toBe('diningTable');
    expectFinite(boundsOf(table));
  });

  it('stands on the dining floor', () => {
    expect(boundsOf(table).min.y).toBeCloseTo(layout.ground.diningFloor.y, 5);
  });

  it('puts the top surface at the height the layout asks for', () => {
    const tops = [];
    table.traverse((o) => {
      if (o.isMesh && o.name === 'tableTop') tops.push(boundsOf(o));
    });
    expect(tops).toHaveLength(1);
    expect(tops[0].max.y).toBeCloseTo(d.top.height + d.top.thickness, 5);
    expect(tops[0].max.x - tops[0].min.x).toBeCloseTo(d.top.size, 5);
    expect(tops[0].max.z - tops[0].min.z).toBeCloseTo(d.top.size, 5);
  });

  it('centres the table on its layout spot', () => {
    const bounds = boundsOf(table);
    const centre = bounds.getCenter(new THREE.Vector3());
    expect(centre.x).toBeCloseTo(spec.x, 5);
    expect(centre.z).toBeCloseTo(spec.z, 5);
  });

  it('sets two chairs facing each other across the table', () => {
    const chairs = table.children.filter((child) => child.name === 'chair');
    expect(chairs).toHaveLength(d.seatsPerTable);
    const zs = chairs.map((chair) => boundsOf(chair).getCenter(new THREE.Vector3()).z).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(spec.z - d.chair.offset, 1);
    expect(zs[1]).toBeCloseTo(spec.z + d.chair.offset, 1);
  });

  it('keeps every chair back on the far side from the table', () => {
    for (const chair of table.children.filter((c) => c.name === 'chair')) {
      const backs = [];
      chair.traverse((o) => {
        if (o.isMesh && o.name === 'chairBack') backs.push(boundsOf(o));
      });
      expect(backs).toHaveLength(1);
      const chairZ = boundsOf(chair).getCenter(new THREE.Vector3()).z;
      const backZ = backs[0].getCenter(new THREE.Vector3()).z;
      // The back is further from the table centre than the seat is.
      expect(Math.abs(backZ - spec.z)).toBeGreaterThan(Math.abs(chairZ - spec.z));
      expect(backs[0].max.y).toBeCloseTo(d.chair.backHeight, 5);
    }
  });

  it('casts and receives shadows from every part', () => {
    table.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.castShadow, o.name).toBe(true);
      expect(o.receiveShadow, o.name).toBe(true);
    });
  });
});
