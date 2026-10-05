// Gaviotas: silueta en «M» articulada (brazo + mano) que aletea con ráfagas y planeos, cuerpo con cabeza y
// pico dorado, 3 tonos (dorso gris, panza blanca a contraluz, puntas oscuras). En atardecer/dusk pasan a
// silueta navy con filo cálido. Todo función de t: cada gaviota cruza su área y vuelve a entrar.
import { TAU, clamp } from '../engine/ease.js';
import { hash, noise1 } from '../engine/noise.js';
import { PAL, mixHex } from '../engine/color.js';
import { resolve } from './presets.js';
import { ca } from './util.js';

/**
 * drawGulls(ctx, t, { count, area, seed, scale, preset, silhouette, dir, speed, alpha })
 *  - area: { x, y, w, h } donde vuelan (def. franja alta del cuadro)
 *  - scale: tamaño (1 ≈ 110 px de envergadura) · dir: 1 → derecha, −1 → izquierda, 0 = mezcla
 *  - silhouette: true/false (def. automático en sunset/dusk/night)
 */
export function drawGulls(ctx, t, o = {}) {
  const P = resolve(o.preset ?? 'golden');
  const area = o.area ?? { x: 0, y: 120, w: 1920, h: 300 };
  const n = o.count ?? 5;
  const seed = o.seed ?? 3;
  const scale = o.scale ?? 1;
  const sil = o.silhouette ?? ['sunset', 'dusk', 'night'].includes(P.name);
  const L = P.sky.light;
  const col = sil
    ? { top: mixHex(PAL.navy900, PAL.dusk, 0.25), under: mixHex(PAL.navy800, PAL.dusk, 0.3), tip: PAL.ink, body: mixHex(PAL.navy900, PAL.dusk, 0.2), rim: L.rim, beak: mixHex(PAL.gold, PAL.navy900, 0.5) }
    : { top: mixHex(PAL.grey300, L.shade, 0.3), under: mixHex('#ffffff', L.key, 0.25), tip: PAL.grey900, body: '#ffffff', rim: mixHex('#ffffff', L.rim, 0.5), beak: PAL.gold };
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => hash(a, seed, 4) - hash(b, seed, 4)); // las chicas (lejos) primero
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  for (const i of order) {
    const s = scale * (0.45 + 0.6 * hash(i, seed, 4));
    const d = o.dir ?? 0;
    const dirI = d !== 0 ? d : hash(i, seed, 5) < 0.5 ? 1 : -1;
    const v = (o.speed ?? 1) * (50 + 60 * hash(i, seed, 6)) * s * dirI;
    const span = area.w + 300 * s;
    let x = area.x - 150 * s + ((hash(i, seed, 7) * span + v * t) % span + span) % span;
    const y = area.y + hash(i, seed, 8) * area.h + Math.sin(t * (0.8 + hash(i, seed, 9)) + i) * 10 * s;
    // aleteo con ráfagas: amplitud por ruido (planea cuando baja)
    const burst = clamp(0.5 + 1.4 * noise1(t * 0.55 + i * 3.1, seed + 11));
    const ph = t * TAU * (2.6 + 0.9 * hash(i, seed, 10)) + i * 1.9;
    const flap = Math.sin(ph) * burst;
    const bob = -Math.cos(ph) * burst * 3 * s;
    gull(ctx, x, y + bob, 55 * s, flap, dirI, col, sil, Math.sin(t * 0.7 + i) * 0.08);
  }
  ctx.restore();
}

/**
 * Una gaviota en (x, y) en vista «M» de 3/4 (desde abajo, la cabeza hacia donde va): `R` = media envergadura,
 * aleteo f ∈ [−1, 1] (1 = alas arriba en V, −1 = alas abajo en Λ), dir ±1.
 */
export function gull(ctx, x, y, R, f, dir, col, sil, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * dir);
  ctx.scale(dir, 1);
  // ala del lado de atrás (un poco más chica: 3/4), cuerpo, ala del lado de adelante
  wing(ctx, R * 0.86, f, -1, col, sil);
  body(ctx, R, col, sil, f);
  wing(ctx, R, f, 1, col, sil);
  ctx.restore();
}

function wing(ctx, R, f, side, col, sil) {
  const u = f; // −1..1
  const S = [side * R * 0.07, -R * 0.02];
  const E = [side * R * 0.46, -R * (0.12 + 0.38 * u)];
  const T = [side * R * 1.0, -R * (0.02 + 0.5 * u) + R * 0.2 * (1 - Math.abs(u)) + R * 0.12];
  const ch = R * 0.17; // cuerda del ala (ancho)
  const pth = new Path2D();
  pth.moveTo(S[0], S[1]);
  pth.quadraticCurveTo((S[0] + E[0]) / 2, Math.min(S[1], E[1]) - R * 0.07, E[0], E[1]);
  pth.quadraticCurveTo((E[0] + T[0]) / 2, (E[1] + T[1]) / 2 - R * 0.05, T[0], T[1]);
  pth.quadraticCurveTo((E[0] + T[0]) / 2 + side * R * 0.02, (E[1] + T[1]) / 2 + ch * 0.55, E[0] - side * R * 0.02, E[1] + ch);
  pth.quadraticCurveTo((S[0] + E[0]) / 2, Math.max(S[1], E[1]) + ch * 0.9, S[0] - side * R * 0.02, S[1] + ch * 1.15);
  pth.closePath();
  ctx.fillStyle = side < 0 ? mixHex(col.under, col.top, 0.35) : col.under;
  ctx.fill(pth);
  ctx.save();
  ctx.clip(pth);
  // mitad de atrás del ala en sombra plana (tono 2) y punta oscura (tono 3)
  ctx.fillStyle = col.top;
  ctx.beginPath();
  ctx.moveTo(S[0], S[1] + ch * 0.55);
  ctx.quadraticCurveTo((S[0] + E[0]) / 2, Math.max(S[1], E[1]) + ch * 0.35, E[0], E[1] + ch * 0.5);
  ctx.lineTo(T[0], T[1] + ch * 0.2);
  ctx.lineTo(T[0] + side * R, T[1] + R);
  ctx.lineTo(S[0], S[1] + R);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col.tip;
  ctx.beginPath(); ctx.arc(T[0], T[1], R * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
  // filo de luz en el borde de ataque
  ctx.strokeStyle = ca(col.rim, sil ? 0.85 : 0.9);
  ctx.lineWidth = Math.max(0.6, R * 0.03);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S[0], S[1]);
  ctx.quadraticCurveTo((S[0] + E[0]) / 2, Math.min(S[1], E[1]) - R * 0.07, E[0], E[1]);
  ctx.quadraticCurveTo((E[0] + T[0]) / 2, (E[1] + T[1]) / 2 - R * 0.05, E[0] + (T[0] - E[0]) * 0.75, E[1] + (T[1] - E[1]) * 0.75);
  ctx.stroke();
}

function body(ctx, R, col, sil, f) {
  // cuerpo corto visto de 3/4 (la cabeza hacia +x), pico dorado, cola
  ctx.fillStyle = col.body;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.04, R * 0.2, R * 0.085, -0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(R * 0.2, -R * 0.0, R * 0.075, 0, TAU);
  ctx.fill();
  ctx.fillStyle = sil ? col.body : col.top;
  ctx.beginPath();
  ctx.moveTo(-R * 0.16, R * 0.04); ctx.lineTo(-R * 0.3, R * 0.02); ctx.lineTo(-R * 0.28, R * 0.1); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = sil ? ca(PAL.ink, 0.5) : ca(col.top, 0.5);
  ctx.beginPath();
  ctx.ellipse(-R * 0.01, R * 0.08, R * 0.16, R * 0.035, -0.08, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = col.beak;
  ctx.beginPath();
  ctx.moveTo(R * 0.26, -R * 0.03); ctx.lineTo(R * 0.38, R * 0.0); ctx.lineTo(R * 0.26, R * 0.02); ctx.closePath();
  ctx.fill();
  if (!sil && R > 20) {
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(R * 0.22, -R * 0.025, R * 0.016, 0, TAU); ctx.fill();
  }
}
