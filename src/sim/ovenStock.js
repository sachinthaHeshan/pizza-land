// The oven's side of the pizza economy: it bakes on its own up to capacity
// and hands pizzas to a player standing in its pickup zone. Plain numbers
// only, so the rules step deterministically in tests.
export function createOvenStock(layout) {
  const { bakeSeconds, ovenCapacity, pickupSeconds } = layout.sim.pizza;
  let stock = 0;
  let bake = 0;
  let cooldown = 0;

  return {
    get stock() {
      return stock;
    },

    // Returns how many pizzas left the oven this step (0 or 1).
    update(dt, { inZone, room }) {
      if (stock < ovenCapacity) {
        bake += dt;
        if (bake >= bakeSeconds) {
          stock++;
          bake -= bakeSeconds;
        }
      }
      // A full oven holds its timer at zero, so the pizza after one is taken
      // needs a whole bake.
      if (stock >= ovenCapacity) bake = 0;

      if (!inZone) {
        cooldown = 0;
        return 0;
      }
      cooldown -= dt;
      if (cooldown > 0 || stock < 1 || room < 1) return 0;
      stock--;
      cooldown = pickupSeconds;
      return 1;
    },
  };
}
