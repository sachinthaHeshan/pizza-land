import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// main.js is the one module with no unit coverage: it needs a WebGL context,
// so nothing else can catch it silently losing a wire. These are source-level
// assertions, deliberately narrow — they exist because a stray
// `git checkout HEAD -- src/main.js` once reverted the render loop and every
// other test stayed green while the scene sat frozen.
const source = readFileSync(
  fileURLToPath(new URL('../src/main.js', import.meta.url)),
  'utf8'
);
const html = readFileSync(
  fileURLToPath(new URL('../index.html', import.meta.url)),
  'utf8'
);

describe('main.js render loop', () => {
  it('advances the simulation every frame', () => {
    expect(source).toMatch(/simulation\.update\(/);
  });

  it('advances it with a real frame delta, not a constant', () => {
    expect(source).toMatch(/clock\.getDelta\(\)/);
    expect(source).toMatch(/simulation\.update\(\s*delta\s*\*\s*simSpeed\s*,\s*keys\s*\)/);
  });

  it('steers the cashier with WASD', () => {
    expect(source).toMatch(/keys\.add\(/);
    expect(source).toMatch(/keys\.delete\(/);
    expect(source).toMatch(/addEventListener\(['"]keyup['"]/);
    expect(source).toMatch(/['"]wasd['"]\.includes\(k\)|['"]wasd['"]\.includes\(key\)/);
  });

  it('lets a HUD button cycle the simulation through 1x, 2x, and 5x', () => {
    expect(source).toMatch(/import \{ nextSimSpeed, labelSimSpeed \} from ["']\.\/sim\/speed\.js["']/);
    expect(source).toMatch(/document\.getElementById\(['"]speed['"]\)/);
    expect(source).toMatch(/speedButton\.addEventListener\('click'/);
    expect(source).toMatch(/simSpeed = nextSimSpeed\(simSpeed\)/);
    expect(source).toMatch(/speedButton\.textContent = labelSimSpeed\(simSpeed\)/);
  });

  it('paints the money balance onto a top-right HUD label each frame', () => {
    expect(html).toMatch(/id="balance"/);
    expect(html).toMatch(/#balance[\s\S]*top:\s*16px/);
    expect(html).toMatch(/#balance[\s\S]*right:\s*16px/);
    expect(source).toMatch(/document\.getElementById\(['"]balance['"]\)/);
    expect(source).toMatch(/balanceLabel\.textContent/);
    expect(source).toMatch(/simulation\.balance/);
  });

  it('clamps the delta so a backgrounded tab cannot fast-forward the cycle', () => {
    expect(source).toMatch(/Math\.min\(\s*clock\.getDelta\(\)/);
  });

  it('keeps driving the orbit controls and the oven flicker', () => {
    expect(source).toMatch(/controls\.update\(\)/);
    expect(source).toMatch(/fireLight\.intensity/);
  });

  it('locks the isometric angle and limits zoom while allowing pan', () => {
    expect(source).toMatch(/controls\.enableRotate\s*=\s*false/);
    expect(source).toMatch(/controls\.enablePan\s*=\s*true/);
    expect(source).toMatch(/controls\.minZoom\s*=\s*c\.minZoom/);
    expect(source).toMatch(/controls\.maxZoom\s*=\s*c\.maxZoom/);
    expect(source).toMatch(/THREE\.MOUSE\.PAN/);
  });

  it('clamps panning to the ground envelope', () => {
    expect(source).toMatch(/import \{ panTargetLimits, clampPanTarget \} from ["']\.\/ui\/panBounds\.js["']/);
    expect(source).toMatch(/clampPan\(\)/);
    expect(source).toMatch(/layout\.envelopes\.ground/);
    expect(source).toMatch(/controls\.screenSpacePanning\s*=\s*false/);
  });

  it('renders and schedules the next frame', () => {
    expect(source).toMatch(/renderer\.render\(scene, camera\)/);
    expect(source).toMatch(/requestAnimationFrame\(animate\)/);
  });

  it('builds the horn lazily behind a click', () => {
    // The import, not just the call: matching `createHorn(` alone passes even
    // when the import is missing, which is exactly how a ReferenceError once
    // reached the browser with this suite green.
    expect(source).toMatch(/import \{ createHorn \} from ["']\.\/sim\/audio\.js["']/);
    expect(source).toMatch(/createHorn\(/);
    expect(source).toMatch(/soundButton\.addEventListener\('click'/);
    expect(source).toMatch(/horn\.enable\(\)/);
  });

  it('hands the horn to the scene', () => {
    expect(source).toMatch(/createShop\(materials, layout, \{ horn \}\)/);
  });
});
