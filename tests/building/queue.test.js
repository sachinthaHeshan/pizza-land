import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createQueue } from '../../src/building/queue.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createQueue(stubMaterials(), layout);
const figures = group.children.filter((c) => c.name === 'figure');

describe('createQueue', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('queue');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.queue);
  });

  it('builds one figure per person in the layout', () => {
    expect(figures).toHaveLength(layout.queue.people.length);
  });

  it('turns every figure to face the counter', () => {
    for (const figure of figures) {
      expect(figure.rotation.y).toBeCloseTo(layout.queue.facing, 5);
    }
  });

  it('stands everyone on the plaza, not floating or sunk', () => {
    for (const figure of figures) {
      const bounds = boundsOf(figure);
      expect(bounds.min.y).toBeCloseTo(0, 3);
    }
  });

  it('queues everyone on the customer side of the counter', () => {
    for (const person of layout.queue.people) {
      expect(person.z).toBeGreaterThan(layout.counter.main.z[1]);
    }
  });

  it('keeps the whole queue on the paved plaza', () => {
    const plaza = layout.ground.plaza.find((r) => r.x[0] === -3);
    for (const person of layout.queue.people) {
      expect(person.x).toBeGreaterThan(plaza.x[0]);
      expect(person.x).toBeLessThan(plaza.x[1]);
      expect(person.z).toBeGreaterThan(plaza.z[0]);
      expect(person.z).toBeLessThan(plaza.z[1]);
    }
  });

  it('ropes every stanchion to the next one', () => {
    const ropes = group.children.filter((c) => c.material && c.material.name === 'rope');
    expect(ropes).toHaveLength(layout.queue.barrier.posts.length - 1);
  });

  it('gives every stanchion a post and a weighted base', () => {
    const posts = group.children.filter((c) => c.material && c.material.name === 'metalDark');
    expect(posts.length).toBe(layout.queue.barrier.posts.length * 2);
  });
});
