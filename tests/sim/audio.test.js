import { describe, it, expect, vi } from 'vitest';
import { createHorn } from '../../src/sim/audio.js';

function fakeContext() {
  const gain = {
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const source = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  };
  return {
    currentTime: 0,
    destination: {},
    state: 'running',
    resume: vi.fn(),
    createGain: vi.fn(() => gain),
    createBufferSource: vi.fn(() => source),
    decodeAudioData: vi.fn(async (data) => ({ data })),
    source,
  };
}

function fakeFetch(bytes = new ArrayBuffer(8)) {
  return vi.fn(async () => ({
    arrayBuffer: async () => bytes,
  }));
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

  it('plays the loaded sample once per honk', async () => {
    const context = fakeContext();
    const decoded = { duration: 1 };
    context.decodeAudioData = vi.fn(async () => decoded);
    const fetchFn = fakeFetch();
    const horn = createHorn(() => context, { sampleUrl: '/horn.mp3', fetch: fetchFn });
    horn.enable();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
    horn.play();
    expect(fetchFn).toHaveBeenCalledWith('/horn.mp3');
    expect(context.createBufferSource).toHaveBeenCalledTimes(1);
    expect(context.source.buffer).toBe(decoded);
    expect(context.source.start).toHaveBeenCalledTimes(1);
  });

  it('stays silent until the sample has loaded', () => {
    const context = fakeContext();
    context.decodeAudioData = vi.fn(() => new Promise(() => {}));
    const horn = createHorn(() => context, { sampleUrl: '/horn.mp3', fetch: fakeFetch() });
    horn.enable();
    expect(() => horn.play()).not.toThrow();
    expect(context.createBufferSource).not.toHaveBeenCalled();
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
