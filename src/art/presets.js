// Presets de luz del kit de ART: cielo, sol, nubes, luz de las superficies y mar, coherentes entre sí.
// Nombres: 'day' | 'golden' | 'sunset' | 'dusk' | 'night'. Todo componente acepta `preset` como nombre
// o como objeto ya mezclado (mixPreset) para animar la luz (ej. el sol que baja en `sunset`).
import { PAL, mixHex } from '../engine/color.js';

/**
 * SKY_PRESETS[name] = {
 *   stops: [[pos, color]…]  degradé del cenit (0) al horizonte (1)
 *   glow, glowA             resplandor del cielo alrededor del sol
 *   haze, hazeA             bruma del horizonte
 *   rays, raysA             rayos suaves de sol (god rays)
 *   stars                   0..1 estrellas
 *   streak                  color de las nubecitas finas del horizonte
 *   sun: { core, disc, edge, glow, ray, flare, ghost }
 *   cloud: { base, shadow, rim, deep }
 *   light: { dir:[x,y] (hacia la luz), key, rim, shade, ambient, ambientA, white, whiteShade, lights }
 * }
 */
export const SKY_PRESETS = {
  day: {
    stops: [[0, PAL.ocean600], [0.42, PAL.ocean400], [0.78, PAL.aqua200], [1, '#EEFBFD']],
    glow: PAL.goldPale, glowA: 0.45,
    haze: PAL.foam, hazeA: 0.55,
    rays: PAL.warmWhite, raysA: 0.07,
    stars: 0,
    streak: '#E6F8FC',
    sun: { core: '#FFFFFF', disc: '#FFF6DC', edge: PAL.goldLight, glow: PAL.goldPale, ray: PAL.warmWhite, flare: PAL.goldLight, ghost: '#9FE7FF' },
    cloud: { base: '#F2FAFD', shadow: '#BCDDEC', rim: '#FFFFFF', deep: '#97C6DC' },
    light: { dir: [0.62, -0.78], key: '#FFF4DA', rim: '#FFFFFF', shade: '#9DB9CF', ambient: PAL.ocean600, ambientA: 0.06, white: '#F8FBFC', whiteShade: '#BFD2E0', lights: 0 },
  },
  golden: {
    stops: [[0, PAL.ocean600], [0.36, '#3AB2D6'], [0.68, '#A6DCE4'], [0.86, PAL.goldPale], [1, PAL.goldLight]],
    glow: PAL.goldLight, glowA: 0.55,
    haze: PAL.goldPale, haze2: PAL.peach, hazeA: 0.6,
    rays: PAL.goldPale, raysA: 0.09,
    stars: 0,
    streak: '#FFF1D6',
    sun: { core: '#FFFFFF', disc: '#FFF0C4', edge: PAL.gold, glow: PAL.goldLight, ray: PAL.goldPale, flare: PAL.gold, ghost: '#8FE0FF' },
    cloud: { base: '#FFF3E2', shadow: '#A7C7DD', rim: '#FFDFA0', deep: '#7FA9C9' },
    light: { dir: [0.76, -0.64], key: '#FFE3A8', rim: PAL.goldLight, shade: '#93A9C8', ambient: PAL.gold, ambientA: 0.07, white: '#FFF7EA', whiteShade: '#AFC0D8', lights: 0 },
  },
  sunset: {
    stops: [[0, '#2B2C66'], [0.28, PAL.dusk], [0.52, PAL.sunsetPink], [0.74, PAL.coral], [0.9, PAL.gold], [1, PAL.goldLight]],
    glow: PAL.gold, glowA: 0.6,
    haze: PAL.peach, haze2: PAL.coralLight, hazeA: 0.55,
    rays: PAL.goldLight, raysA: 0.1,
    stars: 0.08,
    streak: '#FFB59A',
    sun: { core: '#FFF8EE', disc: PAL.goldPale, edge: PAL.coralLight, glow: PAL.gold, ray: PAL.goldLight, flare: PAL.gold, ghost: '#FF9DB4' },
    cloud: { base: '#EE7E95', shadow: '#5B3F8C', rim: PAL.goldLight, deep: '#3D2D6E' },
    light: { dir: [0.95, -0.3], key: PAL.goldLight, rim: PAL.goldLight, shade: '#7A5C9E', ambient: PAL.dusk, ambientA: 0.22, white: '#FBD9C6', whiteShade: '#8C6CA6', lights: 0.8 },
  },
  dusk: {
    stops: [[0, PAL.navy900], [0.34, '#1D2C60'], [0.6, PAL.dusk], [0.84, PAL.sunsetPink], [1, PAL.coralLight]],
    glow: PAL.coralLight, glowA: 0.4,
    haze: PAL.sunsetPink, haze2: PAL.peach, hazeA: 0.4,
    rays: PAL.peach, raysA: 0.05,
    stars: 0.55,
    streak: '#C98AB0',
    sun: { core: '#FFF1E0', disc: PAL.peach, edge: PAL.coral, glow: PAL.coralLight, ray: PAL.peach, flare: PAL.coralLight, ghost: '#C9A0FF' },
    cloud: { base: '#4B3B7C', shadow: '#231C4A', rim: PAL.coralLight, deep: '#181437' },
    light: { dir: [0.9, -0.12], key: PAL.coralLight, rim: PAL.coralLight, shade: '#3A3466', ambient: PAL.dusk, ambientA: 0.35, white: '#B9AACB', whiteShade: '#4C4479', lights: 1 },
  },
  night: {
    stops: [[0, PAL.ink], [0.45, PAL.navy800], [0.82, PAL.navy600], [1, PAL.navy500]],
    glow: PAL.aqua200, glowA: 0.18,
    haze: PAL.ocean700, hazeA: 0.4,
    rays: PAL.aqua100, raysA: 0.03,
    stars: 1,
    streak: '#2A4F7A',
    sun: { core: '#FFFFFF', disc: PAL.foam, edge: PAL.aqua200, glow: PAL.aqua200, ray: PAL.aqua100, flare: PAL.aqua200, ghost: '#7FD3FF' },
    cloud: { base: '#1F3B60', shadow: PAL.navy800, rim: PAL.aqua200, deep: PAL.navy900 },
    light: { dir: [0.55, -0.83], key: PAL.aqua100, rim: PAL.aqua200, shade: '#1E3352', ambient: PAL.navy700, ambientA: 0.45, white: '#8EA2BC', whiteShade: '#2E405E', lights: 1 },
  },
};

/**
 * SEA_PRESETS[name] = {
 *   far, mid, near, deep   tonos del mar del horizonte (far) al primer plano (deep)
 *   lit                    cara iluminada de cada banda (se mezcla con el tono de la fila)
 *   trough                 sombra plana entre olas
 *   line, lineA            líneas de brillo sobre las crestas
 *   foam                   espuma
 *   glitter, glow          destellos y columna de luz del sol
 *   horizonLine            filo de luz en el horizonte
 *   reflect                tinte del reflejo del barco
 * }
 */
export const SEA_PRESETS = {
  day: {
    far: '#7ED3E6', mid: PAL.ocean500, near: PAL.ocean700, deep: PAL.navy600,
    lit: PAL.ocean400, trough: PAL.navy700,
    line: PAL.aqua100, lineA: 0.75, foam: PAL.foam,
    glitter: '#FFFFFF', glow: PAL.warmWhite, glowA: 0.28,
    horizonLine: '#F3FDFF', reflect: PAL.navy700,
  },
  golden: {
    far: '#A9D9D6', mid: '#1E9BC6', near: PAL.ocean700, deep: PAL.navy600,
    lit: '#4FC0DD', trough: PAL.navy700,
    line: PAL.goldPale, lineA: 0.8, foam: PAL.warmWhite,
    glitter: '#FFF4D6', glow: PAL.goldLight, glowA: 0.42,
    horizonLine: PAL.goldPale, reflect: PAL.navy700,
  },
  sunset: {
    far: '#F59A84', mid: '#B4568A', near: '#3C3374', deep: '#1B2050',
    lit: '#D96E8E', trough: '#16183F',
    line: PAL.goldLight, lineA: 0.85, foam: PAL.peach,
    glitter: PAL.goldPale, glow: PAL.gold, glowA: 0.5,
    horizonLine: PAL.goldLight, reflect: '#1B1A45',
  },
  dusk: {
    far: '#C06B92', mid: '#4C3C7E', near: '#1D2452', deep: '#0C1634',
    lit: '#6E4F96', trough: '#0A1029',
    line: PAL.peach, lineA: 0.6, foam: '#D9B8D6',
    glitter: PAL.peach, glow: PAL.coralLight, glowA: 0.32,
    horizonLine: PAL.peach, reflect: '#0C1634',
  },
  night: {
    far: '#1E4F80', mid: PAL.navy700, near: PAL.navy800, deep: PAL.navy900,
    lit: PAL.navy600, trough: PAL.ink,
    line: PAL.aqua200, lineA: 0.45, foam: '#9CC3DA',
    glitter: PAL.foam, glow: PAL.aqua200, glowA: 0.2,
    horizonLine: PAL.ocean500, reflect: PAL.ink,
  },
};

export const PRESET_NAMES = Object.keys(SKY_PRESETS);

// ------------------------------------------------------------------ mezcla de presets
const isHex = (v) => typeof v === 'string' && v[0] === '#';

// mezcla «viva» en HSL (tono por el camino corto): de turquesa a coral no pasa por el gris
function toHsl(hex) {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh * 60, s, l];
}
function fromHsl(hh, s, l) {
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function mixVivid(a, c, p) {
  if (p <= 0) return a;
  if (p >= 1) return c;
  const [h1, s1, l1] = toHsl(a), [h2, s2, l2] = toHsl(c);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  // si uno de los dos es casi gris, su tono no cuenta
  const hh = s1 < 0.08 ? h2 : s2 < 0.08 ? h1 : (h1 + dh * p + 360) % 360;
  const rgbMix = mixHex(a, c, p);
  const viv = fromHsl(hh, s1 + (s2 - s1) * p, l1 + (l2 - l1) * p);
  return mixHex(rgbMix, viv, 0.38);
}
function mixDeep(a, c, p) {
  if (typeof a === 'number' && typeof c === 'number') return a + (c - a) * p;
  if (isHex(a) && isHex(c)) return mixVivid(a, c, p);
  if (Array.isArray(a) && Array.isArray(c)) {
    // stops de degradé con distinta cantidad: se remuestrean
    if (a.length && Array.isArray(a[0])) return mixStops(a, c, p);
    return a.map((x, i) => mixDeep(x, c[i] ?? x, p));
  }
  if (a && typeof a === 'object' && c && typeof c === 'object') {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(c)])) {
      o[k] = k in a && k in c ? mixDeep(a[k], c[k], p) : (a[k] ?? c[k]);
    }
    return o;
  }
  return p < 0.5 ? a : c;
}
function stopAt(stops, x) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [x0, c0] = stops[i - 1], [x1, c1] = stops[i];
      return mixHex(c0, c1, (x - x0) / (x1 - x0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
function mixStops(a, c, p) {
  const xs = [...new Set([...a.map((s) => s[0]), ...c.map((s) => s[0])])].sort((m, n) => m - n);
  return xs.map((x) => [x, mixVivid(stopAt(a, x), stopAt(c, x), p)]);
}

const mixCache = new Map();
/**
 * Preset intermedio entre dos nombres (o objetos) en p 0..1 → { sky, sea }.
 * Se cuantiza a 1/128 y se cachea: se puede llamar en cada cuadro.
 */
export function mixPreset(a, c, p) {
  const q = Math.round(Math.min(1, Math.max(0, p)) * 128) / 128;
  if (typeof a === 'string' && typeof c === 'string') {
    const key = `${a}|${c}|${q}`;
    let v = mixCache.get(key);
    if (!v) {
      v = { sky: mixDeep(SKY_PRESETS[a], SKY_PRESETS[c], q), sea: mixDeep(SEA_PRESETS[a], SEA_PRESETS[c], q), name: q < 0.5 ? a : c, from: a, to: c, q };
      mixCache.set(key, v);
    }
    return v;
  }
  const A = resolve(a), C = resolve(c);
  return { sky: mixDeep(A.sky, C.sky, q), sea: mixDeep(A.sea, C.sea, q), name: q < 0.5 ? A.name : C.name };
}

/** Normaliza `preset` (nombre | {sky, sea} | undefined) → { sky, sea, name }. */
export function resolve(preset = 'day') {
  if (typeof preset === 'string') {
    const sky = SKY_PRESETS[preset];
    if (!sky) throw new Error(`preset desconocido: ${preset} (hay: ${PRESET_NAMES.join(', ')})`);
    return { sky, sea: SEA_PRESETS[preset], name: preset };
  }
  if (preset.sky && preset.sea) return preset;
  throw new Error('preset inválido: pasá un nombre o el resultado de mixPreset()');
}
export const skyOf = (preset) => resolve(preset).sky;
export const seaOf = (preset) => resolve(preset).sea;
export const lightOf = (preset) => resolve(preset).sky.light;

/** Color «iluminado» por el preset: tiñe un color de marca con el ambiente de la luz (para que la chimenea
 *  naranja o el casco navy no queden pegados encima del atardecer). */
export function litColor(hex, preset, k = 1) {
  const L = lightOf(preset);
  return mixHex(hex, L.ambient, L.ambientA * k);
}
