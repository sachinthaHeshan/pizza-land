// The whole car-following model, as one pure function. Keeping it free of
// state is what makes the "no two vehicles overlap" invariant testable
// exhaustively rather than by observation.
export function safeSpeed({ gap, leaderSpeed, cruise, minGap, headway }) {
  if (!Number.isFinite(gap)) return cruise;
  if (gap <= minGap) return 0;

  const desiredGap = minGap + cruise * headway;
  if (gap >= desiredGap) return cruise;

  const t = (gap - minGap) / (desiredGap - minGap);
  return Math.max(0, Math.min(cruise, leaderSpeed * (1 - t) + cruise * t));
}
