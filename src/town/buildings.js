import * as THREE from 'three';
import { box, awning } from '../utils/geometry.js';

// Shops and houses for the far-side town, built straight into world space
// from a planTown lot. Every front faces +z: the fixed camera never sees a
// face that points −z.

const INSET = 0.1; // walls stop short of the lot edge so neighbours don't z-fight
const PROUD = 0.06; // glass sits this far out from a wall
const FLOOR = 0.01; // matches layout.floorContact

const SIGN_Y = 3.35;
const SIGN_FRONT = 0.14;
const STEP_TOP = 0.15;
const DOOR_HEIGHT = 2.1;
const DOOR_DEPTH = 0.08;

// A window on the +z face: a stone frame with a glass pane just proud of it.
function frontWindow(group, materials, x, y, faceZ) {
  group.add(box(materials.stone, { x: [x - 0.75, x + 0.75], y: [y - 0.65, y + 0.65], z: [faceZ, faceZ + 0.04] }));
  group.add(box(materials.glass, { x: [x - 0.6, x + 0.6], y: [y - 0.5, y + 0.5], z: [faceZ + 0.04, faceZ + PROUD] }));
}

// A window on the −x face.
function sideWindow(group, materials, z, y, faceX) {
  group.add(box(materials.stone, { x: [faceX - 0.04, faceX], y: [y - 0.65, y + 0.65], z: [z - 0.75, z + 0.75] }));
  group.add(box(materials.glass, { x: [faceX - PROUD, faceX - 0.04], y: [y - 0.5, y + 0.5], z: [z - 0.6, z + 0.6] }));
}

// A pitched roof with its ridge along x: a triangle extruded across the lot.
function pitchedRoof(material, { x, z, y, rise }) {
  const depth = z[1] - z[0];
  const shape = new THREE.Shape([
    new THREE.Vector2(-depth / 2, 0),
    new THREE.Vector2(depth / 2, 0),
    new THREE.Vector2(0, rise),
  ]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: x[1] - x[0], bevelEnabled: false });
  // The triangle is drawn in XY and extruded along +Z. A quarter turn about Y
  // runs the extrusion along +X, so the ridge runs along the row.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x[0], y, (z[0] + z[1]) / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'roof';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function shopSignCentre(lot) {
  return new THREE.Vector3((lot.x[0] + lot.x[1]) / 2, SIGN_Y, lot.z[1] + SIGN_FRONT + 0.01);
}

export function houseDoorCentre(lot) {
  return new THREE.Vector3((lot.x[0] + lot.x[1]) / 2, STEP_TOP + DOOR_HEIGHT / 2, lot.z[1] + DOOR_DEPTH + 0.01);
}

export function createShop(materials, lot) {
  const group = new THREE.Group();
  group.name = 'shop';
  const [x0, x1] = lot.x;
  const [zBack, zFront] = lot.z;
  const cx = (x0 + x1) / 2;
  const wallX = [x0 + INSET, x1 - INSET];

  group.add(box(materials[lot.wall], { x: wallX, y: [FLOOR, lot.walls], z: [zBack, zFront] }));
  // Parapet: a stone cap standing slightly proud of the roof edge.
  group.add(
    box(materials.stone, {
      x: [wallX[0] - 0.05, wallX[1] + 0.05],
      y: [lot.walls, lot.height],
      z: [zBack - 0.05, zFront + 0.05],
    })
  );

  // Ground-floor glass front and a door, on the face the camera sees.
  group.add(box(materials.glass, { x: [x0 + 0.8, x1 - 0.8], y: [0.4, 2.6], z: [zFront, zFront + PROUD] }));
  group.add(
    box(materials.woodDark, {
      x: [cx - 0.55, cx + 0.55],
      y: [FLOOR, DOOR_HEIGHT],
      z: [zFront + PROUD, zFront + PROUD + 0.04],
    })
  );

  group.add(
    awning(materials[lot.awning], {
      x: [x0 + 0.6, x1 - 0.6],
      wallZ: zFront,
      wallY: 3.0,
      frontZ: zFront + 1.4,
      frontY: 2.6,
      valance: 0.25,
    })
  );

  // Signboard with a stone border, above the awning.
  group.add(box(materials.stone, { x: [cx - 2.3, cx + 2.3], y: [SIGN_Y - 0.4, SIGN_Y + 0.4], z: [zFront, zFront + 0.08] }));
  group.add(
    box(materials[lot.sign], {
      x: [cx - 2.2, cx + 2.2],
      y: [SIGN_Y - 0.3, SIGN_Y + 0.3],
      z: [zFront + 0.08, zFront + SIGN_FRONT],
    })
  );

  if (lot.storeys === 2) {
    for (let wx = x0 + 2; wx <= x1 - 2 + 1e-9; wx += 2.8) frontWindow(group, materials, wx, 4.9, zFront);
    for (let wz = zBack + 2; wz <= zFront - 2 + 1e-9; wz += 2.5) sideWindow(group, materials, wz, 4.9, wallX[0]);
  }

  return group;
}

export function createHouse(materials, lot) {
  const group = new THREE.Group();
  group.name = 'house';
  const [x0, x1] = lot.x;
  const [zBack, zFront] = lot.z;
  const cx = (x0 + x1) / 2;
  const zMid = (zBack + zFront) / 2;
  const wallX = [x0 + INSET, x1 - INSET];

  group.add(box(materials[lot.wall], { x: wallX, y: [FLOOR, lot.walls], z: [zBack, zFront] }));
  // The roof overhangs front and back but stays within the lot's width, so
  // neighbouring roofs never overlap.
  group.add(pitchedRoof(materials[lot.roof], { x: [x0, x1], z: [zBack - 0.3, zFront + 0.3], y: lot.walls, rise: lot.rise }));

  // Front door on a step, on the face the camera sees.
  group.add(box(materials.stone, { x: [cx - 0.8, cx + 0.8], y: [FLOOR, STEP_TOP], z: [zFront, zFront + 0.5] }));
  group.add(
    box(materials.woodDark, {
      x: [cx - 0.5, cx + 0.5],
      y: [STEP_TOP, STEP_TOP + DOOR_HEIGHT],
      z: [zFront, zFront + DOOR_DEPTH],
    })
  );

  for (let storey = 0; storey < lot.storeys; storey++) {
    const wy = 1.6 + storey * 3.0;
    for (const wx of [cx - 2.6, cx + 2.6]) frontWindow(group, materials, wx, wy, zFront);
    for (const wz of [zMid - 2, zMid + 2]) sideWindow(group, materials, wz, wy, wallX[0]);
  }

  if (lot.chimney) {
    // Starts inside the roof and pokes above the ridge to the lot's height.
    group.add(
      box(materials.brick, {
        x: [x1 - 2.2, x1 - 1.6],
        y: [lot.walls + lot.rise * 0.4, lot.height],
        z: [zMid - 1.0, zMid - 0.4],
      })
    );
  }

  return group;
}
