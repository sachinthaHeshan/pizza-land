import * as THREE from 'three';
import { box, wallRun, awning } from '../utils/geometry.js';

export function createStorefront(materials, layout) {
  const group = new THREE.Group();
  group.name = 'storefront';
  const s = layout.storefront;
  const t = s.thickness;

  // Brick plinth and header beam run the full facade.
  group.add(
    wallRun(materials.brick, {
      axis: 'x',
      at: s.z,
      span: s.x,
      y: s.plinth,
      thickness: t,
    })
  );
  group.add(
    wallRun(materials.greenPaint, {
      axis: 'x',
      at: s.z,
      span: s.x,
      y: s.header,
      thickness: t + 0.08,
    })
  );

  // Timber posts.
  const halfPost = s.postSize / 2;
  for (const px of s.posts) {
    group.add(
      box(materials.greenPaint, {
        x: [px - halfPost, px + halfPost],
        y: [0, s.header[1]],
        z: [s.z - t / 2 - 0.04, s.z + t / 2 + 0.04],
      })
    );
  }

  // Glazing between the posts, with a warm glow plane just inside.
  for (let i = 0; i < s.posts.length - 1; i++) {
    const bay = [s.posts[i] + halfPost, s.posts[i + 1] - halfPost];
    if (bay[1] - bay[0] <= 0.001) continue;

    const isDoor = bay[0] >= s.door.x[0] - 0.3 && bay[1] <= s.door.x[1] + 0.3;
    const glassBottom = isDoor ? 0.15 : s.glass[0];

    group.add(
      box(materials.glass, {
        x: bay,
        y: [glassBottom, s.glass[1]],
        z: [s.z - 0.03, s.z + 0.03],
      })
    );
    group.add(
      box(materials.glow, {
        x: [bay[0] + 0.06, bay[1] - 0.06],
        y: [glassBottom + 0.06, s.glass[1] - 0.06],
        z: [s.z - 0.12, s.z - 0.09],
      })
    );

    if (isDoor) {
      group.add(
        box(materials.greenPaint, {
          x: [bay[0] - 0.06, bay[0] + 0.06],
          y: [0, s.glass[1] + 0.12],
          z: [s.z - 0.09, s.z + 0.09],
        })
      );
      group.add(
        box(materials.greenPaint, {
          x: [bay[1] - 0.06, bay[1] + 0.06],
          y: [0, s.glass[1] + 0.12],
          z: [s.z - 0.09, s.z + 0.09],
        })
      );
    }
  }

  // Striped awning.
  group.add(
    awning(materials.stripe, {
      x: s.awning.x,
      wallZ: s.z + t / 2,
      wallY: s.awning.wallY,
      frontZ: s.awning.frontZ,
      frontY: s.awning.frontY,
      valance: s.awning.valance,
    })
  );

  // Arched signboard: a cream surround, a green board, and the pizza motif.
  group.add(
    box(materials.stone, {
      x: [s.sign.x[0] - 0.18, s.sign.x[1] + 0.18],
      y: [s.sign.y[0] - 0.12, s.sign.y[1] + 0.12],
      z: [s.z - s.sign.thickness / 2 - 0.06, s.z + s.sign.thickness / 2 + 0.06],
    })
  );

  // thetaStart PI/2 selects the half that lands *above* the board once the
  // cylinder axis is rotated onto Z; scale.z squashes the semicircle into the
  // shallow semi-ellipse the reference shows.
  const archRadius = (s.sign.x[1] - s.sign.x[0]) / 2 + 0.18;
  const archGeometry = new THREE.CylinderGeometry(
    archRadius,
    archRadius,
    s.sign.thickness + 0.12,
    32,
    1,
    false,
    Math.PI / 2,
    Math.PI
  );
  const arch = new THREE.Mesh(archGeometry, materials.stone);
  arch.rotation.x = Math.PI / 2;
  arch.scale.z = s.sign.archRise / archRadius;
  arch.position.set((s.sign.x[0] + s.sign.x[1]) / 2, s.sign.y[1] + 0.12, s.z);
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  group.add(
    box(materials.sign, {
      x: s.sign.x,
      y: s.sign.y,
      z: [s.z + s.sign.thickness / 2, s.z + s.sign.thickness / 2 + 0.04],
    })
  );

  // Gooseneck lamps: an arm, a shade, and an anchor for the light rig.
  const anchors = [];
  for (const lx of s.lamps.xs) {
    group.add(
      box(materials.metalDark, {
        x: [lx - 0.03, lx + 0.03],
        y: [s.lamps.y, s.lamps.y + 0.26],
        z: [s.z, s.z + s.lamps.reach],
      })
    );

    const shadeGeometry = new THREE.ConeGeometry(s.lamps.shadeRadius, 0.24, 16, 1, true);
    const shade = new THREE.Mesh(shadeGeometry, materials.lampShade);
    shade.position.set(lx, s.lamps.y - 0.06, s.z + s.lamps.reach);
    shade.castShadow = true;
    group.add(shade);

    anchors.push(new THREE.Vector3(lx, s.lamps.y - 0.22, s.z + s.lamps.reach));
  }
  group.userData.lampAnchors = anchors;

  return group;
}
