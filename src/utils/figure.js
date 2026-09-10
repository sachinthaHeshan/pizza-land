import * as THREE from 'three';
import { box } from './geometry.js';

// A stylised low-poly person, built from boxes to match the reference art's
// chunky cartoon proportions. Everything is expressed as a fraction of the
// figure's total height, so adults and children come from the same code.
//
// The figure is built facing +Z and stands with its feet at y = 0; the caller
// positions it on the plaza and rotates it to face the counter.
const P = {
  shoeTop: 0.05,
  shoeDepth: 0.19,
  shoeWidth: 0.13,
  legTop: 0.45,
  legWidth: 0.11,
  legDepth: 0.13,
  legSpread: 0.07,
  torsoBottom: 0.44,
  torsoTop: 0.73,
  shoulder: 0.3,
  bodyDepth: 0.17,
  armTop: 0.72,
  armBottom: 0.47,
  armWidth: 0.075,
  armDepth: 0.11,
  headBottom: 0.73,
  headTop: 0.9,
  headWidth: 0.19,
  headDepth: 0.18,
  hairTop: 0.92,
  hairBottom: 0.86,
  capTop: 0.93,
  brimDepth: 0.1,
};

export function createFigure(materials, spec) {
  const {
    x = 0,
    z = 0,
    height: h,
    facing = 0,
    cloth,
    hair,
    skin = 'skin',
    cap = false,
    longHair = false,
  } = spec;

  const group = new THREE.Group();
  group.name = 'figure';
  const u = (fraction) => fraction * h;
  const clothMat = materials[cloth];
  const hairMat = materials[hair];
  const skinMat = materials[skin];

  const legHalf = u(P.legWidth) / 2;
  const legDepthHalf = u(P.legDepth) / 2;
  for (const side of [-1, 1]) {
    const cx = side * u(P.legSpread);
    group.add(
      box(materials.denim, {
        x: [cx - legHalf, cx + legHalf],
        y: [u(P.shoeTop), u(P.legTop)],
        z: [-legDepthHalf, legDepthHalf],
      })
    );
    const shoeHalf = u(P.shoeWidth) / 2;
    group.add(
      box(materials.shoe, {
        x: [cx - shoeHalf, cx + shoeHalf],
        y: [0, u(P.shoeTop)],
        z: [-legDepthHalf, -legDepthHalf + u(P.shoeDepth)],
      })
    );
  }

  const shoulderHalf = u(P.shoulder) / 2;
  const bodyHalf = u(P.bodyDepth) / 2;
  group.add(
    box(clothMat, {
      x: [-shoulderHalf, shoulderHalf],
      y: [u(P.torsoBottom), u(P.torsoTop)],
      z: [-bodyHalf, bodyHalf],
    })
  );

  const armHalf = u(P.armWidth) / 2;
  const armDepthHalf = u(P.armDepth) / 2;
  for (const side of [-1, 1]) {
    const cx = side * (shoulderHalf + armHalf);
    group.add(
      box(clothMat, {
        x: [cx - armHalf, cx + armHalf],
        y: [u(P.armBottom), u(P.armTop)],
        z: [-armDepthHalf, armDepthHalf],
      })
    );
  }

  const headHalf = u(P.headWidth) / 2;
  const headDepthHalf = u(P.headDepth) / 2;
  group.add(
    box(skinMat, {
      x: [-headHalf, headHalf],
      y: [u(P.headBottom), u(P.headTop)],
      z: [-headDepthHalf, headDepthHalf],
    })
  );

  if (cap) {
    group.add(
      box(clothMat, {
        x: [-headHalf - 0.005, headHalf + 0.005],
        y: [u(P.hairBottom), u(P.capTop)],
        z: [-headDepthHalf, headDepthHalf],
      })
    );
    // Brim points the way the figure faces.
    group.add(
      box(clothMat, {
        x: [-headHalf * 0.9, headHalf * 0.9],
        y: [u(P.hairBottom), u(P.hairBottom) + u(0.018)],
        z: [headDepthHalf, headDepthHalf + u(P.brimDepth)],
      })
    );
  } else {
    group.add(
      box(hairMat, {
        x: [-headHalf - 0.005, headHalf + 0.005],
        y: [u(P.hairBottom), u(P.hairTop)],
        z: [-headDepthHalf - 0.005, headDepthHalf + 0.005],
      })
    );
    if (longHair) {
      group.add(
        box(hairMat, {
          x: [-headHalf - 0.005, headHalf + 0.005],
          y: [u(0.6), u(P.hairBottom)],
          z: [-headDepthHalf - 0.02, -headDepthHalf + u(0.05)],
        })
      );
    }
  }

  group.position.set(x, 0, z);
  group.rotation.y = facing;

  return group;
}
