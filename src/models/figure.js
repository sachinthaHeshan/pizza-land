import * as THREE from 'three';
import { box } from '../utils/geometry.js';

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
  // Keeps stacked head parts from sharing a face in the depth buffer.
  partGap: 0.004,
  shellOutset: 0.003,
};

// The arm's shoulder height and hanging length as fractions of the figure's
// height, for anything that must line up with the hands (the carried stack).
export const ARM_PROPORTIONS = Object.freeze({
  shoulder: P.armTop,
  length: P.armTop - P.armBottom,
});

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

  // Limbs hang below a pivot placed at the hip or shoulder, so the simulation
  // can swing them from the joint rather than about their own centres.
  const limbs = {};

  const legHalf = u(P.legWidth) / 2;
  const legDepthHalf = u(P.legDepth) / 2;
  const hipY = u(P.legTop);
  for (const [key, side] of [['legR', -1], ['legL', 1]]) {
    const pivot = new THREE.Group();
    pivot.name = key;
    pivot.position.set(side * u(P.legSpread), hipY, 0);

    pivot.add(
      box(materials.denim, {
        x: [-legHalf, legHalf],
        y: [u(P.shoeTop) - hipY, 0],
        z: [-legDepthHalf, legDepthHalf],
      })
    );

    const shoeHalf = u(P.shoeWidth) / 2;
    pivot.add(
      box(materials.shoe, {
        x: [-shoeHalf, shoeHalf],
        y: [-hipY, u(P.shoeTop) - hipY],
        z: [-legDepthHalf, -legDepthHalf + u(P.shoeDepth)],
      })
    );

    group.add(pivot);
    limbs[key] = pivot;
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
  const shoulderY = u(P.armTop);
  for (const [key, side] of [['armR', -1], ['armL', 1]]) {
    const pivot = new THREE.Group();
    pivot.name = key;
    pivot.position.set(side * (shoulderHalf + armHalf), shoulderY, 0);

    pivot.add(
      box(clothMat, {
        x: [-armHalf, armHalf],
        y: [u(P.armBottom) - shoulderY, 0],
        z: [-armDepthHalf, armDepthHalf],
      })
    );

    group.add(pivot);
    limbs[key] = pivot;
  }

  const headHalf = u(P.headWidth) / 2;
  const headDepthHalf = u(P.headDepth) / 2;
  const partGap = u(P.partGap);
  const shell = u(P.shellOutset);
  // Skin stops below the cap or hair; those sit slightly proud so they do not
  // z-fight with the face block.
  const skinTop = u(P.hairBottom) - partGap;
  group.add(
    box(skinMat, {
      x: [-headHalf, headHalf],
      y: [u(P.headBottom) + partGap, skinTop],
      z: [-headDepthHalf, headDepthHalf],
    })
  );

  if (cap) {
    group.add(
      box(clothMat, {
        x: [-headHalf - shell, headHalf + shell],
        y: [u(P.hairBottom), u(P.capTop)],
        z: [-headDepthHalf - shell, headDepthHalf + shell],
      })
    );
    // Brim points the way the figure faces.
    group.add(
      box(clothMat, {
        x: [-headHalf * 0.9, headHalf * 0.9],
        y: [u(P.hairBottom), u(P.hairBottom) + u(0.018)],
        z: [headDepthHalf + partGap, headDepthHalf + u(P.brimDepth)],
      })
    );
  } else {
    group.add(
      box(hairMat, {
        x: [-headHalf - shell, headHalf + shell],
        y: [u(P.hairBottom), u(P.hairTop)],
        z: [-headDepthHalf - shell, headDepthHalf + shell],
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

  group.userData.limbs = limbs;
  group.position.set(x, 0, z);
  group.rotation.y = facing;

  return group;
}
