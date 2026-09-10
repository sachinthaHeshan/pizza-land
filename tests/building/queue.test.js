import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createQueue } from '../../src/building/queue.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createQueue(stubMaterials(), layout);
const figures = group.children.filter((c) => c.name === 'figure');

describe('createQueue', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('queue');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds', () => {
    expectFinite(boundsOf(group));
  });

  it('builds only the cashier, leaving the queue to the simulation', () => {
    expect(figures).toHaveLength(1);
  });

  it('stands the cashier behind the counter', () => {
    const cashier = figures[0];
    expect(cashier.position.z).toBeLessThan(layout.counter.main.z[0]);
    expect(cashier.position.x).toBeGreaterThan(layout.counter.main.x[0]);
    expect(cashier.position.x).toBeLessThan(layout.counter.main.x[1]);
  });

  it('turns the cashier to face the customers', () => {
    expect(figures[0].rotation.y).toBeCloseTo(layout.queue.cashier.facing, 5);
  });

  it('ropes every stanchion to the next one', () => {
    const ropes = group.children.filter((c) => c.material && c.material.name === 'rope');
    expect(ropes).toHaveLength(layout.queue.barrier.posts.length - 1);
  });
});
