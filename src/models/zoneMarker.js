import * as THREE from 'three';
import { box } from '../utils/geometry.js';

const PULSE_SPEED = 6;
const BOB_SPEED = 2.2;
const DASH_HEIGHT = 0.04;

// Dash rectangles along each edge of the zone, with their outer edge on the
// zone boundary. The side runs are inset so corners are not drawn twice.
function dashedOutline(zone, { dash = 0.2, gap = 0.12, width = 0.06 } = {}) {
  const dashes = [];
  const along = (from, to, place) => {
    for (let s = from; s < to - 1e-6; s += dash + gap) {
      place([s, Math.min(s + dash, to)]);
    }
  };
  const [x0, x1] = zone.x;
  const [z0, z1] = zone.z;
  along(x0, x1, (x) => {
    dashes.push({ x, z: [z0, z0 + width] });
    dashes.push({ x, z: [z1 - width, z1] });
  });
  along(z0 + width, z1 - width, (z) => {
    dashes.push({ x: [x0, x0 + width], z });
    dashes.push({ x: [x1 - width, x1], z });
  });
  return dashes;
}

// A "go here" marker for a zone: a glowing dashed outline, a beam of light
// rising from it, and a banner that always faces the camera. The caller
// decides when it pulses and when the banner shows. Pulsing changes material
// opacity, so each marker clones its glow materials rather than sharing them.
export function createZoneMarker(materials, {
  name,
  zone,
  outlineY,
  bannerMaterial,
  banner: spec,
  // Where the banner floats. Defaults to the zone's own centre; the dining
  // tables override it so each banner sits over its table instead of over
  // the patch of floor you stand on, which also keeps neighbouring banners
  // from overlapping on screen.
  bannerCentre,
}) {
  const group = new THREE.Group();
  group.name = name;

  const centreX = (zone.x[0] + zone.x[1]) / 2;
  const centreZ = (zone.z[0] + zone.z[1]) / 2;
  const beamMaterial = materials.markerBeam.clone();
  const edgeMaterial = materials.markerEdge.clone();

  const edge = new THREE.Group();
  edge.name = 'zoneEdge';
  for (const dash of dashedOutline(zone)) {
    const mesh = box(edgeMaterial, { ...dash, y: [outlineY, outlineY + DASH_HEIGHT] });
    mesh.castShadow = false;
    mesh.renderOrder = 2;
    edge.add(mesh);
  }
  group.add(edge);

  const beamHeight = spec.y - spec.height / 2 - outlineY;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(zone.x[1] - zone.x[0], beamHeight, zone.z[1] - zone.z[0]),
    beamMaterial
  );
  beam.name = 'zoneBeam';
  beam.position.set(centreX, outlineY + beamHeight / 2, centreZ);
  beam.renderOrder = 1;
  group.add(beam);

  const banner = new THREE.Sprite(bannerMaterial);
  banner.name = 'zoneBanner';
  banner.scale.set(spec.width, spec.height, 1);
  banner.position.set(bannerCentre?.x ?? centreX, spec.y, bannerCentre?.z ?? centreZ);
  banner.renderOrder = 3;
  group.add(banner);

  const beamOpacity = beamMaterial.opacity;
  const edgeOpacity = edgeMaterial.opacity;
  let time = 0;

  group.userData.update = (dt, { pulse, showBanner }) => {
    time += dt;
    banner.visible = showBanner;
    banner.position.y = spec.y + Math.sin(time * BOB_SPEED) * spec.bob;
    const glow = pulse ? 0.4 + 0.9 * (0.5 + 0.5 * Math.sin(time * PULSE_SPEED)) : 1;
    beamMaterial.opacity = Math.min(1, beamOpacity * glow);
    edgeMaterial.opacity = Math.min(1, edgeOpacity * glow);
  };

  return group;
}
