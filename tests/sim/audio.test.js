import { describe, it, expect, vi } from 'vitest';
import { createHorn } from '../../src/sim/audio.js';

function fakeContext() {
  const gain = {
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const osc = {
    frequency: { value: 0, setValueAtTime: vi.fn() },
    type: '',
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    currentTime: 0,
    destination: {},
    state: 'running',
    resume: vi.fn(),
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => osc),
  };
}

describe('createHorn', () => {
  it('is a no-op with no audio context factory', () => {
    const horn = createHorn();
    expect(horn.enabled).toBe(false);
    expect(() => horn.play()).not.toThrow();
    expect(() => horn.enable()).not.toThrow();
    expect(horn.enabled).toBe(false);
  });

  it('builds no context until enabled', () => {
    const factory = vi.fn(fakeContext);
    const horn = createHorn(factory);
    horn.play();
    expect(factory).not.toHaveBeenCalled();
    expect(horn.enabled).toBe(false);
  });

  it('builds exactly one context, however often it is enabled', () => {
    const factory = vi.fn(fakeContext);
    const horn = createHorn(factory);
    horn.enable();
    horn.enable();
    horn.enable();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(horn.enabled).toBe(true);
  });

  it('sounds two tones per honk once enabled', () => {
    const context = fakeContext();
    const horn = createHorn(() => context);
    horn.enable();
    horn.play();
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('survives a context factory that throws', () => {
    const horn = createHorn(() => {
      throw new Error('blocked');
    });
    expect(() => horn.enable()).not.toThrow();
    expect(horn.enabled).toBe(false);
    expect(() => horn.play()).not.toThrow();
  });
});
