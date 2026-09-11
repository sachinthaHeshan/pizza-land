import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaStack } from '../../src/models/pizzaStack.js';
import { layout } from '../../src/layout.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const { carryMax, carriedBox } = layout.sim.pizza;
const shown = (stack) => stack.children.filter((box) => box.visible);

describe('createPizzaStack', () => {
  it('returns a named group that starts empty', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    expect(stack).toBeInstanceOf(THREE.Group);
    expect(stack.name).toBe('pizzaStack');
    expect(shown(stack)).toHaveLength(0);
  });

  it('shows exactly as many boxes as it is told, up to the carry limit', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    for (const n of [0, 1, 4, 10]) {
      stack.userData.setCount(n);
      expect(shown(stack), `count ${n}`).toHaveLength(n);
    }
    stack.userData.setCount(carryMax + 3);
    expect(shown(stack)).toHaveLength(carryMax);
  });

  it('stacks the boxes upward without gaps', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    stack.userData.setCount(carryMax);
    const boxes = shown(stack)
      .map((box) => boundsOf(box))
      .sort((a, b) => a.min.y - b.min.y);
    expect(boxes[0].min.y).toBeCloseTo(0, 5);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].min.y).toBeCloseTo(boxes[i - 1].max.y, 5);
    }
    expect(boxes[boxes.length - 1].max.y).toBeCloseTo(carryMax * carriedBox.thickness, 5);
  });

  it('reports the world position of a slot, following the stack as it moves', () => {
    const stack = createPizzaStack(stubMaterials(), layout);
    const parent = new THREE.Group();
    parent.add(stack);
    parent.position.set(2, 1, -3);
    const slot = stack.userData.slotPosition(2, new THREE.Vector3());
    expect(slot.x).toBeCloseTo(2, 5);
    expect(slot.y).toBeCloseTo(1 + 2.5 * carriedBox.thickness, 5);
    expect(slot.z).toBeCloseTo(-3, 5);
  });
});
