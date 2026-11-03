// mcp-video/lib/ease.mjs
//
// Pure functions of time. No state, no clocks: f(t) → value, so frame 600 renders
// the same no matter what was drawn before it. The spring is the closed-form
// damped step response from the Opus 5.5 motion lab article (zeta = damping ratio).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => clamp((t - a) / (b - a));

export const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
export const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const inOutCubic = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const inCubic = (x) => clamp(x) ** 3;

/** Damped spring step from 0 to 1. zeta 1 = no bounce; 0.7–0.85 = premium; f = natural Hz. */
export function spring(t, zeta = 0.85, f = 2.4) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * f;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

/** A spring that starts at absolute time t0. Returns 0 before t0. */
export const sp = (t, t0, zeta = 0.85, f = 2.4) => (t < t0 ? 0 : spring(t - t0, zeta, f));

/** Cubic Bézier point (1-D), used for the cable curves. */
export const bez = (p0, p1, p2, p3, u) => {
  const v = 1 - u;
  return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
};

/** Deterministic pseudo-random in [0,1) from an integer seed. Used for scatter, never Math.random. */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Piecewise camera keys: [t, scale, focusX, focusY]. Interpolated with inOutCubic per segment. */
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, sa, xa, ya] = keys[i];
    const [tb, sb, xb, yb] = keys[i + 1];
    if (t < tb) {
      const k = inOutCubic(prog(t, ta, tb));
      return [lerp(sa, sb, k), lerp(xa, xb, k), lerp(ya, yb, k)];
    }
  }
  return keys[keys.length - 1].slice(1);
}
