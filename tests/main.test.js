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

describe('main.js render loop', () => {
  it('advances the simulation every frame', () => {
    expect(source).toMatch(/simulation\.update\(/);
  });

  it('advances it with a real frame delta, not a constant', () => {
    expect(source).toMatch(/clock\.getDelta\(\)/);
    expect(source).toMatch(/simulation\.update\(\s*delta\s*\)/);
  });

  it('clamps the delta so a backgrounded tab cannot fast-forward the cycle', () => {
    expect(source).toMatch(/Math\.min\(\s*clock\.getDelta\(\)/);
  });

  it('keeps driving the orbit controls and the oven flicker', () => {
    expect(source).toMatch(/controls\.update\(\)/);
    expect(source).toMatch(/fireLight\.intensity/);
  });

  it('renders and schedules the next frame', () => {
    expect(source).toMatch(/renderer\.render\(scene, camera\)/);
    expect(source).toMatch(/requestAnimationFrame\(animate\)/);
  });
});
