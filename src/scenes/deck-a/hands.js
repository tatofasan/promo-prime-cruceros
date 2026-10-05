// Brazos y manos (vista cenital, a escala real de la copa) que toman la copa por el tallo: puño suelto que envuelve
// el tallo, dorso con nudillos y tendones, pulgar con uña, muñeca y manga. Sombreado plano de 3 tonos hacia la vela.
//   'a' = nosotros: manga de camisa blanca arremangada con gemelo dorado
//   'b' = la pareja: brazo desnudo, pulsera dorada, uñas coral y vestido coral
import { TAU } from '../../engine/ease.js';
import { project, hullPath, lightAng } from './util.js';
import { blob, tone3 } from './shape.js';

const SKIN = {
  a: { base: '#F0B48F', dark: '#CF8D6C', light: '#FFDCC4', line: 'rgba(160,85,60,0.4)', nail: 'rgba(255,228,214,0.95)' },
  b: { base: '#C27C57', dark: '#9C5C3E', light: '#E8AE86', line: 'rgba(85,38,22,0.4)', nail: '#FF6B4A' },
};

function capsule(x0, y0, x1, y1, r) {
  return (ox = 0, oy = 0, into = null) => {
    const p = into || new Path2D();
    const a = Math.atan2(y1 - y0, x1 - x0);
    p.moveTo(x1 + ox + Math.cos(a + Math.PI / 2) * r, y1 + oy + Math.sin(a + Math.PI / 2) * r);
    p.arc(x1 + ox, y1 + oy, r, a + Math.PI / 2, a - Math.PI / 2, true);
    p.arc(x0 + ox, y0 + oy, r, a - Math.PI / 2, a + Math.PI / 2, true);
    p.closePath();
    return p;
  };
}

/** Tramo de brazo en pantalla con bandas planas de luz y sombra paralelas al eje. */
function limb(ctx, P0, r0, P1, r1, col, lv) {
  const hull = hullPath(P0[0], P0[1], r0, P1[0], P1[1], r1);
  ctx.fillStyle = col.base;
  ctx.fill(hull);
  ctx.save();
  ctx.clip(hull);
  const ax = P1[0] - P0[0], ay = P1[1] - P0[1], d = Math.hypot(ax, ay) || 1;
  let nx = -ay / d, ny = ax / d;
  if (nx * lv[0] + ny * lv[1] < 0) { nx = -nx; ny = -ny; }
  const band = (f0, f1, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(P0[0] + nx * r0 * f0 - (ax / d) * r0, P0[1] + ny * r0 * f0 - (ay / d) * r0);
    ctx.lineTo(P1[0] + nx * r1 * f0 + (ax / d) * r1, P1[1] + ny * r1 * f0 + (ay / d) * r1);
    ctx.lineTo(P1[0] + nx * r1 * f1 + (ax / d) * r1, P1[1] + ny * r1 * f1 + (ay / d) * r1);
    ctx.lineTo(P0[0] + nx * r0 * f1 - (ax / d) * r0, P0[1] + ny * r0 * f1 - (ay / d) * r0);
    ctx.closePath();
    ctx.fill();
  };
  band(-0.5, -3, col.dark);
  band(0.52, 0.78, col.light);
  ctx.restore();
  return { nx, ny, ax: ax / d, ay: ay / d };
}

/**
 * o = { x, y, h (punto del tallo donde agarra), dir (ángulo en planta hacia el hombro), who, alpha, grip 0..1 }
 */
export function drawArm(ctx, C, o) {
  const { x, y, h, dir, who = 'a', alpha = 1, grip = 1 } = o;
  if (alpha <= 0.01) return;
  const sk = SKIN[who];
  const cd = Math.cos(dir), sd = Math.sin(dir);
  const at = (s, dh) => project(C, x + cd * s, y + sd * s, h + dh);
  const la = lightAng(x, y) + C.r;
  const lv = [Math.cos(la), Math.sin(la)];
  const [hx, hy, hk] = at(0, 0);
  const W0 = at(140, 14), W1 = at(470, 250);
  ctx.save();
  ctx.globalAlpha *= alpha;
  // antebrazo y manga
  if (who === 'a') {
    const shirt = { base: '#3D5679', dark: '#27395A', light: '#7896C0' };
    const C0 = at(160, 20);
    limb(ctx, [W0[0], W0[1]], 34 * W0[2], [C0[0], C0[1]], 35 * C0[2], sk, lv);
    const SL = at(184, 26);
    const g = limb(ctx, [SL[0], SL[1]], 44 * SL[2], [W1[0], W1[1]], 58 * W1[2], shirt, lv);
    // pliegues de la manga
    ctx.save();
    ctx.clip(hullPath(SL[0], SL[1], 44 * SL[2], W1[0], W1[1], 58 * W1[2]));
    ctx.strokeStyle = 'rgba(14,26,48,0.55)';
    ctx.lineWidth = 2.4 * C0[2];
    ctx.lineCap = 'round';
    for (const f of [0.14, 0.33, 0.52, 0.7]) {
      const px = SL[0] + (W1[0] - SL[0]) * f, py = SL[1] + (W1[1] - SL[1]) * f, r = (44 + 14 * f) * SL[2];
      ctx.beginPath();
      ctx.moveTo(px - g.nx * r * 0.9, py - g.ny * r * 0.9);
      ctx.quadraticCurveTo(px + g.ax * r * 0.35, py + g.ay * r * 0.35, px + g.nx * r * 0.3, py + g.ny * r * 0.3);
      ctx.stroke();
    }
    ctx.restore();
    // puño con gemelo dorado
    const C1 = at(186, 25);
    limb(ctx, [C0[0], C0[1]], 38 * C0[2], [C1[0], C1[1]], 39 * C1[2], { base: '#EDE5D8', dark: '#BFB19C', light: '#FFFFFF' }, lv);
    const mx = (C0[0] + C1[0]) / 2 + g.nx * 26 * C0[2], my = (C0[1] + C1[1]) / 2 + g.ny * 26 * C0[2];
    ctx.fillStyle = '#C8932F';
    ctx.beginPath(); ctx.arc(mx, my, 7.5 * C0[2], 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFE39C';
    ctx.beginPath(); ctx.arc(mx + lv[0] * 2.5, my + lv[1] * 2.5, 3.2 * C0[2], 0, TAU); ctx.fill();
  } else {
    const S0 = at(330, 160);
    limb(ctx, [W0[0], W0[1]], 32 * W0[2], [S0[0], S0[1]], 44 * S0[2], sk, lv);
    const dress = { base: '#FF6B4A', dark: '#C9432B', light: '#FFA88C' };
    limb(ctx, [S0[0], S0[1]], 50 * S0[2], [W1[0], W1[1]], 62 * W1[2], dress, lv);
    // pulsera dorada
    const B = at(182, 30);
    const ang = Math.atan2(W1[1] - W0[1], W1[0] - W0[0]);
    ctx.strokeStyle = '#C8932F';
    ctx.lineWidth = 11 * B[2];
    ctx.beginPath(); ctx.ellipse(B[0], B[1], 12 * B[2], 38 * B[2], ang, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#FFE39C';
    ctx.lineWidth = 3.5 * B[2];
    ctx.beginPath(); ctx.ellipse(B[0], B[1], 12 * B[2], 38 * B[2], ang, la - ang - 1.2, la - ang + 0.6); ctx.stroke();
  }
  // mano en su plano: x hacia la muñeca
  const ax = Math.atan2(W0[1] - hy, W0[0] - hx);
  ctx.translate(hx, hy);
  ctx.rotate(ax);
  ctx.scale(hk, hk);
  const ll = la - ax;
  const L = [Math.cos(ll), Math.sin(ll)];
  const side = who === 'a' ? 1 : -1;
  const T3 = { base: sk.base, dark: sk.dark, light: sk.light, L };
  // dedos curvados que envuelven el tallo
  const open = (1 - grip) * 22;
  for (let k = 0; k < 4; k++) {
    const yy = (-36 + k * 23) * side;
    tone3(ctx, capsule(18, yy, -26 + open - Math.abs(k - 1.5) * 3, yy * 0.95, 13 - Math.abs(k - 1.5) * 0.8), { ...T3, dd: 4, dl: 2.5 });
  }
  // dorso de la mano
  const back = blob([[2, -48 * side], [40, -54 * side], [92, -46 * side], [136, -34 * side], [146, 0], [136, 34 * side], [92, 44 * side], [40, 52 * side], [4, 48 * side], [-8, 0]]);
  tone3(ctx, back, { ...T3, dd: 8, dl: 4 });
  // nudillos y tendones
  ctx.strokeStyle = sk.line;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const yy = (-36 + k * 23) * side;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(14, yy, 7, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.globalAlpha *= 0.45;
    ctx.beginPath(); ctx.moveTo(30, yy * 0.95); ctx.quadraticCurveTo(70, yy * 0.7, 118, yy * 0.35); ctx.stroke();
    ctx.globalAlpha /= 0.45;
  }
  ctx.fillStyle = 'rgba(255,240,230,0.35)';
  for (let k = 0; k < 4; k++) {
    const yy = (-36 + k * 23) * side;
    ctx.beginPath(); ctx.ellipse(16 + L[0] * 3, yy + L[1] * 3, 5, 7, 0, 0, TAU); ctx.fill();
  }
  // pulgar del lado de cerca, con uña
  const th = capsule(96, 46 * side, 10, 64 * side, 15);
  tone3(ctx, th, { ...T3, dd: 4, dl: 2.5 });
  ctx.strokeStyle = sk.line;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(48, 56 * side, 9, Math.PI * 0.6, Math.PI * 1.3); ctx.stroke();
  ctx.fillStyle = sk.nail;
  ctx.beginPath(); ctx.ellipse(10, 64 * side, 8, 7, 0.15 * side, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(8 + L[0] * 2, 64 * side + L[1] * 2, 3, 2.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
