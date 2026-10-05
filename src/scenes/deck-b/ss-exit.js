// Salida del atardecer (exp.out → corte a map): golpe de empuje y después empuje E.inExpo hacia el sol. El cielo
// cálido llena el cuadro (coral, naranja y dusk saturado); lo único que se oscurece es una viñeta radial fuerte
// en los BORDES (navy700 con tinte dusk y halo coral), el centro sigue cálido: es el puente con el pin de map.
// Estrías radiales de velocidad durante el empuje y, encima de todo, el disco liso que se satura de coral a
// naranja de marca. En el último cuadro: disco naranja liso en (960, 520) r = 120.
import { W, H } from '../../engine/time.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { E, clamp, smoothstep, TAU } from '../../engine/ease.js';
import { rad } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { T_OUT, T_KICK, TL, sunFlat } from './ss-time.js';

const EDGE = mixHex(PAL.navy700, PAL.dusk, 0.38);
const MID = mixHex(PAL.dusk, PAL.coral, 0.45);

/** Viñeta de salida: solo los bordes; el centro queda cálido (nunca negro ni gris alrededor del disco). */
export function drawExitVignette(ctx, t, x, y, r) {
  const a = E.inOutSine(clamp((t - T_OUT) / (TL - T_OUT)));
  if (a <= 0.003) return;
  const R = Math.hypot(W, H) * 0.56;
  const k = (v) => clamp(v / R);
  ctx.save();
  // tinte cálido saturado del medio (sube el coral alrededor del sol mientras el cielo lo llena)
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = rad(ctx, x, y, R, [[0, rgba(PAL.coral, 0)], [k(r * 1.3), rgba(PAL.coral, 0.25 * a)], [k(r * 3.2), rgba(PAL.brandOrange, 0.35 * a)], [1, rgba(PAL.dusk, 0.4 * a)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rad(ctx, x, y, R, [
    [0, rgba(MID, 0)],
    [Math.max(k(r * 2.2), 0.3), rgba(MID, 0)],
    [0.5, rgba(MID, 0.3 * a)],
    [0.72, rgba(EDGE, 0.64 * a)],
    [1, rgba(EDGE, 0.92 * a)],
  ]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Estrías radiales de velocidad durante el empuje (salen del sol hacia afuera). */
export function drawPushStreaks(ctx, t, x, y, r) {
  const k = clamp((t - T_KICK + 0.06) / (TL - T_KICK + 0.06));
  const s = Math.min(1, E.inQuad(k) * 1.8) * (1 - clamp((t - (TL - 0.02)) / 0.02));
  // un latigazo corto de estrías en el golpe
  const hit = t >= T_OUT ? Math.exp(-(t - T_OUT) / 0.08) * (t < T_OUT + 0.25 ? 1 : 0) : 0;
  const S = Math.max(s, 0.8 * hit);
  if (S <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + hash(i, 5) * 0.12;
    const ph = (hash(i, 6) + k * (2.4 + hash(i, 7) * 1.4)) % 1;
    const d0 = r * 1.25 + ph * 900;
    const len = (40 + 260 * hash(i, 8)) * S * (0.4 + ph);
    const c = i % 3 ? PAL.coralLight : PAL.goldLight;
    ctx.strokeStyle = rgba(c, 0.5 * S * (1 - ph * 0.6));
    ctx.lineWidth = 1.5 + 3 * hash(i, 9) * ph;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0);
    ctx.lineTo(x + Math.cos(a) * (d0 + len), y + Math.sin(a) * (d0 + len));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * El disco liso que vira del blanco dorado del sol a coral y a naranja de marca, OPACO todo el tiempo (entra
 * con el mismo color del núcleo del sol, así el cambio no se nota) con su halo coral. Se dibuja en el mundo,
 * justo después del sol: lo que está delante (la pareja) lo sigue tapando.
 */
export function drawFlatDisc(ctx, t, x, y, r) {
  const flat = sunFlat(t);
  if (flat <= 0.002) return;
  const col = flat < 0.4 ? mixHex(PAL.goldPale, PAL.coral, E.inOutSine(flat / 0.4)) : mixHex(PAL.coral, PAL.brandOrange, E.inOutSine((flat - 0.4) / 0.6));
  ctx.save();
  const halo = 0.5 * Math.min(1, flat * 1.6);
  if (halo > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const R = r * 3.2;
    ctx.fillStyle = rad(ctx, x, y, r * 0.98, x, y, R, [[0, rgba(PAL.coral, halo)], [0.3, rgba(PAL.coral, halo * 0.35)], [1, rgba(PAL.coral, 0)]]);
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha *= smoothstep(0, 0.12, flat);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
