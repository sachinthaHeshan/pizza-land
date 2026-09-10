import { describe, it, expect } from 'vitest';
import { buildLanes } from '../../src/sim/lanes.js';
import { layout } from '../../src/layout.js';

const lanes = buildLanes(layout);

describe('buildLanes', () => {
  it('builds one lane record per configured lane', () => {
    expect(lanes).toHaveLength(layout.ground.lanes.length);
    lanes.forEach((lane, i) => expect(lane.index).toBe(i));
  });

  it('spawns each lane behind its despawn, along its direction', () => {
    for (const lane of lanes) {
      const travelled = (lane.despawnX - lane.spawnX) * lane.direction;
      expect(travelled, `lane ${lane.index}`).toBeGreaterThan(0);
    }
  });

  it('sends opposing directions in from opposite ends', () => {
    const west = lanes.filter((l) => l.direction === -1);
    const east = lanes.filter((l) => l.direction === 1);
    for (const lane of west) expect(lane.spawnX).toBeGreaterThan(0);
    for (const lane of east) expect(lane.spawnX).toBeLessThan(0);
  });

  it('pairs each lane with an adjacent lane going the same way', () => {
    for (const lane of lanes) {
      expect(lane.neighbour).not.toBeNull();
      const other = lanes[lane.neighbour];
      expect(other.direction).toBe(lane.direction);
      expect(Math.abs(other.index - lane.index)).toBe(1);
    }
  });

  it('takes lane centres straight from the ground layout', () => {
    lanes.forEach((lane, i) => expect(lane.z).toBe(layout.ground.lanes[i].z));
  });
});
