import { describe, it, expect } from 'vitest';
import { DEFAULT_SIM_SPEED, nextSimSpeed, labelSimSpeed } from '../../src/sim/speed.js';

describe('DEFAULT_SIM_SPEED', () => {
  it('starts the simulation at 3x', () => {
    expect(DEFAULT_SIM_SPEED).toBe(3);
  });
});

describe('nextSimSpeed', () => {
  it('cycles 1 → 2 → 3 → 5 → 1', () => {
    expect(nextSimSpeed(1)).toBe(2);
    expect(nextSimSpeed(2)).toBe(3);
    expect(nextSimSpeed(3)).toBe(5);
    expect(nextSimSpeed(5)).toBe(1);
  });
});

describe('labelSimSpeed', () => {
  it('shows the multiplier with an x suffix', () => {
    expect(labelSimSpeed(1)).toBe('1x');
    expect(labelSimSpeed(2)).toBe('2x');
    expect(labelSimSpeed(3)).toBe('3x');
    expect(labelSimSpeed(5)).toBe('5x');
  });
});
