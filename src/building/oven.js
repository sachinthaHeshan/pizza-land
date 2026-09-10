import * as THREE from 'three';
import { box, archFrame, yOnFloor } from '../utils/geometry.js';

export function createOven(materials, layout) {
  const group = new THREE.Group();
  group.name = 'oven';
  const o = layout.oven;

  group.add(
    box(materials.brick, {
      x: o.base.x,
      y: yOnFloor(o.base.y, layout.floorContact),
      z: o.base.z,
    })
  );
  group.add(
    box(materials.stone, {
      x: [o.base.x[0] - 0.1, o.base.x[1] + 0.1],
      y: [o.cap[0], o.cap[1] - layout.surfaceEps],
      z: [o.base.z[0] - 0.1, o.base.z[1] + 0.1],
    })
  );

  const [dx, dy, dz] = o.dome.center;
  const domeY = dy + layout.surfaceEps;
  const domeGeometry = new THREE.SphereGeometry(o.dome.radius, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeometry, materials.brick);
  dome.position.set(dx, domeY, dz);
  dome.scale.y = o.dome.scaleY;
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  const m = o.mouth;
  group.add(
    archFrame(materials.stone, {
      width: m.width,
      height: m.height,
      depth: m.frameDepth,
      thickness: 0.16,
      center: [m.x, m.sill, dz],
    })
  );

  const recessGeometry = new THREE.CylinderGeometry(m.width / 2, m.width / 2, m.recess, 20, 1, false, 0, Math.PI);
  const recess = new THREE.Mesh(recessGeometry, materials.metalDark);
  recess.rotation.z = Math.PI / 2;
  recess.position.set(m.x + m.recess / 2, m.sill, dz);
  recess.castShadow = true;
  recess.receiveShadow = true;
  group.add(recess);

  const ember = box(materials.ember, {
    x: [m.x + m.recess - 0.06, m.x + m.recess - 0.02],
    y: [m.sill + 0.02, m.sill + 0.34],
    z: [dz - m.width / 2 + 0.1, dz + m.width / 2 - 0.1],
  });
  ember.renderOrder = 2;
  group.add(ember);

  const fire = layout.lighting.fire;
  const fireLight = new THREE.PointLight(fire.color, fire.intensity, fire.distance, fire.decay);
  fireLight.position.set(m.x + m.recess * 0.6, m.sill + 0.3, dz);
  fireLight.userData.baseIntensity = fire.intensity;
  group.add(fireLight);
  group.userData.fireLight = fireLight;

  const [cx, cz] = o.chimney.center;
  const half = o.chimney.size / 2;
  group.add(
    box(materials.brick, {
      x: [cx - half, cx + half],
      y: o.chimney.y,
      z: [cz - half, cz + half],
    })
  );

  const flueGeometry = new THREE.CylinderGeometry(
    o.flue.radius,
    o.flue.radius,
    o.flue.y[1] - o.flue.y[0],
    16
  );
  const flue = new THREE.Mesh(flueGeometry, materials.metalDark);
  flue.position.set(cx, (o.flue.y[0] + o.flue.y[1]) / 2, cz);
  flue.castShadow = true;
  group.add(flue);

  const capGeometry = new THREE.CylinderGeometry(o.flue.capRadius, o.flue.capRadius, 0.08, 16);
  const flueCap = new THREE.Mesh(capGeometry, materials.metalDark);
  flueCap.position.set(cx, o.flue.y[1] + 0.04, cz);
  flueCap.castShadow = true;
  group.add(flueCap);

  return group;
}
