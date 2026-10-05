// Grilla musical y hoja de golpes (cues). Fuente única: src/cues.json (la lee también audio/ en Python).
// 128 BPM → beat = 0,46875 s · compás = 1,875 s · 16 compases = 30,000 s exactos.
// A 60 fps un beat son 28,125 cuadros: el golpe visual va en el cuadro más cercano al cue (error ≤ 8 ms).
import SHEET from '../cues.json' with { type: 'json' };

export const BPM = SHEET.bpm;
export const BEAT = 60 / BPM;
export const BAR = 4 * BEAT;
export const DUR = SHEET.duration;
export const FPS = SHEET.fps;
// FORMATO: '16x9' (1920×1080, por defecto) o '9x16' (1080×1920, versión vertical para Reels/TikTok/Stories).
// Se elige ANTES de cargar el motor: en Node con --format=9x16 (tools/node-env.mjs) y en el navegador con
// ?format=9x16 (index.html). Las escenas ramifican con VERTICAL (PLAN §13); el tiempo y los cues son los mismos.
const FORMATS = { '16x9': [1920, 1080], '9x16': [1080, 1920] };
export const FORMAT = FORMATS[globalThis.__FORMAT__] ? globalThis.__FORMAT__ : '16x9';
export const VERTICAL = FORMAT === '9x16';
export const W = FORMATS[FORMAT][0];
export const H = FORMATS[FORMAT][1];
export const CUES = SHEET.cues;
export const SECTIONS = SHEET.sections;

/** Segundos del compás `bar` (desde 0) y el beat `beat` (desde 1; admite fracciones: 2.5 = corchea después del 2). */
export const b = (bar, beat = 1) => +(bar * BAR + (beat - 1) * BEAT).toFixed(6);

const byId = new Map(CUES.map((c) => [c.id, c]));
/** Tiempo (s) del cue `id`. Tira si no existe: mejor romper que desincronizar en silencio. */
export function cue(id) {
  const c = byId.get(id);
  if (!c) throw new Error(`cue desconocido: ${id}`);
  return c.t;
}
export const cueObj = (id) => byId.get(id);
export const section = (id) => SECTIONS.find((s) => s.id === id);

/** Posición musical de t: { bar (desde 0), beat (desde 1), frac (0..1 dentro del beat) }. */
export function barPos(t) {
  const beats = t / BEAT + 1e-9;
  const bar = Math.floor(beats / 4);
  const inBar = beats - bar * 4;
  return { bar, beat: Math.floor(inBar) + 1, frac: inBar - Math.floor(inBar) };
}

/**
 * Pulso rítmico puro: 1 justo en cada golpe, cae exponencialmente (decay en s).
 * every = cada cuántos beats (1 negras, 0.5 corcheas, 4 compases); offset en beats; activo en [from, to).
 */
export function beatPulse(t, { from = 0, to = DUR, every = 1, decay = 0.1, offset = 0 } = {}) {
  if (t < from || t >= to) return 0;
  const step = every * BEAT;
  const local = t - from - offset * BEAT;
  if (local < 0) return 0;
  return Math.exp(-(local % step) / decay);
}

/** Último cue cuyo id empieza con `prefix` y ya pasó en t (o null). Útil para "estado actual". */
export function lastCue(t, prefix) {
  let best = null;
  for (const c of CUES) if (c.id.startsWith(prefix) && c.t <= t + 1e-9 && (!best || c.t >= best.t)) best = c;
  return best;
}
