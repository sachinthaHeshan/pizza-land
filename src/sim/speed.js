const SPEEDS = [1, 2, 5];

export function nextSimSpeed(current) {
  const i = SPEEDS.indexOf(current);
  return SPEEDS[(i + 1) % SPEEDS.length];
}

export function labelSimSpeed(speed) {
  return `${speed}x`;
}
