// La OLA se lleva el texto. Desde la v2 la cresta (over de reveal-sea) se pinta ENCIMA de los titulares
// (OVER_ABOVE en index.js): el agua, el labio y la espuma tapan las letras. Acá queda la geometría que TYPE
// necesita del frente: el gris se borra con la máscara INVERSA (waveCut, el mismo Path2D que el frente) y lo que
// entra en el drop solo existe detrás del frente (clipBehind).
//
// Ola v3 de ART (barril que rompe): debajo del labio queda el HUECO del tubo, que todavía es escena vieja (la
// máscara no lo cubre) y está en la penumbra del labio. La cresta pinta esa penumbra encima de todo, pero sobre
// las letras claras no alcanza: se leían brillantes adentro del tubo (como una fuga). hollowShade() las hunde en
// la misma sombra (misma rampa y mismo techo que la cresta, sobre las letras) y las apaga cerca de la cara, para
// que el agua se las lleve sin dejar letras encendidas dentro del barril. La geometría sale de waveGeom (hollow,
// face, X, Hc): si ART mueve la forma, esto la sigue.
// frontXAt / grab / waveShade / behindAlpha quedan como utilidades (valores de la v3).
import { waveGeom, drawWaveMask } from '../../art/wave.js';
import { HOOK_WAVE } from '../waves.js';
import { clamp } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';

export const WAVE = HOOK_WAVE;

/** x del frente del agua a la altura y (pantalla; ola 'rtl'): el punto MÁS adelantado del perfil. */
export function frontXAt(p, y) {
  if (p <= 0) return Infinity;
  if (p >= 1) return -Infinity;
  const G = waveGeom(p, { dir: WAVE.dir });
  const F = G.front;
  let best = Infinity;
  for (let i = 0; i < F.length - 1; i++) {
    const [x0, y0] = F[i], [x1, y1] = F[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) {
      const x = x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
      if (x < best) best = x;
    }
  }
  if (best === Infinity) best = y < F[F.length - 1][1] ? G.X + 0.12 * G.Hc : G.X;
  return best;
}

/**
 * Cuánto «agarra» la ola a una letra cuyo borde derecho está en (x, y) de pantalla: 0 lejos → 1 en el frente.
 * reach = distancia (px) a la que empieza a tironear.
 */
export function grab(p, x, y, reach = 260) {
  const fx = frontXAt(p, y);
  if (!isFinite(fx)) return fx < 0 ? 1 : 0;
  return Math.pow(clamp(1 - (fx - x) / reach), 2);
}

// rampa de la sombra que la cresta proyecta adelante (wave.js v3): U(−0,6) → U(−0,04), alfa 0 → 0,14 → 0,34
const SHADE = { u0: -0.6, u1: -0.04, mid: 0.55, aMid: 0.14, aEnd: 0.34 };
/** Alfa de la sombra que la ola proyecta adelante en la x de pantalla (mismo degradé que wave.js v3). */
export function waveShade(p, x) {
  if (p <= 0 || p >= 1) return 0;
  const { X, Hc } = waveGeom(p, { dir: WAVE.dir });
  const u = clamp((x - (X + SHADE.u0 * Hc)) / ((SHADE.u1 - SHADE.u0) * Hc));
  return u < SHADE.mid ? (u / SHADE.mid) * SHADE.aMid : SHADE.aMid + ((u - SHADE.mid) / (1 - SHADE.mid)) * (SHADE.aEnd - SHADE.aMid);
}

/**
 * Hunde en la penumbra de la ola lo ya dibujado en `c` (capa del texto, transformación = pantalla) y lo apaga
 * cerca de la cara del barril. Solo toca píxeles que ya existen (source-atop / destination-out).
 *   · rampa adelante del frente × amt (la cresta ya pone otra igual encima: sobre lo claro hace falta el doble)
 *   · techo del tubo (radial bajo el labio) × amt
 *   · fundido: en los últimos `fade` px antes de la cara (y bajo la panza) la letra se va a alfa (1 − sink)
 */
export function hollowShade(c, p, { amt = 1, sink = 0.6, fade = 0.16 } = {}) {
  if (p <= 0 || p >= 1 || amt <= 0) return;
  const G = waveGeom(p, { dir: WAVE.dir });
  const { X, Hc, Y0 } = G;
  const U = (u) => X + u * Hc, V = (v) => Y0 + v * Hc;
  const [hx, hy] = G.hollow ?? [X - 0.25 * Hc, Y0 + 0.57 * Hc];
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(U(SHADE.u0), 0, U(SHADE.u1), 0);
  g.addColorStop(0, rgba(PAL.ink, 0));
  g.addColorStop(SHADE.mid, rgba(PAL.ink, SHADE.aMid * amt));
  g.addColorStop(1, rgba(PAL.ink, Math.min(0.9, SHADE.aEnd * amt)));
  c.fillStyle = g;
  c.fillRect(U(SHADE.u0), V(0.05) - Hc, (SHADE.u1 - SHADE.u0) * Hc + 2, 2.4 * Hc);
  const rx = hx + 0.03 * Hc, ry = hy - 0.16 * Hc, rr = 0.34 * Hc;
  const r = c.createRadialGradient(rx, ry, 0, rx, ry, rr);
  r.addColorStop(0, rgba(PAL.ink, Math.min(0.9, 0.42 * amt)));
  r.addColorStop(0.6, rgba(PAL.ink, 0.18 * amt));
  r.addColorStop(1, rgba(PAL.ink, 0));
  c.fillStyle = r;
  c.fillRect(rx - rr, ry - rr, 2 * rr, 2 * rr);
  // fundido hacia la cara: la cara del barril es casi vertical a la altura del texto → rampa en x hasta el frente
  if (sink > 0) {
    c.globalCompositeOperation = 'destination-out';
    const fx = U(-0.08), f0 = fx - fade * Hc;
    const d = c.createLinearGradient(f0, 0, fx, 0);
    d.addColorStop(0, 'rgba(0,0,0,0)');
    d.addColorStop(1, `rgba(0,0,0,${sink})`);
    c.fillStyle = d;
    c.fillRect(f0, -Hc, fx - f0 + 0.4 * Hc, 3 * Hc); // de la cara hacia atrás ya lo borra waveCut
  }
  c.restore();
}

/** Recorta ctx a lo que el agua TODAVÍA no tapó (máscara inversa de la ola). Llamar con transformación identidad. */
export function clipAhead(ctx, p) {
  if (p <= 0) return;
  if (p >= 1) { ctx.beginPath(); ctx.rect(0, 0, 0, 0); ctx.clip(); return; }
  ctx.clip(waveGeom(p, { dir: WAVE.dir }).inverse, 'evenodd');
}

/** Recorta ctx a lo que la ola YA pasó (la escena nueva). Llamar con transformación identidad. */
export function clipBehind(ctx, p) {
  if (p >= 1) return;
  if (p <= 0) { ctx.beginPath(); ctx.rect(0, 0, 0, 0); ctx.clip(); return; }
  ctx.clip(waveGeom(p, { dir: WAVE.dir }).mask);
}

// la espalda de la ola v3 se funde (alfa 1 → 0) entre U(0,335) y U(0,405), al pie de la loma
const FADE = { u0: 0.335, u1: 0.405 };
/** Lo que entra con la ola aparece DETRÁS del cuerpo de agua: alfa 0 cerca del frente → 1 detrás de la espalda. */
export function behindAlpha(p, x) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const { X, Hc } = waveGeom(p, { dir: WAVE.dir });
  const k = clamp((x - (X + FADE.u0 * Hc)) / ((FADE.u1 - FADE.u0) * Hc));
  return k * k;
}

/** x más adelantada de todo el frente (labio incluido). */
export function frontMin(p) {
  if (p <= 0) return Infinity;
  if (p >= 1) return -Infinity;
  let m = Infinity;
  for (const [x] of waveGeom(p, { dir: WAVE.dir }).front) m = Math.min(m, x);
  return m;
}

/** Borra de la capa/búfer `c` (con su transformación actual = pantalla) lo que el agua ya tapó. */
export function waveCut(c, p) {
  c.save();
  c.globalCompositeOperation = 'destination-in';
  drawWaveMask(c, p, { dir: WAVE.dir, inverse: true });
  c.restore();
}
