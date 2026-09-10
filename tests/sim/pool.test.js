import { describe, it, expect } from 'vitest';
import { createPool } from '../../src/sim/pool.js';

describe('createPool', () => {
  it('reports its size and starting availability', () => {
    const pool = createPool(['a', 'b', 'c']);
    expect(pool.size).toBe(3);
    expect(pool.available()).toBe(3);
  });

  it('never hands the same item to two callers', () => {
    const pool = createPool(['a', 'b', 'c']);
    const taken = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(new Set(taken).size).toBe(3);
  });

  it('returns null once exhausted', () => {
    const pool = createPool(['a']);
    expect(pool.acquire()).toBe('a');
    expect(pool.acquire()).toBeNull();
  });

  it('makes a released item available again', () => {
    const pool = createPool(['a', 'b']);
    const first = pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
    pool.release(first);
    expect(pool.available()).toBe(1);
    expect(pool.acquire()).toBe(first);
  });

  it('ignores releasing something it never handed out', () => {
    const pool = createPool(['a']);
    pool.release('zzz');
    expect(pool.available()).toBe(1);
  });

  it('ignores a double release', () => {
    const pool = createPool(['a', 'b']);
    const first = pool.acquire();
    pool.release(first);
    pool.release(first);
    expect(pool.available()).toBe(2);
  });
});
