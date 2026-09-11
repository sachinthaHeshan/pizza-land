import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createZoneMarker } from '../../src/models/zoneMarker.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const zone = layout.queue.sellZone;
const banner = layout.queue.sellBanner;
const outlineY = 1.14;
const centreX = (zone.x[0] + zone.x[1]) / 2;
const centreZ = (zone.z[0] + zone.z[1]) / 2;

function marker(materials = stubMaterials(), name = 'sellPoint') {
  return createZoneMarker(materials, {
    name,
    zone,
    outlineY,
    bannerMaterial: materials.sellBanner,
    banner,
  });
}

// Runs the animation and reports how far the beam's and outline's opacity swung.
function glowSwing(point, state, seconds = 2, dt = 1 / 60) {
  const beam = point.getObjectByName('zoneBeam').material;
  const dash = point.getObjectByName('zoneEdge').children[0].material;
  const beamSeen = [];
  const dashSeen = [];
  for (let t = 0; t < seconds; t += dt) {
    point.userData.update(dt, state);
    beamSeen.push(beam.opacity);
    dashSeen.push(dash.opacity);
  }
  const swing = (seen) => Math.max(...seen) - Math.min(...seen);
  return { beam: swing(beamSeen), outline: swing(dashSeen) };
}

describe('createZoneMarker', () => {
  it('returns a group with the requested name and finite bounds', () => {
    const point = marker(stubMaterials(), 'ovenPoint');
    expect(point).toBeInstanceOf(THREE.Group);
    expect(point.name).toBe('ovenPoint');
    expectFinite(boundsOf(point));
  });

  it('keeps every part at or above the outline height', () => {
    expect(boundsOf(marker()).min.y).toBeGreaterThanOrEqual(outlineY - 1e-6);
  });

  it('outlines exactly the zone at the outline height', () => {
    const bounds = boundsOf(marker().getObjectByName('zoneEdge'));
    expect(bounds.min.x).toBeCloseTo(zone.x[0], 5);
    expect(bounds.max.x).toBeCloseTo(zone.x[1], 5);
    expect(bounds.min.z).toBeCloseTo(zone.z[0], 5);
    expect(bounds.max.z).toBeCloseTo(zone.z[1], 5);
    expect(bounds.min.y).toBeCloseTo(outlineY, 5);
    expect(bounds.max.y).toBeLessThan(outlineY + 0.1);
  });

  it('dashes the outline rather than drawing a solid frame', () => {
    const dashes = marker().getObjectByName('zoneEdge').children;
    expect(dashes.length).toBeGreaterThan(4);
    for (const dash of dashes) {
      const b = boundsOf(dash);
      const onX = Math.abs(b.min.x - zone.x[0]) < 0.1 || Math.abs(b.max.x - zone.x[1]) < 0.1;
      const onZ = Math.abs(b.min.z - zone.z[0]) < 0.1 || Math.abs(b.max.z - zone.z[1]) < 0.1;
      expect(onX || onZ).toBe(true);
    }
  });

  it('floats an undistorted banner over the zone using the given material', () => {
    const materials = stubMaterials();
    const sprite = marker(materials).getObjectByName('zoneBanner');
    expect(sprite).toBeInstanceOf(THREE.Sprite);
    expect(sprite.material).toBe(materials.sellBanner);
    expect(sprite.position.x).toBeCloseTo(centreX, 5);
    expect(sprite.position.z).toBeCloseTo(centreZ, 5);
    expect(sprite.position.y).toBeCloseTo(banner.y, 5);
    // The SELL artwork is drawn on a 2:1 canvas.
    expect(sprite.scale.x / sprite.scale.y).toBeCloseTo(2, 5);
  });

  it('runs a beam of light from the outline up to the banner', () => {
    const point = marker();
    const beam = boundsOf(point.getObjectByName('zoneBeam'));
    expect(beam.min.y).toBeCloseTo(outlineY, 5);
    expect(beam.max.y).toBeCloseTo(banner.y - banner.height / 2, 5);
    expect(beam.min.x).toBeGreaterThanOrEqual(zone.x[0] - 1e-6);
    expect(beam.max.x).toBeLessThanOrEqual(zone.x[1] + 1e-6);
    expect(beam.min.z).toBeGreaterThanOrEqual(zone.z[0] - 1e-6);
    expect(beam.max.z).toBeLessThanOrEqual(zone.z[1] + 1e-6);
  });

  it('pulses the outline and beam only when asked', () => {
    const on = glowSwing(marker(), { pulse: true, showBanner: false });
    expect(on.beam).toBeGreaterThan(0.1);
    expect(on.outline).toBeGreaterThan(0.1);
    const off = glowSwing(marker(), { pulse: false, showBanner: true });
    expect(off.beam).toBeLessThan(1e-6);
    expect(off.outline).toBeLessThan(1e-6);
  });

  it('shows the banner only when asked, never hiding the outline or beam', () => {
    const point = marker();
    const sprite = point.getObjectByName('zoneBanner');
    const cases = [
      [{ pulse: true, showBanner: true }, true],
      [{ pulse: true, showBanner: false }, false],
      [{ pulse: false, showBanner: true }, true],
      [{ pulse: false, showBanner: false }, false],
    ];
    for (const [state, shown] of cases) {
      point.userData.update(1 / 60, state);
      const label = JSON.stringify(state);
      expect(sprite.visible, label).toBe(shown);
      expect(point.visible, label).toBe(true);
      expect(point.getObjectByName('zoneEdge').visible, label).toBe(true);
      expect(point.getObjectByName('zoneBeam').visible, label).toBe(true);
    }
  });

  it('never makes another marker pulse, even with shared materials', () => {
    const materials = stubMaterials();
    const pulsing = marker(materials, 'sellPoint');
    const still = marker(materials, 'ovenPoint');
    const seen = [];
    for (let t = 0; t < 2; t += 1 / 60) {
      pulsing.userData.update(1 / 60, { pulse: true, showBanner: true });
      still.userData.update(1 / 60, { pulse: false, showBanner: true });
      seen.push(still.getObjectByName('zoneBeam').material.opacity);
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeLessThan(1e-6);
    expect(materials.markerBeam.opacity).toBe(1);
  });

  it('bobs the banner gently without drifting off', () => {
    const point = marker();
    const sprite = point.getObjectByName('zoneBanner');
    const heights = [];
    for (let t = 0; t < 4; t += 1 / 60) {
      point.userData.update(1 / 60, { pulse: false, showBanner: true });
      heights.push(sprite.position.y);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.02);
    for (const y of heights) expect(Math.abs(y - banner.y)).toBeLessThan(0.2);
  });
});
