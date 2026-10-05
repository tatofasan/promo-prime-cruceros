// Reloj de pared redondo. La esfera se hornea con la pared; las agujas van en vivo: el minutero ACELERA
// durante todo el gancho (el día laboral pasa volando: 9 → 17 h) y el segundero hace tic-tac en corcheas con
// rebote. Cuando el minutero gira muy rápido, deja una estela rotacional (smear).
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, rad, fill, circlePath } from '../../engine/draw.js';
import { TAU, clamp, spring } from '../../engine/ease.js';
import { BEAT } from '../../engine/time.js';
import { CLOCK } from './layout.js';
import { shadowOnly } from './util.js';

const { x: CX, y: CY, r: R } = CLOCK;
const HAND = mixHex(PAL.grey900, PAL.ink, 0.35);

export function paintClockFace(g) {
  shadowOnly(g, 1.1, circlePath(CX, CY, R), { dx: 12, dy: 15, blur: 22, color: rgba(PAL.ink, 0.55) });
  // aro de plástico oscuro con filo de luz arriba a la izquierda
  fill(g, circlePath(CX, CY, R), lin(g, CX - R, CY - R, CX + R, CY + R, [PAL.grey700, PAL.grey900, mixHex(PAL.grey900, PAL.ink, 0.5)]));
  g.save();
  g.strokeStyle = rgba(PAL.grey300, 0.7); g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.arc(CX, CY, R - 1.5, Math.PI * 1.02, Math.PI * 1.62); g.stroke();
  g.restore();
  // bisel metálico
  fill(g, circlePath(CX, CY, R - 8), lin(g, CX - R, CY - R, CX + R, CY + R, [PAL.grey200, PAL.grey400, PAL.grey600]));
  // esfera (cóncava: más oscura en el borde, sombra del aro arriba)
  fill(g, circlePath(CX, CY, R - 13), rad(g, CX - 14, CY - 18, R, [[0, mixHex(PAL.grey200, PAL.white, 0.25)], [0.7, PAL.grey200], [1, PAL.grey300]]));
  fill(g, circlePath(CX, CY, R - 13), rad(g, CX + 5, CY + 8, R - 13, [[0.82, rgba(PAL.ink, 0)], [1, rgba(PAL.ink, 0.22)]]));
  // marcas: 60 finas y 12 gruesas (sin números)
  g.save();
  g.translate(CX, CY);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const major = i % 5 === 0;
    const r0 = major ? R - 30 : R - 22, r1 = R - 17;
    g.strokeStyle = major ? HAND : rgba(PAL.grey600, 0.8);
    g.lineWidth = major ? (i % 15 === 0 ? 5.5 : 4) : 1.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
    g.stroke();
  }
  g.restore();
}

/** Vueltas del minutero desde las 9:00 (acelera: cúbica). */
export const minuteTurns = (t) => 0.5 * t + 0.165 * t * t * t;
const minuteSpeed = (t) => 0.5 + 3 * 0.165 * t * t;

/** Segundero: un tic por corchea, cada vez más largo, con rebote al clavarse. */
function secondAngle(t) {
  const e = BEAT / 2;
  const n = Math.floor(t / e);
  const step = (i) => (6 + 4.5 * i) * (Math.PI / 180);
  let base = 0;
  for (let i = 0; i < n; i++) base += step(i);
  const k = spring(t - n * e, 0, { from: 0, to: 1, freq: 9, damp: 22 });
  return base + step(n) * clamp(k, 0, 1.25);
}

function hand(ctx, a, len, tail, w0, w1, color) {
  ctx.save();
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-w0 / 2, tail);
  ctx.lineTo(-w1 / 2, -len + w1 / 2);
  ctx.arc(0, -len + w1 / 2, w1 / 2, Math.PI, 0);
  ctx.lineTo(w0 / 2, tail);
  ctx.arc(0, tail, w0 / 2, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Agujas, eje y vidrio en t. shake = temblor en px (el sacudón del final). */
export function drawClock(ctx, t, { shake = 0 } = {}) {
  const m = minuteTurns(t) * TAU;
  const h = ((9 + minuteTurns(t)) / 12) * TAU;
  const s = secondAngle(t);
  const w = minuteSpeed(t);
  ctx.save();
  ctx.translate(CX + shake * 0.6, CY + shake * 0.3);
  // estela rotacional del minutero cuando va rápido
  if (w > 0.9) {
    const spread = Math.min(1.6, (w / 60) * TAU * 2.2);
    const n = 9;
    for (let k = n; k >= 1; k--) {
      const a = m - (k / n) * spread;
      ctx.globalAlpha = 0.28 * (1 - k / (n + 1)) * clamp((w - 0.9) / 2);
      hand(ctx, a, 60, 10, 6, 3, HAND);
    }
    ctx.globalAlpha = 1;
  }
  // sombras de las agujas sobre la esfera
  ctx.save();
  ctx.translate(3, 4);
  hand(ctx, h, 38, 9, 9, 6, rgba(PAL.ink, 0.25));
  hand(ctx, m, 60, 10, 6, 3, rgba(PAL.ink, 0.25));
  hand(ctx, s, 62, 18, 2.2, 1.6, rgba(PAL.ink, 0.2));
  ctx.restore();
  hand(ctx, h, 38, 9, 9, 6, HAND);
  hand(ctx, m, 60, 10, 6, 3, HAND);
  hand(ctx, s, 62, 18, 2.2, 1.6, mixHex(PAL.grey600, PAL.grey700, 0.5));
  ctx.save();
  ctx.rotate(s);
  fill(ctx, circlePath(0, 12, 4.5), mixHex(PAL.grey600, PAL.grey700, 0.5));
  ctx.restore();
  fill(ctx, circlePath(0, 0, 6.5), HAND);
  fill(ctx, circlePath(-1.5, -1.5, 2.2), PAL.grey400);
  // vidrio: reflejo en arco y brillo
  ctx.strokeStyle = rgba(PAL.white, 0.2); ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R - 26, Math.PI * 1.1, Math.PI * 1.38); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.white, 0.12); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, R - 20, Math.PI * 0.08, Math.PI * 0.3); ctx.stroke();
  ctx.restore();
}
