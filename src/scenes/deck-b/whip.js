// Barrido de látigo barato: el contenido se dibuja una vez y se promedian copias corridas en buffers de cuarto
// de ancho (el desenfoque horizontal borra ese detalle igual); dos pasadas (caja sobre caja) para que no se vean
// copias sueltas; después se estira a pantalla completa.
// (smear() del motor promedia a resolución completa: ~130 ms por cuadro en Skia de CPU.)
import { makeCanvas } from '../../engine/env.js';
import { layer } from '../../engine/layer.js';
import { W, H } from '../../engine/time.js';

const DS = 4;
let bufA = null, bufB = null;

function accumulate(dst, src, sw, dx, n) {
  const b = dst.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-over';
  b.globalAlpha = 1;
  b.clearRect(0, 0, dst.width, H);
  b.globalCompositeOperation = 'lighter';
  b.globalAlpha = 1 / n;
  for (let k = 0; k < n; k++) {
    const f = n === 1 ? 0 : k / (n - 1) - 0.5;
    b.drawImage(src, 0, 0, sw, H, (dx * f) / DS, 0, dst.width, H);
  }
}

/** Dibuja fn con un barrido horizontal de largo dx (px). Por debajo de 24 px dibuja directo. */
export function whipSmear(ctx, dx, fn) {
  if (Math.abs(dx) < 24) { fn(ctx); return; }
  if (!bufA) { bufA = makeCanvas(Math.ceil(W / DS), H); bufB = makeCanvas(Math.ceil(W / DS), H); }
  const L = layer();
  const lc = L.getContext('2d');
  lc.setTransform(ctx.getTransform());
  fn(lc);
  const n1 = Math.max(4, Math.min(14, Math.ceil(Math.abs(dx) / 80)));
  accumulate(bufA, L, W, dx, n1);
  // segunda pasada: rellena los huecos entre copias
  const gap = dx / n1;
  accumulate(bufB, bufA, bufA.width, gap * 1.2, 5);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bufB, 0, 0, bufB.width, H, 0, 0, W, H);
  ctx.restore();
}

/** Estrías de luz horizontales que acompañan el látigo (k 0..1 = intensidad, dir = sentido). */
export function whipStreaks(ctx, k, seedT) {
  if (k <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const y = 90 + ((i * 0.618034 + 0.13) % 1) * 900;
    const len = 500 + ((i * 0.37) % 1) * 1100;
    const x = ((i * 0.733 + seedT * 3.1) % 1) * (W + len) - len;
    const h = 2 + (i % 3) * 2.5;
    const g = ctx.createLinearGradient(x, 0, x + len, 0);
    const c = i % 3 === 0 ? '255,248,238' : '255,210,122';
    g.addColorStop(0, `rgba(${c},0)`);
    g.addColorStop(0.6, `rgba(${c},${(0.55 * k).toFixed(3)})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y - h / 2, len, h);
  }
  ctx.restore();
}
