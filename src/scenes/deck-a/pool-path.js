// Recorrido del tobogán (mundo x, y, h) y cinemática de quien baja: todo precalculado al cargar (puro).
//   salida de la plataforma → hélice horaria de 1,5 vueltas → canaleta de frenado → vuelo → SPLASH en exp.slide
import { cue, BEAT } from '../../engine/time.js';
import { clamp } from '../../engine/ease.js';
import { SLIDE, WATER_H } from './pool-geo.js';
import { bez } from './shape.js';

const { cx, cy, R0, R1, hTop, hBot } = SLIDE;
/** Radio de la espiral cónica en la fracción u (0 arriba → 1 abajo). */
export const radiusAt = (u) => R0 + (R1 - R0) * u;
export const TH1 = 0.75 * Math.PI;          // sale por el sudoeste
export const TH0 = TH1 - SLIDE.turns * 2 * Math.PI;
const dir = (a) => [Math.cos(a), Math.sin(a)];
const tan = (a) => [-Math.sin(a), Math.cos(a)]; // tangente con θ creciente (horario en pantalla)

// ------------------------------------------------------------------ puntos
const P = []; // { x, y, h, s (largo acumulado), part }
function push(x, y, h, part) {
  const q = P[P.length - 1];
  const s = q ? q.s + Math.hypot(x - q.x, y - q.y, h - q.h) : 0;
  if (q && s - q.s < 0.5) return;
  P.push({ x, y, h, s, part });
}
// 1) arranque: de la plataforma (centro) a la hélice, tangente
{
  // la largada: un tramo recto corto desde la plataforma (centro) hasta el primer punto de la espiral
  const [ex, ey] = [cx + R0 * Math.cos(TH0), cy + R0 * Math.sin(TH0)];
  const [tx, ty] = tan(TH0);
  for (let i = 0; i <= 6; i++) { const u = i / 6; push(ex - tx * 46 * (1 - u), ey - ty * 46 * (1 - u), hTop, 0); }
}
export const S_START = P[P.length - 1].s;
// 2) hélice
{
  const n = 220;
  for (let i = 1; i <= n; i++) {
    const u = i / n, a = TH0 + (TH1 - TH0) * u, R = radiusAt(u);
    push(cx + R * Math.cos(a), cy + R * Math.sin(a), hTop - (hTop - hBot) * u, 1);
  }
}
export const S_HE = P[P.length - 1].s;
// 3) canaleta de frenado: sale hacia el noroeste y endereza al oeste
{
  const e = [cx + R1 * Math.cos(TH1), cy + R1 * Math.sin(TH1)];
  const [tx, ty] = tan(TH1);
  const end = [1388, 744]; // la boca cuelga sobre el agua (el splash cae bien adentro de la pileta)
  const pts = bez(e, [e[0] + tx * 46, e[1] + ty * 46], [end[0] + 52, end[1] - 2], end, 26);
  pts.forEach(([x, y], i) => i && push(x, y, hBot - (hBot - 40) * (i / (pts.length - 1)), 2));
}
export const S_END = P[P.length - 1].s;
export const PATH = P;

/** Punto del recorrido en el largo s: { x, y, h, tx, ty (tangente), part }. */
export function pathAt(s) {
  s = clamp(s, 0, S_END);
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
  const a = P[lo], c = P[hi];
  const u = c.s > a.s ? (s - a.s) / (c.s - a.s) : 0;
  const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, h: a.h + (c.h - a.h) * u, tx: (c.x - a.x) / L, ty: (c.y - a.y) / L, part: c.part, s };
}

// ------------------------------------------------------------------ cinemática (golpes contra los cues)
export const TI = cue('exp.slide') - 1 / 120;  // cuadro de impacto
export const T_HE = cue('exp.slide') - BEAT / 2; // 6,328: entra a la canaleta en la corchea (chorro de agua)
export const T_GO = 5.64;                       // ya se larga mientras se abre el iris
const S0 = S_START * 0.25;
const V2 = 760;                                 // velocidad al salir de la canaleta (px/s)
const HOP = 95;                                 // salto al salir de la boca (altura extra en el medio del vuelo)
const D1 = S_HE - S0, T1 = T_HE - T_GO;
const V1 = (2 * D1) / T1;                       // aceleración constante en la hélice
const LC = S_END - S_HE;
const T2 = (2 * LC) / (V1 + V2);
export const T_CE = T_HE + T2;                  // sale volando
const TAU_F = TI - T_CE;
const END = pathAt(S_END);
export const SPLASH_PT = { x: END.x + END.tx * V2 * TAU_F, y: END.y + END.ty * V2 * TAU_F };

/** Posición de quien baja en t: { x, y, h, tx, ty, v, phase: 'wait'|'slide'|'chute'|'fly'|'gone', fly (0..1) }. */
export function riderAt(t) {
  if (t < T_GO) {
    const q = pathAt(S0 - 3 * Math.sin(Math.PI * clamp((t - 5.5) / 0.14)));
    return { ...q, v: 0, phase: 'wait', fly: 0 };
  }
  if (t < T_HE) {
    const u = (t - T_GO) / T1;
    return { ...pathAt(S0 + D1 * u * u), v: V1 * u, phase: 'slide', fly: 0 };
  }
  if (t < T_CE) {
    const d = t - T_HE;
    const a = (V2 - V1) / T2;
    return { ...pathAt(S_HE + V1 * d + 0.5 * a * d * d), v: V1 + a * d, phase: 'chute', fly: 0 };
  }
  if (t < TI) {
    const d = t - T_CE, u = d / TAU_F;
    return {
      x: END.x + END.tx * V2 * d, y: END.y + END.ty * V2 * d, h: END.h + (WATER_H - END.h) * u * u + 4 * HOP * u * (1 - u),
      tx: END.tx, ty: END.ty, v: V2, phase: 'fly', fly: d / TAU_F, part: 3,
    };
  }
  return { ...SPLASH_PT, h: WATER_H, tx: END.tx, ty: END.ty, v: 0, phase: 'gone', fly: 1, part: 3 };
}
