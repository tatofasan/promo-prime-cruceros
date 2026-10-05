// Capas baratas a media resolución para el mapa: desenfoque (profundidad de campo), barrido direccional
// (látigos) y barrido radial (alejamientos). Todas dibujan la escena en un lienzo con MARGEN (bleed): la escena
// se pinta también afuera del cuadro, así al correr las copias nunca aparecen los bordes de la capa (nada de
// bandas oscuras ni cortes verticales). Mientras se dibuja con margen, PAD (px de pantalla) dice cuánto hay que
// cubrir afuera del cuadro: los rellenos de pantalla completa del mapa lo leen.
// Los lienzos se crean una vez y se limpian en cada uso (no guardan nada entre cuadros).
import { W, H } from '../../engine/time.js';
import { makeCanvas } from '../../engine/env.js';

/** Margen actual (px de pantalla) que tienen que cubrir los rellenos «de pantalla completa». */
export let PAD = 0;
/** Rectángulo a cubrir en coordenadas de pantalla: [x, y, w, h]. */
export const fullRect = () => [-PAD, -PAD, W + 2 * PAD, H + 2 * PAD];

/** Corre fn con un margen mínimo `pad` (para cachés armadas en init que se pintan más grandes que el cuadro). */
export function withPad(pad, fn) {
  const prev = PAD;
  PAD = Math.max(PAD, pad);
  try { return fn(); } finally { PAD = prev; }
}

const pools = new Map();
/** Par de lienzos a media resolución con margen `pad` (px de pantalla), por nombre de uso. */
function pair(name, pad) {
  const key = name + ':' + pad;
  let p = pools.get(key);
  if (!p) {
    const w = Math.ceil((W + 2 * pad) / 2), h = Math.ceil((H + 2 * pad) / 2);
    p = { a: makeCanvas(w, h), b: makeCanvas(w, h), w, h, pad, busy: false };
    pools.set(key, p);
  }
  return p;
}
const reset = (c) => {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
};
// Pinta fn en el lienzo a (media resolución + margen). Devuelve false si el par está ocupado (anidado).
function paint(p, fn) {
  if (p.busy) return false;
  p.busy = true;
  const a = p.a.getContext('2d');
  reset(a);
  a.clearRect(0, 0, p.w, p.h);
  a.setTransform(0.5, 0, 0, 0.5, p.pad / 2, p.pad / 2);
  const prev = PAD;
  PAD = Math.max(PAD, p.pad);
  try { fn(a); } finally { PAD = prev; p.busy = false; }
  return true;
}
// Pega el lienzo c (media resolución + margen) en ctx con su transformación actual.
function blitBack(ctx, c, pad, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, -pad, -pad, W + 2 * pad, H + 2 * pad);
  ctx.restore();
}

export function initSoft() {
  for (const [n, pd] of [['soft', 24], ['smear', 120], ['smear', 210], ['smear', 320], ['zoom', 140]]) pair(n, pd);
}

/** Dibuja fn(ctx) desenfocado px (en px de pantalla). alpha opcional. */
export function soft(ctx, px, fn, { alpha = 1 } = {}) {
  if (px < 0.6) { fn(ctx); return; }
  const pad = Math.max(24, PAD);
  const p = pair('soft', pad);
  if (!paint(p, fn)) { fn(ctx); return; }
  const b = p.b.getContext('2d');
  reset(b);
  b.clearRect(0, 0, p.w, p.h);
  b.filter = `blur(${(px / 2).toFixed(2)}px)`;
  b.drawImage(p.a, 0, 0);
  b.filter = 'none';
  blitBack(ctx, p.b, pad, alpha);
}

/**
 * Barrido direccional (látigo) de largo total (dx, dy) px de pantalla. En vez de sumar n copias con alfa 1/n
 * (en 8 bits eso posteriza), promedia de a pares en pasadas sucesivas (ping-pong): cada pasada mezcla dos
 * copias corridas ±s al 50 % y s se divide por 2 → filtro de caja de 2^passes muestras (6 pasadas = 64).
 * El margen (320 px) cubre el corrimiento máximo: el largo se recorta a ±600 px.
 */
export function smearSoft(ctx, dx, dy, fn, passes = 0) {
  const L = Math.hypot(dx, dy);
  if (!passes) passes = L > 260 ? 6 : 5;
  if (L > 600) { dx *= 600 / L; dy *= 600 / L; }
  // margen justo para el corrimiento (≈ la mitad del largo): menos superficie que pintar en los cuadros suaves
  const p = pair('smear', L > 380 ? 320 : L > 200 ? 210 : 120);
  if (!paint(p, fn)) { fn(ctx); return; }
  let src = p.a, dst = p.b;
  let sx = dx / 8, sy = dy / 8; // media resolución: ±dx/4 en la primera pasada → largo total ≈ dx
  for (let k = 0; k < passes; k++) {
    const d = dst.getContext('2d');
    reset(d);
    d.clearRect(0, 0, p.w, p.h);
    d.drawImage(src, -sx, -sy);
    d.globalAlpha = 0.5;
    d.drawImage(src, sx, sy);
    [src, dst] = [dst, src];
    sx /= 2; sy /= 2;
  }
  blitBack(ctx, src, p.pad);
}

/**
 * Barrido radial (zoom blur) alrededor de (cx, cy): amount = fracción de escala total (0,05 = 5 %).
 * Mismo promedio de a pares: cada pasada mezcla la capa a escala 1+s y 1−s.
 */
export function zoomSmear(ctx, amount, fn, { cx = W / 2, cy = H / 2, passes = 4 } = {}) {
  if (Math.abs(amount) < 0.004) { fn(ctx); return; }
  const p = pair('zoom', 140);
  if (!paint(p, fn)) { fn(ctx); return; }
  const ox = (cx + p.pad) / 2, oy = (cy + p.pad) / 2; // centro en el lienzo de media resolución
  let src = p.a, dst = p.b;
  let s = Math.min(0.12, Math.abs(amount)) / 4;
  for (let k = 0; k < passes; k++) {
    const d = dst.getContext('2d');
    reset(d);
    d.clearRect(0, 0, p.w, p.h);
    for (const [f, al] of [[1 + s, 1], [1 - s, 0.5]]) {
      d.globalAlpha = al;
      d.setTransform(f, 0, 0, f, ox * (1 - f), oy * (1 - f));
      d.drawImage(src, 0, 0);
    }
    [src, dst] = [dst, src];
    s /= 2;
  }
  blitBack(ctx, src, p.pad);
}
