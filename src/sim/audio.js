// Sampled car horn. Browsers refuse to start an AudioContext
// outside a user gesture, so nothing is built until enable() is called from
// a click — and with no factory at all (the Node tests) every call is inert.
export function createHorn(contextFactory, { sampleUrl, fetch: fetchFn = globalThis.fetch } = {}) {
  let context = null;
  let buffer = null;

  function loadSample() {
    if (!sampleUrl || typeof fetchFn !== 'function') return;
    Promise.resolve()
      .then(() => fetchFn(sampleUrl))
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch(() => {
        // A missing sample or a closed context must never break the render loop.
      });
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
        loadSample();
      } catch {
        context = null;
      }
    },

    play() {
      if (!context || !buffer) return;
      try {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.setValueAtTime(0.45, context.currentTime);
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
      } catch {
        // A closed or interrupted context must never break the render loop.
      }
    },
  };
}
