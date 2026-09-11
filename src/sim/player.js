import { createFigure } from '../models/figure.js';
import { playerObstacles, slideMove, PLAYER_RADIUS } from './obstacles.js';

const EMPTY_KEYS = new Set();

export function createPlayer(materials, layout) {
  const spec = layout.queue.cashier;
  const figure = createFigure(materials, { ...spec, facing: spec.facing });
  figure.name = 'cashier';

  const speed = layout.sim.speeds.walk;
  const stride = layout.sim.stride;
  const ground = layout.envelopes.ground;
  const obstacles = playerObstacles(layout);
  const [dirX, , dirZ] = layout.camera.direction;
  const len = Math.hypot(dirX, dirZ);
  const forwardX = -dirX / len;
  const forwardZ = -dirZ / len;
  const rightX = -forwardZ;
  const rightZ = forwardX;

  let stridePhase = 0;

  function animateLegs(dt, moving) {
    const limbs = figure.userData.limbs;
    if (moving) {
      stridePhase += dt * stride.frequency;
      const swing = Math.sin(stridePhase) * stride.amplitude;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * stride.armScale;
      limbs.armR.rotation.x = swing * stride.armScale;
    } else {
      for (const limb of Object.values(limbs)) {
        limb.rotation.x *= Math.max(0, 1 - dt * 8);
      }
    }
  }

  return {
    figure,

    update(dt, keys = EMPTY_KEYS) {
      let x = 0;
      let z = 0;
      if (keys.has('w')) {
        x += forwardX;
        z += forwardZ;
      }
      if (keys.has('s')) {
        x -= forwardX;
        z -= forwardZ;
      }
      if (keys.has('d')) {
        x += rightX;
        z += rightZ;
      }
      if (keys.has('a')) {
        x -= rightX;
        z -= rightZ;
      }

      const moving = Math.hypot(x, z) > 1e-6;
      if (moving) {
        const inv = 1 / Math.hypot(x, z);
        x *= inv;
        z *= inv;
        const next = slideMove(
          figure.position.x,
          figure.position.z,
          x * speed * dt,
          z * speed * dt,
          PLAYER_RADIUS,
          obstacles
        );
        figure.position.x = Math.min(
          ground.max[0],
          Math.max(ground.min[0], next.x)
        );
        figure.position.z = Math.min(
          ground.max[2],
          Math.max(ground.min[2], next.z)
        );
        figure.rotation.y = Math.atan2(x, z);
      }
      animateLegs(dt, moving);
    },
  };
}
