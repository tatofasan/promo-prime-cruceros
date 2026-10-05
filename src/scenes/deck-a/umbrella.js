// Sombrillas a rayas vistas desde arriba (lona a h = 235: crece y se abre desde el centro → parallax).
// 8 paños con sombreado por orientación al sol, domo (más claro al centro), varillas, puntera y volado con flecos
// que flamea (acción secundaria). La lona va en sprite; el volado se dibuja por cuadro.
import { PAL, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { sprite, put, project } from './util.js';
import { SUN, shadowOff } from './pool-geo.js';

export const UMB_R = 80, UMB_H = 230;
const NP = 8;
const SCHEMES = {
  coral: [PAL.coral, '#FFF8EE'],
  navy: [PAL.navy600, '#FFF8EE'],
  cyan: [PAL.brandCyan, '#FFF8EE'],
  gold: [PAL.gold, '#FFF8EE'],
};
const la = Math.atan2(SUN[1], SUN[0]);
const vert = (k, r = UMB_R) => { const a = (k / NP) * TAU - Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; };

function canopy([c1, c2]) {
  return sprite(UMB_R * 2 + 30, UMB_R * 2 + 30, (c) => {
    for (let k = 0; k < NP; k++) {
      const [x0, y0] = vert(k), [x1, y1] = vert(k + 1);
      const mid = ((k + 0.5) / NP) * TAU - Math.PI / 2;
      const lit = Math.cos(mid - la); // paño que mira al sol
      const base = k % 2 ? c2 : c1;
      const col = lit > 0 ? mixHex(base, '#FFFFFF', 0.18 * lit) : mixHex(base, PAL.navy800, -0.24 * lit);
      // borde exterior apenas cóncavo entre varillas
      const cx = Math.cos(mid) * UMB_R * 0.9, cy = Math.sin(mid) * UMB_R * 0.9;
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.closePath();
      const g = c.createRadialGradient(0, 0, 4, 0, 0, UMB_R);
      g.addColorStop(0, mixHex(col, '#FFFFFF', 0.16));
      g.addColorStop(0.75, col);
      g.addColorStop(1, mixHex(col, PAL.navy800, 0.1));
      c.fillStyle = g;
      c.fill();
    }
    // varillas (filo claro + sombra)
    for (let k = 0; k < NP; k++) {
      const [x, y] = vert(k);
      c.strokeStyle = 'rgba(20,30,50,0.22)';
      c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(x * 0.99, y * 0.99); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0.8, -0.8); c.lineTo(x * 0.99 + 0.8, y * 0.99 - 0.8); c.stroke();
    }
    // brillo del lado del sol y puntera
    const g2 = c.createRadialGradient(Math.cos(la) * 34, Math.sin(la) * 34, 2, Math.cos(la) * 34, Math.sin(la) * 34, 46);
    g2.addColorStop(0, 'rgba(255,255,255,0.32)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g2;
    c.beginPath(); c.arc(0, 0, UMB_R, 0, TAU); c.fill();
    c.fillStyle = 'rgba(20,30,50,0.3)';
    c.beginPath(); c.arc(-SUN[0] * 2, -SUN[1] * 2, 8.5, 0, TAU); c.fill();
    c.fillStyle = '#F4F0E8';
    c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.arc(SUN[0] * 2.4, SUN[1] * 2.4, 3, 0, TAU); c.fill();
  }, 1.6);
}

let SPR = null;
export function initUmbrellas() {
  if (SPR) return;
  SPR = {};
  for (const k in SCHEMES) SPR[k] = canopy(SCHEMES[k]);
}

/** Siluetas de sombra (horneadas): lona (capa suave) y palo (capa nítida) sobre un plano a altura h0. */
export function umbrellaShadow(soft, sharp, u, h0 = 0) {
  const [ox, oy] = shadowOff(UMB_H, h0), [bx, by] = shadowOff(0, h0);
  soft.beginPath();
  for (let k = 0; k <= NP; k++) {
    const [x, y] = vert(k, UMB_R * 1.02);
    if (k) soft.lineTo(u.x + ox + x, u.y + oy + y); else soft.moveTo(u.x + ox + x, u.y + oy + y);
  }
  soft.fill();
  if (!sharp) return;
  sharp.lineWidth = 5;
  sharp.beginPath(); sharp.moveTo(u.x + bx, u.y + by); sharp.lineTo(u.x + ox * 0.9, u.y + oy * 0.9); sharp.stroke();
}

/** Base de la sombrilla (objeto en la cubierta). */
export function umbrellaBase(c, u) {
  c.fillStyle = 'rgba(10,30,60,0.3)';
  c.beginPath(); c.arc(u.x - 4, u.y + 5, 15, 0, TAU); c.fill();
  c.fillStyle = '#C9D2DA';
  c.beginPath(); c.arc(u.x, u.y, 13, 0, TAU); c.fill();
  c.fillStyle = '#EEF2F5';
  c.beginPath(); c.arc(u.x + 2, u.y - 2, 9, 0, TAU); c.fill();
}

/** Lona por cuadro (con flameo del volado). */
export function drawUmbrella(ctx, C, t, u) {
  const [x, y, k] = project(C, u.x, u.y, UMB_H);
  if (x < -300 || x > 2220 || y < -300 || y > 1380) return;
  const sway = 0.025 * Math.sin(t * 1.7 + u.x * 0.01) + 0.012 * Math.sin(t * 4.1 + u.y);
  put(ctx, SPR[u.scheme], x, y, { r: sway + C.r + (u.rot ?? 0), s: k });
  // volado: semicírculos en el borde que flamean
  const [c1, c2] = SCHEMES[u.scheme];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway + C.r + (u.rot ?? 0));
  ctx.scale(k, k);
  for (let i = 0; i < NP * 3; i++) {
    const seg = Math.floor(i / 3);
    const a = ((i + 0.5) / (NP * 3)) * TAU - Math.PI / 2;
    const fl = 1 + 0.22 * Math.sin(t * 9 + i * 1.3 + u.x);
    const rr = UMB_R * (0.9 + 0.07 * Math.cos(((i % 3) - 1) * 0.9));
    ctx.fillStyle = seg % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, 6 * fl, 4.4, a, 0, Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
