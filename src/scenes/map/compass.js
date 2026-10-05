// Rosa de los vientos sutil grabada en el océano (Atlántico sur): aros con marcas, estrella de 8 puntas con
// cada punta partida en luz/sombra (3 tonos) y el norte dorado. Gira apenas; en el látigo da una vuelta entera.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, TAU } from '../../engine/ease.js';
import { T, applyCam } from './mapcam.js';

const C = { x: -330, y: 640, r: 74 };

export function drawCompass(ctx, cam, t, { alpha = 1 } = {}) {
  // da una vuelta entera con el látigo (vuelve a quedar al norte) y se sacude al abrirse la red
  const wob = t > T.all ? 0.35 * Math.exp(-(t - T.all) * 5) * Math.sin((t - T.all) * 16) : 0;
  const spin = 0.05 * Math.sin(t * 0.7) + E.inOutCubic(prog(t, T.whip - 0.05, T.whip + 0.55)) * TAU + wob;
  ctx.save();
  applyCam(ctx, cam);
  ctx.translate(C.x, C.y);
  ctx.globalAlpha *= alpha;
  const px = 1 / cam.z;
  // aros y marcas
  ctx.strokeStyle = rgba(PAL.aqua200, 0.32);
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath(); ctx.arc(0, 0, C.r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, C.r * 0.86, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.aqua200, 0.22);
  ctx.beginPath(); ctx.arc(0, 0, C.r * 0.42, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.rotate(spin);
  ctx.strokeStyle = rgba(PAL.aqua200, 0.38);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU, long = i % 9 === 0;
    const r0 = C.r * (long ? 0.8 : 0.88);
    ctx.lineWidth = (long ? 1.6 : 1) * px;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * C.r * 0.98, Math.sin(a) * C.r * 0.98); ctx.stroke();
  }
  // estrella: 4 puntas largas y 4 cortas, cada una mitad luz / mitad sombra
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const L = i % 2 ? C.r * 0.56 : C.r * 1.08, w = i % 2 ? C.r * 0.1 : C.r * 0.15;
    ctx.save();
    ctx.rotate(a);
    const north = i === 0;
    ctx.fillStyle = north ? rgba(PAL.gold, 0.85) : rgba(PAL.aqua200, i % 2 ? 0.3 : 0.42);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.lineTo(w, -w); ctx.closePath(); ctx.fill();
    ctx.fillStyle = north ? rgba(PAL.coral, 0.75) : rgba(PAL.navy900, i % 2 ? 0.35 : 0.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.lineTo(w, w); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = rgba(PAL.goldPale, 0.8);
  ctx.beginPath(); ctx.arc(0, 0, C.r * 0.05, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}
