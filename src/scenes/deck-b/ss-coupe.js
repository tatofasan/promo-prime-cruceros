// Copa coupé de cóctel a contraluz, tomada del tallo: el líquido brilla (degradé cálido que se mantiene nivelado
// y chapotea después del choque), cantos del vidrio encendidos, rodaja de cítrico translúcida y destello del borde.
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { lin, rad, sparkle } from '../../engine/draw.js';
import { T_CHEERS } from './ss-time.js';

let BOWL = null;
function bowl() {
  if (BOWL) return BOWL;
  BOWL = new Path2D();
  BOWL.moveTo(-19, -31);
  BOWL.bezierCurveTo(-18, -16, -8, -12, 0, -12);
  BOWL.bezierCurveTo(8, -12, 18, -16, 19, -31);
  BOWL.closePath();
  return BOWL;
}

/** (hx, hy) = mano en el tallo · ang = inclinación · who 1 (ella) / −1 (él) · glint 0..1 (destello del choque). */
export function drawCoupe(ctx, t, hx, hy, ang, who, glint) {
  const B = bowl();
  // resplandor del trago (a contraluz el líquido brilla)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, hx, hy - 24, 50, [[0, rgba(PAL.gold, 0.3 * (1 + glint))], [1, rgba(PAL.gold, 0)]]);
  ctx.fillRect(hx - 50, hy - 74, 100, 100);
  ctx.restore();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  // squash & stretch del choque: la copa se aplasta contra la otra (desde el tallo) y rebota
  const d = t - T_CHEERS;
  const sq = d < 0 ? 0 : 0.2 * Math.exp(-d / 0.06) * Math.cos(d * TAU * 7);
  if (Math.abs(sq) > 0.002) { ctx.translate(0, 13); ctx.scale(1 + sq, 1 - sq * 0.75); ctx.translate(0, -13); }
  // contorno oscuro (contraluz): así la copa se lee también delante del sol
  ctx.strokeStyle = rgba(PAL.navy900, 0.7);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke(B);
  ctx.fillStyle = rgba(PAL.navy900, 0.7);
  ctx.fillRect(-2.6, -12, 5.2, 25);
  ctx.beginPath();
  ctx.ellipse(0, 13.5, 14, 4, 0, 0, TAU);
  ctx.fill();
  // líquido nivelado: contra-rota y chapotea después del choque
  const slosh = t < T_CHEERS ? 0 : 0.35 * Math.exp(-(t - T_CHEERS) / 0.22) * Math.sin((t - T_CHEERS) * TAU * 3.1);
  ctx.save();
  ctx.clip(B);
  ctx.fillStyle = rgba(PAL.peach, 0.22);
  ctx.fillRect(-20, -32, 40, 22);
  ctx.translate(0, -25);
  ctx.rotate(-ang * 0.85 + slosh * who);
  const liq = who === 1 ? [PAL.goldLight, PAL.gold, PAL.coral, mixHex(PAL.coral, PAL.navy900, 0.35)] : [PAL.goldLight, PAL.coralLight, PAL.sunsetPink, mixHex(PAL.sunsetPink, PAL.navy900, 0.4)];
  ctx.fillStyle = lin(ctx, 0, 0, 0, 15, [[0, liq[0]], [0.3, liq[1]], [0.7, liq[2]], [1, liq[3]]]);
  ctx.fillRect(-30, 0, 60, 30);
  ctx.fillStyle = rgba(PAL.white, 0.9);
  ctx.fillRect(-30, -0.6, 60, 1.6);
  ctx.restore();
  // cantos del vidrio
  ctx.strokeStyle = rgba(PAL.goldPale, 0.85);
  ctx.lineWidth = 1.3;
  ctx.stroke(B);
  ctx.strokeStyle = rgba(PAL.white, 0.9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-19, -31); ctx.lineTo(19, -31);
  ctx.stroke();
  // tallo y pie
  ctx.fillStyle = rgba(PAL.goldPale, 0.6);
  ctx.fillRect(-1.2, -12, 2.4, 25);
  ctx.beginPath();
  ctx.ellipse(0, 13.5, 12, 2.6, 0, 0, TAU);
  ctx.fill();
  // rodaja de cítrico en el borde de afuera (translúcida a contraluz)
  const gx = who === 1 ? -15 : 15;
  ctx.fillStyle = mixHex(PAL.gold, PAL.coral, 0.3);
  ctx.beginPath(); ctx.arc(gx, -33, 7.5, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(PAL.goldPale, 0.92);
  ctx.beginPath(); ctx.arc(gx, -33, 5.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.gold, 0.9);
  ctx.lineWidth = 0.9;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.beginPath(); ctx.moveTo(gx, -33); ctx.lineTo(gx + Math.cos(a) * 5.5, -33 + Math.sin(a) * 5.5); ctx.stroke(); }
  ctx.restore();
  // destello del borde que mira al otro (late y explota en el choque)
  const lx = who === 1 ? 17 : -17, ly = -31;
  const rx = hx + Math.cos(ang) * lx - Math.sin(ang) * ly, ry = hy + Math.sin(ang) * lx + Math.cos(ang) * ly;
  sparkle(ctx, rx, ry, 8 + 12 * glint + 2.5 * Math.sin(t * 7 + who), { color: PAL.white, alpha: 0.65 + 0.35 * glint, halo: 0.7 });
}
