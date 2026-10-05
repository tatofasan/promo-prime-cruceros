// Reposeras con toallas a rayas y objetos (se hornean en la cubierta): marco de aluminio con 3 tonos, lona con
// costuras, respaldo levantado con su sombra, toalla con pliegues y flecos, ruedas, ojotas, sombrero, libro,
// mesita con trago. Algunas con gente tomando sol. Sombras largas hacia abajo a la izquierda.
import { PAL, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { rrectPath } from '../../engine/draw.js';
import { tone3, blob } from './shape.js';
import { drawFigure } from './figure.js';
import { drawDrink } from './float.js';
import { SUN, shadowOff } from './pool-geo.js';
import { METAL, SKIN, HAIR } from './pool-pal.js';

const LW = 64, LL = 184;
const rr = (x, y, w, h, r) => (ox = 0, oy = 0, into = null) => {
  const p = into || new Path2D();
  const q = rrectPath(x + ox, y + oy, w, h, r);
  if (!into) return q;
  p.moveTo(x + ox + r, y + oy);
  p.arcTo(x + ox + w, y + oy, x + ox + w, y + oy + h, r);
  p.arcTo(x + ox + w, y + oy + h, x + ox, y + oy + h, r);
  p.arcTo(x + ox, y + oy + h, x + ox, y + oy, r);
  p.arcTo(x + ox, y + oy, x + ox + w, y + oy, r);
  p.closePath();
  return p;
};
const rotL = (a) => [SUN[0] * Math.cos(-a) - SUN[1] * Math.sin(-a), SUN[0] * Math.sin(-a) + SUN[1] * Math.cos(-a)];

/** Silueta de la sombra de la reposera (capa nítida: va baja) sobre la cubierta. */
export function loungerShadow(c, L) {
  c.save();
  c.translate(L.x, L.y);
  c.rotate(L.rot);
  // cuerpo bajo (h ≈ 34) y respaldo levantado (h ≈ 70)
  const [ax, ay] = rotV(shadowOff(34), -L.rot), [bx, by] = rotV(shadowOff(72), -L.rot);
  c.fill(rrectPath(-LW / 2 + ax, -LL / 2 + 60 + ay, LW, LL - 60, 10));
  c.fill(rrectPath(-LW / 2 + bx, -LL / 2 + by, LW, 66, 10));
  c.restore();
}
const rotV = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * Reposera en (L.x, L.y) rotada L.rot (cabecera hacia −y local).
 * L = { x, y, rot, cushion, towel: [c1, c2], person?: {...figura}, props: ['hat','book','glasses','flip','drink','phone'] }
 */
export function drawLounger(c, Lo) {
  const L = rotL(Lo.rot);
  c.save();
  c.translate(Lo.x, Lo.y);
  c.rotate(Lo.rot);
  // ruedas a los pies
  for (const s of [-1, 1]) {
    c.fillStyle = '#5D6B78';
    c.beginPath(); c.ellipse(s * (LW / 2 + 1), LL / 2 - 10, 4, 8, 0, 0, TAU); c.fill();
  }
  // marco de aluminio
  tone3(c, rr(-LW / 2, -LL / 2, LW, LL, 11), { base: METAL.base, dark: METAL.dark, light: METAL.light, L, dd: 3, dl: 1.6 });
  // lona del asiento (tramo bajo) con costuras
  const cu = Lo.cushion ?? PAL.navy600;
  tone3(c, rr(-LW / 2 + 6, -LL / 2 + 66, LW - 12, LL - 74, 7), { base: cu, dark: mixHex(cu, '#000000', 0.28), light: mixHex(cu, '#ffffff', 0.22), L, dd: 3, dl: 1.5 });
  c.strokeStyle = mixHex(cu, '#000000', 0.25);
  c.lineWidth = 1;
  for (let y = -LL / 2 + 84; y < LL / 2 - 12; y += 17) { c.beginPath(); c.moveTo(-LW / 2 + 8, y); c.lineTo(LW / 2 - 8, y); c.stroke(); }
  // respaldo levantado: sombra sobre el asiento y panel
  c.fillStyle = 'rgba(10,30,60,0.35)';
  c.fillRect(-LW / 2 + 6, -LL / 2 + 62, LW - 12, 12);
  tone3(c, rr(-LW / 2 + 3, -LL / 2 + 2, LW - 6, 64, 8), { base: mixHex(cu, '#ffffff', 0.06), dark: mixHex(cu, '#000000', 0.3), light: mixHex(cu, '#ffffff', 0.3), L, dd: 3.4, dl: 1.8 });
  c.strokeStyle = mixHex(cu, '#000000', 0.25);
  for (let y = -LL / 2 + 16; y < -LL / 2 + 64; y += 15) { c.beginPath(); c.moveTo(-LW / 2 + 8, y); c.lineTo(LW / 2 - 8, y); c.stroke(); }
  // almohadón
  tone3(c, rr(-LW / 2 + 9, -LL / 2 + 7, LW - 18, 22, 9), { base: '#FBF8F2', dark: '#C9CFD6', light: '#FFFFFF', L, dd: 2.6, dl: 1.4 });
  // toalla a rayas con pliegues (cae un poco por los pies)
  if (Lo.towel) towel(c, Lo.towel, L, Lo.towelOff ?? 0);
  if (Lo.person) {
    c.save();
    c.translate(0, 18);
    c.scale(0.98, 0.98);
    drawFigure(c, { L, ...Lo.person });
    c.restore();
  }
  for (const p of Lo.props ?? []) prop(c, p, L);
  c.restore();
}

function towel(c, [c1, c2], L, off) {
  const x0 = -LW / 2 + 5, w = LW - 10, y0 = -LL / 2 + 24 + off, h = LL - 8 - off;
  c.save();
  const path = blob([[x0, y0], [x0 + w * 0.5, y0 - 2], [x0 + w, y0], [x0 + w + 1, y0 + h * 0.5], [x0 + w + 3, y0 + h], [x0 + w * 0.5, y0 + h + 4], [x0 - 3, y0 + h], [x0 - 1, y0 + h * 0.5]]);
  const P = path(0, 0);
  // sombra de la toalla
  c.fillStyle = 'rgba(10,30,60,0.25)';
  c.save(); c.translate(-L[0] * 2.5, -L[1] * 2.5); c.fill(P); c.restore();
  c.fillStyle = c1;
  c.fill(P);
  c.clip(P);
  c.fillStyle = c2;
  for (let y = y0 - 10; y < y0 + h + 10; y += 22) c.fillRect(x0 - 6, y, w + 12, 11);
  // pliegues: bandas de sombra y luz
  const g = c.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(20,30,60,0.22)'); g.addColorStop(0.2, 'rgba(255,255,255,0.12)'); g.addColorStop(0.42, 'rgba(20,30,60,0.12)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(20,30,60,0.2)');
  c.fillStyle = g;
  c.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
  c.restore();
  // flecos
  c.strokeStyle = c2 === '#FFFFFF' ? '#F3EEE6' : c2;
  c.lineWidth = 1.2;
  for (let x = x0; x <= x0 + w; x += 4) { c.beginPath(); c.moveTo(x, y0 + h + 1); c.lineTo(x + 0.5, y0 + h + 6); c.stroke(); }
}

/** Objeto suelto (sombrero, libro, anteojos, ojotas, mesita con trago, celular) en coordenadas actuales. */
export function drawProp(c, p, L = SUN) {
  return prop(c, p, L);
}

function prop(c, p, L) {
  const [kind, x, y, r = 0] = p;
  c.save();
  c.translate(x, y);
  c.rotate(r);
  if (kind === 'hat') {
    c.fillStyle = 'rgba(10,30,60,0.28)';
    c.beginPath(); c.arc(-L[0] * 4, -L[1] * 4, 24, 0, TAU); c.fill();
    tone3(c, (ox = 0, oy = 0, into) => { const q = into || new Path2D(); q.moveTo(ox + 23, oy); q.arc(ox, oy, 23, 0, TAU); return q; }, { base: '#F2D9A2', dark: '#CDAE72', light: '#FFF1CF', L, dd: 3, dl: 1.6 });
    c.strokeStyle = 'rgba(160,120,60,0.35)';
    c.lineWidth = 0.8;
    for (let k = 9; k < 22; k += 3.2) { c.beginPath(); c.arc(0, 0, k, 0, TAU); c.stroke(); }
    tone3(c, (ox = 0, oy = 0, into) => { const q = into || new Path2D(); q.moveTo(ox + 12, oy); q.arc(ox, oy, 12, 0, TAU); return q; }, { base: '#F7E3B5', dark: '#D7BB82', light: '#FFF6DE', L, dd: 3, dl: 1.5 });
    c.strokeStyle = PAL.coral;
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 12.5, 0, TAU); c.stroke();
  } else if (kind === 'book') {
    c.fillStyle = 'rgba(10,30,60,0.25)';
    c.fillRect(-18 - L[0] * 2, -12 - L[1] * 2, 36, 26);
    c.fillStyle = PAL.brandCyan;
    c.fillRect(-19, -13, 38, 26);
    c.fillStyle = '#FBF8F2';
    c.fillRect(-17, -11.5, 16.5, 23); c.fillRect(0.5, -11.5, 16.5, 23);
    c.fillStyle = 'rgba(80,90,100,0.35)';
    for (let k = 0; k < 6; k++) { c.fillRect(-15, -8 + k * 3.4, 12, 1); c.fillRect(2.5, -8 + k * 3.4, 12, 1); }
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(-1.2, -11.5, 2.4, 23);
  } else if (kind === 'glasses') {
    c.fillStyle = PAL.navy900;
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 6, 0, 5, 3.8, 0, 0, TAU); c.fill(); }
    c.strokeStyle = PAL.gold; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-1, -1); c.lineTo(1, -1); c.moveTo(-11, 0); c.lineTo(-14, 7); c.moveTo(11, 0); c.lineTo(14, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 6 + 1.5, -1.2, 1.4, 0.8, -0.4, 0, TAU); c.fill(); }
  } else if (kind === 'flip') {
    for (const s of [-1, 1]) {
      c.fillStyle = 'rgba(10,30,60,0.25)';
      c.beginPath(); c.ellipse(s * 8 - L[0] * 2, -L[1] * 2, 6.5, 14, s * 0.12, 0, TAU); c.fill();
      c.fillStyle = s < 0 ? PAL.coral : PAL.gold;
      c.beginPath(); c.ellipse(s * 8, 0, 6.5, 14, s * 0.12, 0, TAU); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(s * 8, -7); c.lineTo(s * 8 - 5, 1); c.moveTo(s * 8, -7); c.lineTo(s * 8 + 5, 1); c.stroke();
    }
  } else if (kind === 'drink') {
    // mesita redonda con trago
    c.fillStyle = 'rgba(10,30,60,0.3)';
    c.beginPath(); c.arc(-L[0] * 16, -L[1] * 16, 22, 0, TAU); c.fill();
    tone3(c, (ox = 0, oy = 0, into) => { const q = into || new Path2D(); q.moveTo(ox + 22, oy); q.arc(ox, oy, 22, 0, TAU); return q; }, { base: '#F6F8FA', dark: '#BAC6D0', light: '#FFFFFF', L, dd: 3, dl: 1.4 });
    c.translate(-3, 2);
    drawDrink(c, 1.25, 0);
  } else if (kind === 'phone') {
    c.fillStyle = 'rgba(10,30,60,0.3)';
    c.fillRect(-6 - L[0] * 2, -11 - L[1] * 2, 12, 22);
    c.fillStyle = PAL.navy900;
    c.fillRect(-6, -11, 12, 22);
    c.fillStyle = '#2C6FA0';
    c.fillRect(-5, -9.5, 10, 19);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(-5, -9.5, 4, 19);
  }
  c.restore();
}

export const LOUNGER_SIZE = { w: LW, l: LL };
export { SKIN, HAIR };
