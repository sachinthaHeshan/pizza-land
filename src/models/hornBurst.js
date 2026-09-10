import * as THREE from 'three';

// Two small arcs above a vehicle's roof, pulsing outward. This is the part
// of a honk that works with the sound switched off.
export function createHornBurst(materials) {
  const group = new THREE.Group();
  group.name = 'hornBurst';
  group.visible = false;

  const arcs = [];
  for (const radius of [0.26, 0.42]) {
    const geometry = new THREE.RingGeometry(
      radius, radius + 0.07, 16, 1, Math.PI * 0.15, Math.PI * 0.7
    );
    const arc = new THREE.Mesh(geometry, materials.horn);
    arc.rotation.x = -Math.PI / 2.2;
    group.add(arc);
    arcs.push(arc);
  }

  group.userData.setPhase = (phase) => {
    arcs.forEach((arc, i) => {
      const pulse = 0.75 + 0.35 * Math.sin(phase + i * 0.7);
      arc.scale.set(pulse, pulse, pulse);
    });
  };
  group.userData.setPhase(0);

  return group;
}
