// A tiny reservation pool. Parking bays are held while an agent is invisible,
// so there is nothing to scan for ownership; routing them through this is what
// guarantees no two agents claim one.
export function createPool(items) {
  const all = [...items];
  const taken = new Set();

  return {
    size: all.length,

    available() {
      return all.length - taken.size;
    },

    acquire() {
      for (const item of all) {
        if (!taken.has(item)) {
          taken.add(item);
          return item;
        }
      }
      return null;
    },

    release(item) {
      taken.delete(item);
    },
  };
}
