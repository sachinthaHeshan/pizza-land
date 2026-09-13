import * as THREE from 'three';
import { box } from '../utils/geometry.js';

const LEG = 0.05; // chair and table leg thickness

function part(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// One chair, standing on the floor with its back on the side away from the
// table. `side` is +1 for the chair at +z, -1 for the one at -z.
function createChair(materials, layout, { x, z, side }) {
  const c = layout.dining.chair;
  const floor = layout.ground.diningFloor.y;
  const group = new THREE.Group();
  group.name = 'chair';
  const half = c.size / 2;
  const seatTop = c.seatHeight + c.seatThickness;

  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      const lx = x + dx * (half - LEG / 2);
      const lz = z + dz * (half - LEG / 2);
      group.add(
        part(
          box(materials.metalDark, {
            x: [lx - LEG / 2, lx + LEG / 2],
            y: [floor, c.seatHeight],
            z: [lz - LEG / 2, lz + LEG / 2],
          }),
          'chairLeg'
        )
      );
    }
  }

  group.add(
    part(
      box(materials.woodDark, {
        x: [x - half, x + half],
        y: [c.seatHeight, seatTop],
        z: [z - half, z + half],
      }),
      'chairSeat'
    )
  );

  // The back sits on the outer edge, so a diner facing the table leans away
  // from it rather than into it.
  const backZ = z + side * half;
  group.add(
    part(
      box(materials.woodDark, {
        x: [x - half, x + half],
        y: [seatTop, c.backHeight],
        z: [Math.min(backZ - side * LEG, backZ), Math.max(backZ - side * LEG, backZ)],
      }),
      'chairBack'
    )
  );

  return group;
}

// A dining table on a central pedestal, with a chair on each side along z.
// Dark wood on purpose: the dining floor is the same `wood` plank material,
// so a `wood` tabletop dissolves into it at this camera's zoom.
// Pure furniture: the pizza that lands on it belongs to the simulation.
export function createDiningTable(materials, layout, { x, z }) {
  const d = layout.dining;
  const floor = layout.ground.diningFloor.y;
  const group = new THREE.Group();
  group.name = 'diningTable';
  const half = d.top.size / 2;

  const foot = part(
    new THREE.Mesh(
      new THREE.CylinderGeometry(d.pedestal.footRadius, d.pedestal.footRadius, d.pedestal.footHeight, 12),
      materials.metalDark
    ),
    'tableFoot'
  );
  foot.position.set(x, floor + d.pedestal.footHeight / 2, z);
  group.add(foot);

  const postBottom = floor + d.pedestal.footHeight;
  const postHeight = d.top.height - postBottom;
  const post = part(
    new THREE.Mesh(
      new THREE.CylinderGeometry(d.pedestal.radius, d.pedestal.radius, postHeight, 12),
      materials.metalDark
    ),
    'tablePost'
  );
  post.position.set(x, postBottom + postHeight / 2, z);
  group.add(post);

  group.add(
    part(
      box(materials.woodDark, {
        x: [x - half, x + half],
        y: [d.top.height, d.top.height + d.top.thickness],
        z: [z - half, z + half],
      }),
      'tableTop'
    )
  );

  // Exactly two chairs, one either side along z, to match the two seats
  // `src/sim/paths.js` places at +offset and -offset. `dining.seatsPerTable`
  // is not a free knob: raising it without adding chair positions here would
  // seat a third diner on top of seat 1's chair.
  for (const side of [1, -1]) {
    group.add(createChair(materials, layout, { x, z: z + side * d.chair.offset, side }));
  }

  return group;
}
