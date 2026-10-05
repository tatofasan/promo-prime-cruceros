// Cubierta horneada una sola vez (init): tablas de teca con veta y juntas, tablas de borde que siguen la pileta,
// guarda de venecitas, borde de piedra con bullnose, canaleta del borde y hueco de la pileta. Encima, lo
// estático (reposeras, sombras proyectadas, macetas) que le pasan los demás módulos en `extras(ctx)`.
import { makeCanvas } from '../../engine/env.js';
import { hash, rng } from '../../engine/noise.js';
import { mixHex, PAL } from '../../engine/color.js';
import { texture } from '../../engine/draw.js';
import { rasterize, shadowLayers } from './util.js';
import { DECK, POOL, COPING, MOSAIC, MARGIN, EDGE_X, SUN, poolPath, poolOutline } from './pool-geo.js';
import { TEAK, STONE, MOSAIC_COLS, SHADE, SHADE_A } from './pool-pal.js';

const PW = 24; // ancho de tabla

function pickMosaic(r) {
  const tot = MOSAIC_COLS.reduce((s, c) => s + c[1], 0);
  let v = r * tot;
  for (const [c, w] of MOSAIC_COLS) { if ((v -= w) <= 0) return c; }
  return MOSAIC_COLS[0][0];
}

function planks(c) {
  const R = rng(311);
  c.fillStyle = TEAK.seam;
  c.fillRect(DECK.x0, DECK.y0, DECK.x1 - DECK.x0, DECK.y1 - DECK.y0);
  for (let x = DECK.x0, col = 0; x < DECK.x1; x += PW, col++) {
    let y = DECK.y0 - R() * 700;
    while (y < DECK.y1) {
      const L = 380 + R() * 520;
      const v = R();
      const base = v < 0.2 ? mixHex(TEAK.base, TEAK.light, 0.35) : v > 0.82 ? mixHex(TEAK.base, TEAK.mid, 0.7) : mixHex(TEAK.base, TEAK.mid, R() * 0.35);
      const x0 = x + 1.1, w = PW - 2.2, y0 = y + 1.4, h = L - 2.8;
      c.fillStyle = base;
      c.fillRect(x0, y0, w, h);
      // bisel: filo de luz del lado del sol (derecha) y sombra del otro
      c.fillStyle = mixHex(base, TEAK.light, 0.55);
      c.fillRect(x0 + w - 2.2, y0, 2.2, h);
      c.fillStyle = mixHex(base, TEAK.dark, 0.45);
      c.fillRect(x0, y0, 1.6, h);
      c.fillStyle = mixHex(base, TEAK.light, 0.4);
      c.fillRect(x0, y0, w, 1.4);
      // veta
      const n = 3 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const gx = x0 + 3 + R() * (w - 6), amp = 0.6 + R() * 1.6, f = 0.006 + R() * 0.01, ph = R() * 9;
        c.strokeStyle = `rgba(110,66,36,${0.12 + R() * 0.16})`;
        c.lineWidth = 0.6 + R() * 1.1;
        c.beginPath();
        for (let yy = y0; yy <= y0 + h; yy += 18) c.lineTo(gx + Math.sin(yy * f + ph) * amp, yy);
        c.stroke();
      }
      // nudo ocasional
      if (R() < 0.18) {
        const kx = x0 + 5 + R() * (w - 10), ky = y0 + 30 + R() * (h - 60);
        c.fillStyle = 'rgba(96,58,32,0.35)';
        c.beginPath(); c.ellipse(kx, ky, 2.6, 7, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(96,58,32,0.2)';
        c.lineWidth = 0.8;
        c.beginPath(); c.ellipse(kx, ky, 4.6, 13, 0, 0, Math.PI * 2); c.stroke();
      }
      // tarugos en las puntas
      c.fillStyle = 'rgba(70,44,28,0.5)';
      for (const yy of [y0 + 9, y0 + h - 9]) { c.beginPath(); c.arc(x0 + w / 2, yy, 1.6, 0, Math.PI * 2); c.fill(); }
      y += L;
    }
  }
  // variación grande (sol, uso) y grano
  for (let k = 0; k < 26; k++) {
    const gx = DECK.x0 + hash(k, 1) * (DECK.x1 - DECK.x0), gy = DECK.y0 + hash(k, 2) * (DECK.y1 - DECK.y0), r = 260 + hash(k, 3) * 420;
    const g = c.createRadialGradient(gx, gy, 0, gx, gy, r);
    const lite = hash(k, 4) > 0.5;
    g.addColorStop(0, lite ? 'rgba(255,236,205,0.10)' : 'rgba(90,52,28,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
}

// banda (anillo) entre d0 y d1 alrededor de la pileta
function ring(d0, d1) {
  const p = poolPath(d1);
  poolPath(d0, p);
  return p;
}

function margin(c) {
  const d0 = COPING + MOSAIC, d1 = d0 + MARGIN;
  c.fillStyle = TEAK.seam;
  c.fill(ring(d0, d1), 'evenodd');
  for (let b = 0; b < 1; b++) {
    const a0 = d0 + b * PW + 1.1, a1 = d0 + (b + 1) * PW - 1.1;
    const base = b ? mixHex(TEAK.base, TEAK.mid, 0.3) : mixHex(TEAK.base, TEAK.light, 0.18);
    c.fillStyle = base;
    c.fill(ring(a0, a1), 'evenodd');
    // filo de luz del lado de afuera arriba/derecha: usar la normal del contorno
    const O = poolOutline((a0 + a1) / 2);
    const n = Math.round(O.total / 6);
    for (let i = 0; i < n; i++) {
      const [x, y, nx, ny] = O.at(i / n);
      const lit = nx * SUN[0] + ny * SUN[1];
      if (Math.abs(lit) < 0.25) continue;
      c.fillStyle = lit > 0 ? `rgba(255,232,196,${0.4 * lit})` : `rgba(90,52,28,${-0.35 * lit})`;
      const e = lit > 0 ? (a1 - a0) / 2 - 1.2 : -(a1 - a0) / 2 + 1.2;
      c.beginPath(); c.arc(x + nx * e, y + ny * e, 1.4, 0, Math.PI * 2); c.fill();
    }
    // juntas cada ~330 px del perímetro
    const m = Math.round(O.total / 330);
    c.strokeStyle = TEAK.seam;
    c.lineWidth = 2.2;
    for (let i = 0; i < m; i++) {
      const [x, y, nx, ny] = O.at((i + b * 0.5) / m);
      const w2 = (a1 - a0) / 2 + 1.2;
      c.beginPath(); c.moveTo(x - nx * w2, y - ny * w2); c.lineTo(x + nx * w2, y + ny * w2); c.stroke();
    }
    // veta siguiendo la curva
    for (let k = 0; k < 3; k++) {
      const O2 = poolOutline(a0 + 4 + k * ((a1 - a0 - 8) / 2));
      c.strokeStyle = `rgba(110,66,36,${0.12 + 0.05 * k})`;
      c.lineWidth = 0.8;
      c.beginPath();
      const nn = Math.round(O2.total / 14);
      for (let i = 0; i <= nn; i++) { const [x, y, nx, ny] = O2.at(i / nn); const w = Math.sin(i * 0.37 + k * 2) * 0.9; c.lineTo(x + nx * w, y + ny * w); }
      c.stroke();
    }
  }
}

function mosaic(c) {
  c.fillStyle = '#C9E3EA';
  c.fill(ring(COPING, COPING + MOSAIC), 'evenodd');
  const rows = 3, ts = MOSAIC / rows;
  const R = rng(77);
  for (let row = 0; row < rows; row++) {
    const d = COPING + ts * (row + 0.5);
    const O = poolOutline(d);
    const n = Math.round(O.total / ts);
    for (let i = 0; i < n; i++) {
      const [x, y, nx, ny] = O.at(i / n);
      // guarda: una ola de teselas oscuras cada tanto + mezcla al azar
      const wave = Math.sin(i * 0.42 + row * 1.3) > 0.82;
      const col = wave ? PAL.navy500 : pickMosaic(R());
      const s = ts - 1.3;
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(ny, nx));
      c.fillStyle = col;
      c.fillRect(-s / 2, -s / 2, s, s);
      // brillo vidriado de cada tesela
      c.fillStyle = 'rgba(255,255,255,0.32)';
      c.fillRect(-s / 2 + 0.8, -s / 2 + 0.8, s * 0.45, s * 0.3);
      c.restore();
    }
  }
}

function coping(c) {
  const p = ring(0, COPING);
  c.fillStyle = STONE.base;
  c.fill(p, 'evenodd');
  // moteado de piedra
  c.save();
  c.clip(p, 'evenodd');
  const R = rng(919);
  for (let i = 0; i < 2600; i++) {
    const x = POOL.x0 - COPING + R() * (POOL.x1 - POOL.x0 + COPING * 2), y = POOL.y0 - COPING + R() * (POOL.y1 - POOL.y0 + COPING * 2);
    c.fillStyle = R() < 0.5 ? 'rgba(169,156,136,0.35)' : 'rgba(255,255,255,0.6)';
    c.fillRect(x, y, 1.3, 1.3);
  }
  c.restore();
  // bullnose: el canto que cae al agua; claro donde mira al sol, sombra donde no
  const O = poolOutline(3.5);
  const n = Math.round(O.total / 3);
  for (let i = 0; i < n; i++) {
    const [x, y, nx, ny] = O.at(i / n);
    const lit = -(nx * SUN[0] + ny * SUN[1]);
    c.fillStyle = lit > 0 ? `rgba(255,255,255,${0.35 + 0.6 * lit})` : `rgba(150,138,118,${-0.75 * lit})`;
    c.beginPath(); c.arc(x, y, 3.4, 0, Math.PI * 2); c.fill();
  }
  // canto exterior y juntas de las lajas
  const O2 = poolOutline(COPING - 1);
  const m = Math.round(O2.total / 118);
  c.strokeStyle = STONE.joint;
  c.lineWidth = 1.6;
  for (let i = 0; i < m; i++) {
    const [x, y, nx, ny] = O2.at(i / m);
    c.beginPath(); c.moveTo(x - nx * (COPING - 6), y - ny * (COPING - 6)); c.lineTo(x + nx * 0.5, y + ny * 0.5); c.stroke();
  }
  c.strokeStyle = 'rgba(120,100,80,0.45)';
  c.lineWidth = 1.4;
  c.stroke(poolPath(COPING));
}

function deckEdge(c) {
  // canaleta de acero pintado y labio del borde
  const x0 = EDGE_X - 40;
  c.fillStyle = '#E9EEF1';
  c.fillRect(x0, DECK.y0, 40, DECK.y1 - DECK.y0);
  c.fillStyle = '#C7D2DA';
  c.fillRect(x0 + 6, DECK.y0, 9, DECK.y1 - DECK.y0);
  c.fillStyle = '#AFBDC8';
  c.fillRect(x0 + 6, DECK.y0, 2, DECK.y1 - DECK.y0);
  c.fillStyle = '#FFFFFF';
  c.fillRect(EDGE_X - 7, DECK.y0, 5, DECK.y1 - DECK.y0);
  c.fillStyle = '#9FB0BE';
  c.fillRect(EDGE_X - 2, DECK.y0, 2, DECK.y1 - DECK.y0);
  // tapas de desagüe
  for (let y = DECK.y0 + 40; y < DECK.y1; y += 230) {
    c.fillStyle = '#B6C3CD';
    c.fillRect(x0 + 5, y, 11, 34);
    c.fillStyle = 'rgba(60,80,100,0.6)';
    for (let k = 0; k < 6; k++) c.fillRect(x0 + 7, y + 4 + k * 5, 7, 2);
  }
}

/**
 * Hornea la cubierta. shadows(soft, sharp) dibuja siluetas de sombra y objects(ctx) lo estático encima (mundo).
 * Devuelve { c, x, y, w, h } para pegar con drawImage(c, x, y, w, h) en el plano h = 0.
 */
export function bakeDeck(shadows, objects, res = 1) {
  const w = DECK.x1 - DECK.x0, h = DECK.y1 - DECK.y0;
  const cv = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
  const c = cv.getContext('2d');
  c.scale(res, res);
  c.translate(-DECK.x0, -DECK.y0);
  planks(c);
  const all = new Path2D();
  all.rect(DECK.x0, DECK.y0, w, h);
  texture(c, all, { alpha: 0.09, blend: 'overlay', scale: 1.2 });
  margin(c);
  mosaic(c);
  coping(c);
  deckEdge(c);
  if (shadows) {
    const L = shadowLayers(Math.ceil(w), Math.ceil(h), DECK.x0, DECK.y0, shadows, SHADE);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = SHADE_A;
    c.drawImage(L.soft, 0, 0);
    c.globalAlpha = SHADE_A * 0.9;
    c.drawImage(L.sharp, 0, 0);
    c.restore();
  }
  if (objects) { c.save(); objects(c); c.restore(); }
  // hueco de la pileta y más allá del borde
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.globalAlpha = 1;
  c.fill(poolPath(0));
  c.fillRect(EDGE_X, DECK.y0 - 10, 400, h + 20);
  c.globalCompositeOperation = 'source-over';
  return { c: rasterize(cv), x: DECK.x0, y: DECK.y0, w, h };
}

