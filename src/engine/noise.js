// Azar determinista. El video se dibuja cuadro a cuadro, en cualquier orden y en varios procesos a la vez:
// Math.random() y Date están PROHIBIDOS en draw(). Todo lo "aleatorio" sale de acá, con semilla.

/** Generador con semilla (xorshift32 + mezcla). Usar al precomputar: const r = rng(7); r() ∈ [0,1). */
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 0x9e3779b9;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    let z = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0;
    z = (z ^ (z >>> 12)) >>> 0;
    return z / 4294967296;
  };
}

/** Hash entero de hasta 3 números → [0,1). Para decidir cosas por índice: hash(i, 3). */
export function hash(a, c = 0, d = 0) {
  let h = 2166136261 >>> 0;
  for (const v of [a, c, d]) {
    let x = Math.floor(v * 1000003) | 0;
    h = Math.imul(h ^ (x & 0xff), 16777619);
    h = Math.imul(h ^ ((x >>> 8) & 0xff), 16777619);
    h = Math.imul(h ^ ((x >>> 16) & 0xff), 16777619);
    h = Math.imul(h ^ (x >>> 24), 16777619);
  }
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Rango con hash: hr(i, seed, min, max). */
export const hr = (i, seed, a = 0, c = 1) => a + (c - a) * hash(i, seed);

const fade = (f) => f * f * f * (f * (f * 6 - 15) + 10);

/** Ruido de valor 1D suave en [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = fade(f);
  const a = hash(i, seed) * 2 - 1, c = hash(i + 1, seed) * 2 - 1;
  return a + (c - a) * u;
}

/** Ruido de valor 2D suave en [-1, 1]. */
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fade(fx), uy = fade(fy);
  const v00 = hash(ix, iy, seed), v10 = hash(ix + 1, iy, seed), v01 = hash(ix, iy + 1, seed), v11 = hash(ix + 1, iy + 1, seed);
  const a = v00 + (v10 - v00) * ux, c = v01 + (v11 - v01) * ux;
  return (a + (c - a) * uy) * 2 - 1;
}

/** Ruido fractal (fbm) 1D y 2D en ~[-1, 1]. */
export function fbm1(x, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * noise1(x * f, seed + o * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export function fbm2(x, y, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * noise2(x * f, y * f, seed + o * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/** Deriva orgánica 2D (cámara en mano, objetos flotando): devuelve [dx, dy] en px. */
export function drift(t, { amp = 6, hz = 0.35, seed = 1 } = {}) {
  return [amp * fbm1(t * hz, seed, 3), amp * fbm1(t * hz + 40, seed + 9, 3)];
}
