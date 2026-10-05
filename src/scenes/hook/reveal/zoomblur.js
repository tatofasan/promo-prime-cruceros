// Desenfoque radial de zoom (viaje de cámara) por duplicación: en cada pasada se promedia la imagen con una
// copia escalada desde (cx, cy) a la mitad del paso anterior. P pasadas = 2^P muestras parejas (en escala
// logarítmica) con solo 2·P dibujos. amt = cuánto más grande es la copia más lejana (0,1 = 10 %).
// Ahorra memoria: con desenfoque fuerte trabaja a media resolución en dos lienzos fijos (ida y vuelta), que se
// limpian enteros en cada uso; con desenfoque suave usa una sola capa extra a resolución completa.
import { toLayer, blit } from '../../../engine/draw.js';
import { layer } from '../../../engine/layer.js';
import { makeCanvas } from '../../../engine/env.js';
import { W, H } from '../../../engine/time.js';

let HALF = null;
/** Lienzos de media resolución (llamar en init). */
export function initZoomBlur() {
  if (!HALF) HALF = [makeCanvas(W / 2, H / 2), makeCanvas(W / 2, H / 2)];
}

function passes(src, dst, cx, cy, amt, n, w, h) {
  let step = Math.log(1 + amt);
  for (let i = 0; i < n; i++) {
    step /= 2;
    const s = Math.exp(step);
    const c = dst.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    c.drawImage(src, 0, 0);
    c.globalAlpha = 0.5;
    c.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s);
    c.drawImage(src, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    [src, dst] = [dst, src];
  }
  return src;
}

export function zoomBlur(ctx, cx, cy, amt, fn) {
  if (amt < 0.006) { fn(ctx); return; }
  const L = toLayer(ctx, fn);
  if (amt < 0.045 || !HALF) {
    // suave: 3 pasadas a resolución completa entre la capa de la escena y una más
    const out = passes(L, layer(), cx, cy, amt, 3, W, H);
    blit(ctx, out);
    return;
  }
  // fuerte: baja a media resolución, 4 pasadas y vuelve a subir (el detalle fino ya se lo come el movimiento)
  const [A, B] = HALF;
  const a = A.getContext('2d');
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalAlpha = 1;
  a.clearRect(0, 0, W / 2, H / 2);
  a.drawImage(L, 0, 0, W / 2, H / 2);
  const out = passes(A, B, cx / 2, cy / 2, amt, 4, W / 2, H / 2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(out, 0, 0, W, H);
  ctx.restore();
}
