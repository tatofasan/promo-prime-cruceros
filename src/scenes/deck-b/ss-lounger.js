// Reposeras acolchadas en primer plano, de perfil y a contraluz (enmarcan las esquinas de abajo): colchoneta
// gruesa a rayas con filo de luz, respaldo alto con toalla enrollada, toalla que cuelga por atrás, marco de caño,
// patas con ruedita y sombra de contacto. Se diseñan mirando a la derecha (respaldo a la izquierda), piso y = 0.
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { lin } from '../../engine/draw.js';
import { TAU } from '../../engine/ease.js';
import { addSmooth, addCapsule, addEllipse, silhouette } from './ss-geom.js';
import { grain } from './grain.js';

const C = {
  pad: mixHex(PAL.navy900, PAL.dusk, 0.42),
  padShade: mixHex(PAL.ink, PAL.dusk, 0.15),
  stripe: mixHex(PAL.coral, PAL.dusk, 0.55),
  frame: mixHex(PAL.ink, PAL.dusk, 0.2),
  rim: PAL.goldLight,
  towel: mixHex(PAL.warmWhite, PAL.dusk, 0.6),
  towelStripe: mixHex(PAL.brandCyan, PAL.dusk, 0.55),
};

let G = null;
// respaldo a 50°: eje u desde la bisagra y normal n hacia la cara de apoyo (arriba-derecha)
const U = [-Math.cos(0.873), -Math.sin(0.873)], N = [Math.sin(0.873), -Math.cos(0.873)];
function build() {
  // colchoneta: asiento + respaldo en una sola pieza (40 px de espesor)
  const b0 = [140, -125], b1 = [b0[0] + U[0] * 250, b0[1] + U[1] * 250];
  const f0 = [b0[0] + N[0] * 40, b0[1] + N[1] * 40], f1 = [b1[0] + N[0] * 40, b1[1] + N[1] * 40];
  const pad = new Path2D();
  addSmooth(pad, [[f0[0] + 6, -158], [380, -159], [600, -158], [613, -138], [600, -118], [380, -117], [152, -117], b0, [b0[0] + U[0] * 125, b0[1] + U[1] * 125], b1, [b1[0] + N[0] * 20 + U[0] * 6, b1[1] + N[1] * 20 + U[1] * 6], f1, [f0[0] + U[0] * 125, f0[1] + U[1] * 125], f0], 0.3);
  // marco: larguero, patas, puntal del respaldo y ruedita
  const frame = new Path2D();
  addCapsule(frame, 120, -110, 7, 612, -110, 7);
  addCapsule(frame, 160, -110, 6.5, 150, -14, 6);
  addCapsule(frame, 565, -110, 6.5, 580, -2, 6);
  addCapsule(frame, 240, -110, 5, b0[0] + U[0] * 160, b0[1] + U[1] * 160, 5);
  addEllipse(frame, 150, -11, 12, 12);
  // toalla doblada sobre el respaldo: abraza el borde de arriba y cae por atrás
  const towel = new Path2D();
  const p = (u, v) => [b0[0] + U[0] * u + N[0] * v, b0[1] + U[1] * u + N[1] * v];
  addSmooth(towel, [p(150, 46), p(262, 44), p(268, 14), p(262, -10), p(190, -14), p(120, -22), p(96, -10), p(180, -4), p(240, 2), p(244, 30), p(160, 34)], 0.4);
  G = { pad, frame, towel, b0, ang: Math.atan2(U[1], U[0]) };
}
export function initLoungers() { if (!G) build(); }

/**
 * Una reposera con la base en (x, y) (piso), escala k, dir 1 (respaldo a la izquierda) o −1, light = vector
 * unitario hacia el sol en pantalla.
 */
export function drawLounger(ctx, t, x, y, k, dir, light) {
  if (!G) build();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * dir, k);
  const L = [light[0] * dir, light[1]];
  // sombra de contacto (el sol está atrás: se estira hacia cámara)
  ctx.fillStyle = lin(ctx, 0, -10, 0, 60, [[0, rgba(PAL.ink, 0.6)], [1, rgba(PAL.ink, 0)]]);
  ctx.beginPath();
  ctx.ellipse(330, 10, 360, 44, 0, 0, TAU);
  ctx.fill();
  silhouette(ctx, G.frame, L, { base: C.frame, shade: PAL.ink, rim: C.rim, rimW: 2.2, shadeW: 4 });
  silhouette(ctx, G.pad, L, { base: C.pad, shade: C.padShade, rim: C.rim, rimW: 3, shadeW: 9 });
  // rayas de la colchoneta (sin tapar el filo) y costura
  ctx.save();
  ctx.clip(G.pad);
  ctx.translate(-L[0] * 3, -L[1] * 3);
  ctx.clip(G.pad);
  ctx.translate(L[0] * 3, L[1] * 3);
  ctx.fillStyle = rgba(C.stripe, 0.85);
  for (let i = 0; i < 16; i++) ctx.fillRect(176 + i * 28, -162, 12, 48);
  ctx.save();
  ctx.translate(G.b0[0], G.b0[1]);
  ctx.rotate(G.ang);
  for (let i = 0; i < 10; i++) ctx.fillRect(10 + i * 28, -50, 12, 60);
  ctx.restore();
  ctx.strokeStyle = rgba(PAL.ink, 0.35);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(180, -138); ctx.lineTo(600, -138); ctx.stroke();
  ctx.setLineDash([]);
  grain(ctx, null, { alpha: 0.1 });
  ctx.restore();
  silhouette(ctx, G.towel, L, { base: C.towel, shade: mixHex(C.towel, PAL.ink, 0.45), rim: C.rim, rimW: 2.2, shadeW: 6 });
  ctx.save();
  ctx.clip(G.towel);
  ctx.translate(G.b0[0], G.b0[1]);
  ctx.rotate(G.ang);
  ctx.fillStyle = rgba(C.towelStripe, 0.75);
  ctx.fillRect(100, -40, 180, 9);
  ctx.fillRect(100, -6, 180, 6);
  ctx.restore();
  ctx.restore();
}
