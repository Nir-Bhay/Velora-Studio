// shiva-ganesha-video/lib/ease.mjs — pure functions of time. No state.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** Progress of t through [a, b], clamped to 0..1. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const outCubic = (p) => 1 - Math.pow(1 - clamp(p), 3);
export const inCubic = (p) => Math.pow(clamp(p), 3);
export const inOutCubic = (p) => {
  p = clamp(p);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
export const outBack = (p, s = 1.6) => {
  p = clamp(p) - 1;
  return 1 + (s + 1) * p * p * p + s * p * p;
};
/** Closed-form damped spring from 0 to 1 over normalised progress p (0..1+). Small overshoot. */
export const spring = (p) => {
  p = clamp(p, 0, 2);
  return 1 - Math.exp(-6 * p) * Math.cos(9.5 * p);
};
/** Spring started at time t0 with duration d (seconds). */
export const sp = (t, t0, d = 0.6) => (t < t0 ? 0 : spring((t - t0) / d));
/** Stepped (on-twos) hold: quantise t to steps per second. Gives the cut-paper stop-motion feel. */
export const steps = (t, rate) => Math.floor(t * rate) / rate;
/** Smooth value through keyframes [[t, v], ...] with inOutCubic per segment. */
export const keyed = (t, keys) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, inOutCubic((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
};
/** Deterministic hash in [0, 1). Same n gives the same value on every run. */
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
