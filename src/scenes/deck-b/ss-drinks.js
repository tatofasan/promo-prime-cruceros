// Mesita con dos tragos tropicales a contraluz (primer plano): un hurricane con degradé «sunrise» (granadina →
// coral → dorado), rodaja de naranja, cereza y sombrillita; y un trago azul alto con limón y sombrillita dorada.
// El líquido brilla, el vidrio tiene cantos encendidos y gotitas, y la luz que los atraviesa tiñe la mesa.
// Coordenadas locales: tapa de la mesa en y = 0, centro en x = 0.
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { lin, rad, sparkle, smoothPath } from '../../engine/draw.js';
import { TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { grain } from './grain.js';

const HUR = [[5, 4.5], [20, 4.5], [24, 11], [32, 21], [44, 26], [58, 23], [72, 19], [90, 21], [110, 26], [128, 30], [142, 32]];
const TALL = [[0, 19], [10, 19], [11, 17.5], [136, 21.5]];
const C = {
  wood: mixHex(mixHex(PAL.navy900, '#4A2418', 0.45), PAL.dusk, 0.2),
  woodShade: mixHex(PAL.ink, '#2A1210', 0.3),
  rim: PAL.goldLight,
  grenadine: mixHex(PAL.coral, '#9E1838', 0.55),
  lagoonDeep: PAL.ocean600,
};

function glassPath(prof, smooth) {
  const R = prof.map(([h, w]) => [w, -h]);
  const Lp = prof.map(([h, w]) => [-w, -h]).reverse();
  const p = new Path2D();
  if (smooth) {
    p.moveTo(R[0][0], R[0][1]);
    smoothPath([...R, ...Lp], true, 0.5, p);
  } else {
    [...R, ...Lp].forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
  }
  return p;
}

let G = null;
function build() {
  G = { hur: glassPath(HUR, true), tall: glassPath(TALL, false) };
  const top = new Path2D();
  top.ellipse(0, 0, 118, 18, 0, 0, TAU);
  G.top = top;
  const edge = new Path2D();
  edge.moveTo(-118, 0);
  edge.ellipse(0, 0, 118, 18, 0, Math.PI, 0, true);
  edge.lineTo(118, 12);
  edge.ellipse(0, 12, 118, 18, 0, 0, Math.PI, false);
  edge.closePath();
  G.edge = edge;
  const ped = new Path2D();
  ped.moveTo(-10, 20); ped.lineTo(10, 20); ped.lineTo(13, 300); ped.lineTo(-13, 300); ped.closePath();
  ped.ellipse(0, 302, 70, 12, 0, 0, TAU);
  G.ped = ped;
}
export function initDrinks() { if (!G) build(); }

/** Sombrillita de papel: palito de (x0,y0) a (x1,y1); el techito perpendicular, con paneles traslúcidos. */
function umbrella(ctx, x0, y0, x1, y1, cols, open = 1) {
  ctx.strokeStyle = mixHex(PAL.goldLight, PAL.navy900, 0.25);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(a + Math.PI / 2);
  // techito visto de costado: triángulo bajo con borde festoneado, paneles alternados
  const w = 40 * open, h = 18;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const xa = -w + 2 * w * u0, xb = -w + 2 * w * u1;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(xa, 0);
    ctx.quadraticCurveTo((xa + xb) / 2, 5, xb, 0);
    ctx.closePath();
    ctx.fill();
  }
  // luz que lo atraviesa (lado de arriba) y nervaduras
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, 0, -h, 0, 4, [[0, rgba(PAL.goldPale, 0.5)], [1, rgba(PAL.goldPale, 0)]]);
  ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(-w, 0); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(PAL.navy900, 0.35);
  ctx.lineWidth = 1;
  for (let i = 1; i < n; i++) { const xx = -w + (2 * w * i) / n; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(xx, 0); ctx.stroke(); }
  ctx.fillStyle = PAL.goldPale;
  ctx.beginPath(); ctx.arc(0, -h - 1, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

function straw(ctx, x0, y0, x1, y1, a, b) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(ang);
  ctx.fillStyle = a;
  ctx.fillRect(0, -2.6, len, 5.2);
  ctx.fillStyle = b;
  for (let s = 4; s < len; s += 12) { ctx.beginPath(); ctx.moveTo(s, -2.6); ctx.lineTo(s + 6, -2.6); ctx.lineTo(s + 3, 2.6); ctx.lineTo(s - 3, 2.6); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = rgba(PAL.white, 0.5);
  ctx.fillRect(0, -2.6, len, 1.1);
  ctx.restore();
}

function citrus(ctx, x, y, r, rind, flesh, line) {
  ctx.fillStyle = rind;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = flesh;
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.stroke(); }
  ctx.fillStyle = rgba(PAL.white, 0.5);
  ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fill();
}

/** Vidrio con líquido: path, nivel (h), degradé de abajo a arriba, hielo y gotitas. */
function glass(ctx, t, path, level, height, stops, seed) {
  // vidrio vacío apenas teñido
  ctx.fillStyle = rgba(PAL.peach, 0.14);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = lin(ctx, 0, 0, 0, -level, stops);
  ctx.fillRect(-60, -level, 120, level + 2);
  // menisco y superficie que brilla
  ctx.fillStyle = rgba(PAL.white, 0.85);
  ctx.fillRect(-60, -level - 1, 120, 2);
  // hielo
  for (let i = 0; i < 3; i++) {
    const ix = -14 + i * 13 + 3 * Math.sin(t * 1.3 + i + seed), iy = -level + 4 + (i % 2) * 14;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(0.3 * i + 0.1 * Math.sin(t + i));
    ctx.fillStyle = rgba(PAL.white, 0.28);
    ctx.fillRect(-8, -8, 16, 15);
    ctx.fillStyle = rgba(PAL.white, 0.55);
    ctx.fillRect(-8, -8, 16, 2.2);
    ctx.restore();
  }
  // burbujitas que suben
  ctx.fillStyle = rgba(PAL.white, 0.5);
  for (let i = 0; i < 7; i++) {
    const ph = ((t * (0.5 + hash(i, seed) * 0.6) + hash(i, seed, 2)) % 1);
    const by = -18 - ph * (level - 24), bx = -12 + hash(i, seed, 3) * 24 + Math.sin(t * 4 + i) * 1.5;
    ctx.beginPath(); ctx.arc(bx, by, 1 + hash(i, seed, 4) * 1.2, 0, TAU); ctx.fill();
  }
  // brillo especular vertical del lado del sol y canto opuesto
  ctx.fillStyle = lin(ctx, 0, 0, 0, -height, [[0, rgba(PAL.white, 0)], [0.5, rgba(PAL.white, 0.4)], [1, rgba(PAL.white, 0.1)]]);
  ctx.fillRect(9, -height, 4, height);
  ctx.fillStyle = rgba(PAL.goldPale, 0.25);
  ctx.fillRect(-16, -height, 2.5, height);
  ctx.restore();
  ctx.strokeStyle = rgba(PAL.goldPale, 0.75);
  ctx.lineWidth = 1.6;
  ctx.stroke(path);
  // gotitas de condensación
  ctx.fillStyle = rgba(PAL.white, 0.55);
  for (let i = 0; i < 9; i++) {
    const gy = -12 - hash(i, seed, 7) * (height - 30), gx = -16 + hash(i, seed, 8) * 32;
    ctx.beginPath(); ctx.arc(gx, gy, 0.9 + hash(i, seed, 9) * 1.3, 0, TAU); ctx.fill();
  }
}

/**
 * Mesita con los dos tragos en (x, y) = centro de la tapa, escala k. light = vector hacia el sol (pantalla).
 * pulse 0..1 = destello en el beat; kick 0..1 = sacudón (las sombrillitas se mecen).
 */
export function drawTableDrinks(ctx, t, x, y, k, light, { pulse = 0, kick = 0 } = {}) {
  if (!G) build();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  // pie y canto de la mesa (contraluz), tapa con brillo del lado del sol
  ctx.fillStyle = C.woodShade;
  ctx.fill(G.ped);
  ctx.fillStyle = rgba(C.rim, 0.75);
  ctx.fillRect(9, 24, 2.4, 272);
  ctx.fillStyle = C.wood;
  ctx.fill(G.edge);
  ctx.fillStyle = lin(ctx, 0, -18, 0, 18, [[0, mixHex(C.wood, PAL.coral, 0.45)], [0.5, C.wood], [1, C.woodShade]]);
  ctx.fill(G.top);
  grain(ctx, G.top, { alpha: 0.12 });
  ctx.save();
  ctx.clip(G.top);
  ctx.fillStyle = rgba(C.rim, 0.9);
  ctx.beginPath(); ctx.ellipse(0, 2.5, 118, 18, 0, Math.PI, 0, false); ctx.ellipse(0, 0, 118, 18, 0, 0, Math.PI, true); ctx.fill();
  // la luz que atraviesa los tragos tiñe la tapa (manchas de color hacia cámara)
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, -40, 8, 46, [[0, rgba(PAL.coral, 0.55)], [1, rgba(PAL.coral, 0)]]);
  ctx.fillRect(-90, -12, 100, 40);
  ctx.fillStyle = rad(ctx, 56, 8, 40, [[0, rgba(PAL.aqua300, 0.5)], [1, rgba(PAL.aqua300, 0)]]);
  ctx.fillRect(10, -12, 100, 40);
  ctx.restore();

  const wob = (ph) => 0.05 * Math.sin(t * 3.1 + ph) + 0.12 * kick * Math.sin(t * 14 + ph);
  // ---- trago azul (atrás a la derecha)
  ctx.save();
  ctx.translate(54, -4);
  ctx.save(); ctx.rotate(wob(2)); umbrella(ctx, 4, -96, 30, -204, [PAL.gold, PAL.aqua300, PAL.goldPale]); ctx.restore();
  straw(ctx, -4, -100, -18, -180, PAL.brandCyan, PAL.white);
  glass(ctx, t, G.tall, 118, 136, [[0, C.lagoonDeep], [0.45, PAL.ocean400], [0.8, PAL.aqua300], [1, PAL.aqua100]], 2);
  citrus(ctx, -22, -138, 15, PAL.goldLight, PAL.goldPale, rgba(PAL.gold, 0.85));
  ctx.restore();
  // ---- hurricane (adelante a la izquierda)
  ctx.save();
  ctx.translate(-44, -2);
  ctx.save(); ctx.rotate(wob(0)); umbrella(ctx, -6, -100, -36, -206, [PAL.coral, PAL.warmWhite, PAL.aqua300]); ctx.restore();
  straw(ctx, 8, -110, 24, -188, PAL.warmWhite, PAL.coral);
  ctx.fillStyle = C.woodShade;
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 4.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.goldPale, 0.7); ctx.lineWidth = 1.4; ctx.stroke();
  glass(ctx, t, G.hur, 126, 142, [[0, C.grenadine], [0.3, PAL.coral], [0.62, PAL.gold], [1, PAL.goldPale]], 1);
  citrus(ctx, 30, -146, 17, mixHex(PAL.coral, PAL.gold, 0.45), PAL.goldLight, rgba(PAL.coral, 0.75));
  // cereza en su palito
  ctx.strokeStyle = mixHex(PAL.navy900, PAL.coral, 0.4); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-16, -150); ctx.quadraticCurveTo(-12, -166, -4, -170); ctx.stroke();
  ctx.fillStyle = mixHex(PAL.coral, '#7A0E26', 0.55);
  ctx.beginPath(); ctx.arc(-16, -147, 6.5, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(PAL.white, 0.7);
  ctx.beginPath(); ctx.arc(-18, -150, 1.8, 0, TAU); ctx.fill();
  ctx.restore();

  // resplandor de los líquidos y destellos de los bordes (laten en el beat)
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, -44, -80, 90, [[0, rgba(PAL.gold, 0.22 + 0.15 * pulse)], [1, rgba(PAL.gold, 0)]]);
  ctx.fillRect(-140, -180, 200, 200);
  ctx.fillStyle = rad(ctx, 54, -70, 80, [[0, rgba(PAL.aqua200, 0.18 + 0.12 * pulse)], [1, rgba(PAL.aqua200, 0)]]);
  ctx.fillRect(-30, -160, 170, 180);
  ctx.globalCompositeOperation = 'source-over';
  sparkle(ctx, -44 + 30, -144, 10 + 12 * pulse, { color: PAL.white, alpha: 0.85, halo: 0.6 });
  sparkle(ctx, 54 - 20, -140, 8 + 10 * pulse, { color: PAL.white, alpha: 0.8, halo: 0.6 });
  sparkle(ctx, -44 - 31, -142, 6 + 6 * pulse, { color: PAL.goldPale, alpha: 0.7, halo: 0.5 });
  ctx.restore();
  void light;
}
