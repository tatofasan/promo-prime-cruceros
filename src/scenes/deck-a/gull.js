// Gaviota vista desde ARRIBA que cruza alto (h ≈ 1100: parallax fuerte) con su sombra sobre la cubierta y el agua.
// Detalle de segunda mirada: alas con punta oscura, filo de luz del lado del sol y aleteo (la envergadura se acorta).
import { PAL, mixHex } from '../../engine/color.js';
import { TAU, E, prog } from '../../engine/ease.js';
import { project } from './util.js';
import { SUN, shadowOff } from './pool-geo.js';

const H = 1100;
const T_A = 6.5, T_B = 7.3;
const P0 = [600, 975], P1 = [1380, 330];

function at(t) {
  const u = prog(t, T_A, T_B);
  const e = E.inOutSine(u) * 0.35 + u * 0.65;
  return { x: P0[0] + (P1[0] - P0[0]) * e, y: P0[1] + (P1[1] - P0[1]) * e + Math.sin(u * 5) * 30, u };
}

function silhouette(c, flap, R) {
  const span = R * (0.78 + 0.22 * Math.cos(flap));
  const sweep = R * 0.18;
  c.beginPath();
  // ala izquierda, cuerpo, ala derecha (cabeza hacia +x)
  c.moveTo(R * 0.34, 0);
  c.quadraticCurveTo(R * 0.2, -R * 0.08, R * 0.05, -R * 0.1);
  c.quadraticCurveTo(0, -span * 0.55, -sweep, -span);
  c.quadraticCurveTo(-sweep * 0.4, -span * 0.5, -R * 0.12, -R * 0.08);
  c.lineTo(-R * 0.42, -R * 0.06);
  c.lineTo(-R * 0.36, 0);
  c.lineTo(-R * 0.42, R * 0.06);
  c.lineTo(-R * 0.12, R * 0.08);
  c.quadraticCurveTo(-sweep * 0.4, span * 0.5, -sweep, span);
  c.quadraticCurveTo(0, span * 0.55, R * 0.05, R * 0.1);
  c.quadraticCurveTo(R * 0.2, R * 0.08, R * 0.34, 0);
  c.closePath();
  return span;
}

/** Sombra de la gaviota en la cubierta (antes de los objetos altos). */
export function gullShadow(ctx, C, t) {
  if (t < T_A || t > T_B) return;
  const g = at(t);
  const [ox, oy] = shadowOff(H);
  const [x, y, k] = project(C, g.x + ox, g.y + oy, 0);
  const a = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a + C.r);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(16,44,82,0.2)';
  silhouette(ctx, t * 9, 46);
  ctx.fill();
  ctx.restore();
}

/** La gaviota (bien arriba de todo, salvo los primeros planos). */
export function drawGull(ctx, C, t) {
  if (t < T_A || t > T_B) return;
  const g = at(t);
  if ((C.A ?? 3000) - H < 400) return;
  const [x, y, k] = project(C, g.x, g.y, H);
  if (x < -200 || x > 2120 || y < -200 || y > 1280) return;
  const a = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]);
  const flap = t * 9 + Math.sin(t * 2) * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a + C.r);
  ctx.scale(k, k);
  const R = 46;
  // cuerpo y alas (blanco cálido), sombra plana del lado contrario al sol, puntas negras
  ctx.fillStyle = mixHex('#FFFFFF', PAL.grey300, 0.25);
  const span = silhouette(ctx, flap, R);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const la = Math.atan2(SUN[1], SUN[0]) - a - C.r;
  ctx.fillStyle = mixHex(PAL.grey400, PAL.navy600, 0.25);
  ctx.translate(Math.cos(la) * 5, Math.sin(la) * 5);
  silhouette(ctx, flap, R);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PAL.grey900;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(-R * 0.17, s * span * 0.93, R * 0.07, R * 0.12, 0.3 * s, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.moveTo(R * 0.34, -R * 0.025); ctx.lineTo(R * 0.44, 0); ctx.lineTo(R * 0.34, R * 0.025); ctx.fill();
  ctx.restore();
}
