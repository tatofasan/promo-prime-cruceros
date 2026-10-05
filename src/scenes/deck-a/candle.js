// Candelabro de plata con vela de cera vista desde arriba: base, tallo, platillo y vela apilados en altura
// (con la cámara cenital se abren en perspectiva), llama con núcleo blanco y halo que titila.
import { TAU, clamp } from '../../engine/ease.js';
import { project, hullPath, LIGHT, flicker, warmDisc, put } from './util.js';
import { noise1 } from '../../engine/noise.js';

const H_PAN = 290, H_TOP = LIGHT.h - 16;

function silverDisc(ctx, x, y, r, ang, { rim = true } = {}) {
  const lx = Math.cos(ang), ly = Math.sin(ang);
  const g = ctx.createRadialGradient(x + lx * r * 0.35, y + ly * r * 0.35, 0, x, y, r);
  g.addColorStop(0, '#FBFDFF');
  g.addColorStop(0.35, '#C6D0DB');
  g.addColorStop(0.8, '#76849A');
  g.addColorStop(1, '#4A576B');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (rim) {
    ctx.strokeStyle = 'rgba(255,240,215,0.85)';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r * 0.93, ang - 0.8, ang + 0.8); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,18,32,0.45)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.95, ang + Math.PI - 0.9, ang + Math.PI + 0.9); ctx.stroke();
  }
}

/**
 * Dibuja el candelabro. o = { pop (0..1+ escala de aparición), lit (0..1 llama), t }
 * La luz viene de la propia llama: los platillos se iluminan desde arriba (brillo cálido en el centro).
 */
export function drawCandle(ctx, C, o) {
  const { pop = 1, lit = 1, t = 0 } = o;
  if (pop <= 0.001) return;
  const x = LIGHT.x, y = LIGHT.y;
  const P = (h) => project(C, x, y, h * pop);
  const [bx, by, bk] = P(0);
  const ang = Math.atan2(by - 540, bx - 960) + Math.PI; // hacia el centro del cuadro (la sala)
  ctx.save();
  // base
  silverDisc(ctx, bx, by, 56 * bk * pop, ang);
  ctx.strokeStyle = 'rgba(30,40,55,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx, by, 40 * bk * pop, 0, TAU); ctx.stroke();
  // tallo con nudos
  const [kx, ky, kk] = P(120);
  const [px, py, pk] = P(H_PAN);
  ctx.fillStyle = '#8693A6';
  ctx.fill(hullPath(bx, by, 15 * bk * pop, px, py, 11 * pk * pop));
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill(hullPath(bx + Math.cos(ang) * 6, by + Math.sin(ang) * 6, 3 * bk, px + Math.cos(ang) * 4, py + Math.sin(ang) * 4, 2.5 * pk));
  silverDisc(ctx, kx, ky, 21 * kk * pop, ang, { rim: false });
  // platillo
  silverDisc(ctx, px, py, 38 * pk * pop, ang);
  ctx.fillStyle = 'rgba(255,214,140,0.35)';
  ctx.beginPath(); ctx.arc(px, py, 30 * pk * pop, 0, TAU); ctx.fill();
  // vela de cera
  const [tx, ty, tk] = P(H_TOP);
  const wax = ctx.createLinearGradient(px, py, tx, ty);
  wax.addColorStop(0, '#E9D9BB');
  wax.addColorStop(1, '#FFF4DE');
  ctx.fillStyle = wax;
  ctx.fill(hullPath(px, py, 16 * pk * pop, tx, ty, 15 * tk * pop));
  // tope de la vela con cera derretida que brilla
  ctx.fillStyle = '#FFF7E6';
  ctx.beginPath(); ctx.arc(tx, ty, 15 * tk * pop, 0, TAU); ctx.fill();
  const melt = ctx.createRadialGradient(tx, ty, 0, tx, ty, 12 * tk * pop);
  melt.addColorStop(0, `rgba(255,220,140,${0.95 * lit})`);
  melt.addColorStop(1, `rgba(255,236,190,${0.4 * lit})`);
  ctx.fillStyle = melt;
  ctx.beginPath(); ctx.arc(tx, ty, 11 * tk * pop, 0, TAU); ctx.fill();
  ctx.restore();
  if (lit > 0.01) drawFlame(ctx, C, t, lit, pop);
}

/** Llama + halo (se dibuja también aparte, encima de todo, para el resplandor). */
export function drawFlame(ctx, C, t, lit = 1, pop = 1) {
  const f = flicker(t);
  const [x, y, k] = project(C, LIGHT.x + noise1(t * 6, 3) * 2.5, LIGHT.y + noise1(t * 5, 4) * 2.5, LIGHT.h * pop);
  const dir = Math.atan2(y - 540, x - 960);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  put(ctx, warmDisc(), x, y, { s: (70 * k * f * lit) / 64, alpha: 0.55 * lit });
  ctx.restore();
  // llama en lágrima: se estira hacia afuera por la perspectiva y titila
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir + noise1(t * 4, 9) * 0.25);
  const s = k * lit * (0.95 + 0.08 * f);
  const len = 30 * s * (0.9 + 0.2 * f);
  const tear = (sc) => {
    ctx.beginPath();
    ctx.moveTo(len * sc, 0);
    ctx.bezierCurveTo(len * 0.45 * sc, -11 * s * sc, -10 * s * sc, -11 * s * sc, -10 * s * sc, 0);
    ctx.bezierCurveTo(-10 * s * sc, 11 * s * sc, len * 0.45 * sc, 11 * s * sc, len * sc, 0);
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(255,107,74,0.85)';
  tear(1.12);
  ctx.fillStyle = '#FFB938';
  tear(0.95);
  ctx.fillStyle = '#FFE9B8';
  tear(0.7);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(-1 * s, 0, 6 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(60,90,200,0.55)';
  ctx.beginPath(); ctx.ellipse(-7 * s, 0, 3 * s, 5 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2B1B12';
  ctx.beginPath(); ctx.arc(-4 * s, 0, 1.8 * s, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Halo grande de la vela (pasa sobre todo: aire cálido). */
export function drawHalo(ctx, C, t, lit = 1, boost = 0) {
  if (lit <= 0.01) return;
  const f = flicker(t);
  const [x, y, k] = project(C, LIGHT.x, LIGHT.y, LIGHT.h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  put(ctx, warmDisc(), x, y, { s: ((260 + boost * 160) * k * f) / 64, alpha: clamp(0.22 * lit * f + boost * 0.25) });
  ctx.restore();
}

/** Velita en vaso facetado (luz secundaria del lado izquierdo; no proyecta sombras). */
export function drawVotive(ctx, C, t, x, y, pop = 1, lit = 1) {
  if (pop <= 0.001) return;
  const [bx, by, bk] = project(C, x, y, 0);
  const [rx, ry, rk] = project(C, x, y, 72 * pop);
  ctx.save();
  // vaso ámbar facetado
  ctx.fillStyle = 'rgba(255,186,110,0.2)';
  ctx.fill(hullPath(bx, by, 34 * bk * pop, rx, ry, 37 * rk * pop));
  ctx.strokeStyle = 'rgba(255,214,160,0.35)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a) * 30 * bk * pop, by + Math.sin(a) * 30 * bk * pop);
    ctx.lineTo(rx + Math.cos(a) * 36 * rk * pop, ry + Math.sin(a) * 36 * rk * pop);
    ctx.stroke();
  }
  // velita de té: copa de aluminio y cera
  const [cx, cy, ck] = project(C, x, y, 14 * pop);
  ctx.fillStyle = '#B9C3CE';
  ctx.beginPath(); ctx.arc(cx, cy, 25 * ck * pop, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFF4DE';
  ctx.beginPath(); ctx.arc(cx, cy, 21 * ck * pop, 0, TAU); ctx.fill();
  const melt = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 * ck * pop);
  melt.addColorStop(0, `rgba(255,214,130,${0.95 * lit})`);
  melt.addColorStop(1, `rgba(255,236,190,${0.3 * lit})`);
  ctx.fillStyle = melt;
  ctx.beginPath(); ctx.arc(cx, cy, 14 * ck * pop, 0, TAU); ctx.fill();
  // borde del vaso con brillo
  ctx.strokeStyle = 'rgba(255,235,200,0.75)';
  ctx.lineWidth = 2.2;
  const la = Math.atan2(LIGHT.y - y, LIGHT.x - x) + C.r;
  ctx.beginPath(); ctx.arc(rx, ry, 37 * rk * pop, la - 0.8, la + 0.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,200,140,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(rx, ry, 37 * rk * pop, 0, TAU); ctx.stroke();
  ctx.restore();
  if (lit <= 0.01) return;
  // llamita y resplandor (titilan con fase propia)
  const f = 1 + 0.09 * noise1(t * 8.1, 21) + 0.05 * noise1(t * 21, 22);
  const [fx, fy, fk] = project(C, x + noise1(t * 6, 23) * 1.5, y, 34 * pop);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  put(ctx, warmDisc(), fx, fy, { s: (150 * fk * f * lit) / 64, alpha: 0.32 * lit });
  put(ctx, warmDisc(), fx, fy, { s: (34 * fk * f * lit) / 64, alpha: 0.7 * lit });
  ctx.restore();
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(Math.atan2(fy - 540, fx - 960) + noise1(t * 4, 24) * 0.3);
  const s = fk * lit * 0.6;
  ctx.fillStyle = '#FFB938';
  ctx.beginPath(); ctx.ellipse(6 * s, 0, 16 * s * f, 8 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFF4D6';
  ctx.beginPath(); ctx.ellipse(3 * s, 0, 9 * s, 5 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
