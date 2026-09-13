import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createTextures } from "./textures.js";
import { createMaterials } from "./materials.js";
import { createShop } from "./scene.js";
import { followSun } from "./lighting.js";
import { layout } from "./layout.js";
import { createHorn } from "./sim/audio.js";
import hornSampleUrl from "./asserts/audio/double-car-honk.mp3";
import { DEFAULT_SIM_SPEED, nextSimSpeed, labelSimSpeed } from "./sim/speed.js";
import { panTargetLimits, clampPanTarget } from "./ui/panBounds.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe0f5);

// Metals need something to reflect. Without an environment the stainless
// counters render as flat black rather than brushed steel.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
pmrem.dispose();

const textures = createTextures();
for (const texture of Object.values(textures)) {
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
}
const materials = createMaterials(textures);
const horn = createHorn(() => new (window.AudioContext || window.webkitAudioContext)(), {
  sampleUrl: hornSampleUrl,
});
const shop = createShop(materials, layout, { horn });
scene.add(shop);

const c = layout.camera;
const target = new THREE.Vector3(...c.target);
const offset = new THREE.Vector3(...c.direction)
  .normalize()
  .multiplyScalar(c.distance);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
camera.position.copy(target).add(offset);
camera.lookAt(target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = false;
controls.enablePan = true;
controls.enableZoom = true;
controls.minZoom = c.minZoom;
controls.maxZoom = c.maxZoom;
// Pan in the ground plane. Screen-space panning follows camera-up, which
// lifts the target off the map so the top/bottom limits never engage.
controls.screenSpacePanning = false;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.touches = {
  ONE: THREE.TOUCH.PAN,
  TWO: THREE.TOUCH.DOLLY_PAN,
};
controls.target.copy(target);

function clampPan() {
  // Restore height before measuring the ground intersection. A leftover
  // screen-space pan would otherwise tilt the unprojected parallelogram.
  const dy = target.y - controls.target.y;
  if (dy !== 0) {
    controls.target.y = target.y;
    camera.position.y += dy;
  }
  const limits = panTargetLimits({
    camera,
    target: controls.target,
    bounds: layout.envelopes.ground,
    padding: c.panPadding ?? 0,
    preferred: { x: target.x, y: target.y, z: target.z },
  });
  clampPanTarget(controls.target, camera.position, limits);
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const half = c.frustumSize / 2;
  camera.left = -half * aspect;
  camera.right = half * aspect;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  clampPan();
}
resize();
window.addEventListener("resize", resize);

function resetView() {
  // With damping on, OrbitControls decays its residual momentum multiplicatively
  // and never reaches zero, so a reset issued after a fling gets dragged back off
  // target. Running update with damping off takes the branch that zeroes the
  // internal delta, making the reset land exactly.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  // Flush first: this update applies whatever momentum is left and then zeroes
  // it. Repositioning before the flush would let that momentum kick the camera
  // straight back off target.
  controls.update();
  camera.position.copy(target).add(offset);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  clampPan();
  controls.update();
  controls.enableDamping = damping;
}
const keys = new Set();
window.addEventListener("keydown", (event) => {
  const k = event.key.toLowerCase();
  if (k === "r") resetView();
  if ("wasd".includes(k)) {
    keys.add(k);
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

// Browsers refuse to start audio outside a user gesture, so the horn stays
// silent until this is clicked. The visual burst plays regardless.
const soundButton = document.getElementById('sound');
soundButton.addEventListener('click', () => {
  horn.enable();
  soundButton.hidden = true;
});

let simSpeed = DEFAULT_SIM_SPEED;
const speedButton = document.getElementById('speed');
speedButton.textContent = labelSimSpeed(simSpeed);
speedButton.addEventListener('click', () => {
  simSpeed = nextSimSpeed(simSpeed);
  speedButton.textContent = labelSimSpeed(simSpeed);
});

const balanceLabel = document.getElementById('balance');

const fireLight = shop.userData.fireLight;
const baseIntensity = fireLight.userData.baseIntensity;
const clock = new THREE.Clock();

function animate() {
  // Clamped so a backgrounded tab does not fast-forward the whole simulation
  // on its next frame. The cost is that below ~20fps the cycle runs in slow
  // motion rather than skipping ahead, which is the safer failure.
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  fireLight.intensity =
    baseIntensity * (0.86 + 0.14 * Math.sin(t * 9.3) * Math.sin(t * 3.1));
  shop.userData.simulation.update(delta * simSpeed, keys);
  balanceLabel.textContent = `$${shop.userData.simulation.balance}`;
  controls.update();
  clampPan();
  followSun(shop.userData.sun, controls.target, layout);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
