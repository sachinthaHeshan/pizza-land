// A synthesised two-tone horn. Browsers refuse to start an AudioContext
// outside a user gesture, so nothing is built until enable() is called from
// a click — and with no factory at all (the Node tests) every call is inert.
export function createHorn(contextFactory) {
  let context = null;

  function tone(frequency, startAt, duration) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  return {
    get enabled() {
      return context !== null;
    },

    enable() {
      if (context || !contextFactory) return;
      try {
        context = contextFactory();
        if (context.state === 'suspended') context.resume();
      } catch {
        context = null;
      }
    },

    play() {
      if (!context) return;
      try {
        const now = context.currentTime;
        tone(440, now, 0.16);
        tone(330, now + 0.18, 0.2);
      } catch {
        // A closed or interrupted context must never break the render loop.
      }
    },
  };
}
