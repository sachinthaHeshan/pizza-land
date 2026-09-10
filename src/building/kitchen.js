import * as THREE from 'three';
import { box, wallRun } from '../utils/geometry.js';

function stainlessRun(materials, { x, z, height, lip, shelfY }) {
  const parts = [];

  parts.push(
    box(materials.metal, {
      x: [x[0] + 0.04, x[1] - 0.04],
      y: [0.12, height - 0.06],
      z: [z[0] + 0.04, z[1] - 0.04],
    })
  );
  parts.push(box(materials.metal, { x, y: [height - 0.06, height], z }));
  parts.push(
    box(materials.metal, {
      x,
      y: [height, height + lip],
      z: [z[0], z[0] + 0.06],
    })
  );
  parts.push(
    box(materials.metal, {
      x: [x[0] + 0.1, x[1] - 0.1],
      y: [shelfY, shelfY + 0.05],
      z: [z[0] + 0.1, z[1] - 0.1],
    })
  );

  return parts;
}

export function createKitchen(materials, layout) {
  const group = new THREE.Group();
  group.name = 'kitchen';
  const k = layout.kitchen;

  group.add(
    wallRun(materials.wallTile, {
      axis: 'x',
      at: k.tileWall.z + k.tileWall.thickness,
      span: k.tileWall.x,
      y: k.tileWall.y,
      thickness: k.tileWall.thickness,
    })
  );

  for (const part of stainlessRun(materials, {
    x: k.backCounter.x,
    z: k.backCounter.z,
    height: k.backCounter.height,
    lip: k.backCounter.lip,
    shelfY: k.backCounter.shelfY,
  })) {
    group.add(part);
  }

  for (const part of stainlessRun(materials, {
    x: k.island.x,
    z: k.island.z,
    height: k.island.height,
    lip: 0.03,
    shelfY: k.island.shelfY,
  })) {
    group.add(part);
  }

  const shelf = k.wallShelf;
  group.add(
    box(materials.metal, {
      x: shelf.x,
      y: [shelf.y, shelf.y + shelf.thickness],
      z: [shelf.z, shelf.z + shelf.depth],
    })
  );
  group.add(
    box(materials.metalDark, {
      x: shelf.x,
      y: [shelf.railY, shelf.railY + 0.04],
      z: [shelf.z + shelf.depth - 0.08, shelf.z + shelf.depth - 0.04],
    })
  );

  return group;
}
