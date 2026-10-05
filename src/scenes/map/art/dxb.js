// Postal DUBÁI: skyline a la hora dorada con el Burj Khalifa escalonado (luz dorada a la izquierda, sombra
// dusk a la derecha), el Burj Al Arab como vela, torres con ventanitas, reflejos en el Golfo y un dhow.
// 280 × 184.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { sparkle } from '../../../engine/draw.js';
import { hash } from '../../../engine/noise.js';
import { AW, AH, sky, sunGlow, gull, poly } from './kit.js';

const LIT = PAL.goldPale, MID = mixHex(PAL.dusk, PAL.coral, 0.25), DARK = mixHex(PAL.navy600, PAL.dusk, 0.45);

// torres medias: x, ancho, alto, remate (0 plano, 1 punta, 2 doble)
const TOWERS = [
  [8, 16, 44, 0], [26, 12, 58, 1], [40, 18, 40, 0], [62, 14, 70, 2], [78, 12, 62, 1], [96, 20, 48, 0],
  [176, 16, 56, 1], [194, 12, 44, 0], [212, 18, 36, 0], [256, 14, 50, 1],
];

export function draw(ctx, t) {
  const hz = 146;
  sky(ctx, hz, [mixHex(PAL.dusk, PAL.coral, 0.55), [0.35, PAL.coralLight], [0.72, PAL.gold], [1, PAL.goldPale]]);
  sunGlow(ctx, 60, 112, 17, { core: PAL.goldPale, halo: PAL.gold });
  // skyline lejano (bruma cálida)
  ctx.fillStyle = mixHex(PAL.peach, PAL.dusk, 0.2);
  for (let i = 0; i < 18; i++) {
    const x = i * 16 + (i % 3) * 3, h = 20 + hash(i, 4) * 30;
    ctx.fillRect(x, hz - h, 11, h);
  }
  // torres medias con 3 tonos y ventanitas encendidas
  for (const [x, w, h, cap] of TOWERS) tower(ctx, x, hz, w, h, cap, t);
  burj(ctx, 150, hz, t);
  burjAlArab(ctx, 236, hz);
  // el Golfo con reflejos verticales
  const g = ctx.createLinearGradient(0, hz, 0, AH);
  g.addColorStop(0, mixHex(PAL.gold, PAL.ocean500, 0.45));
  g.addColorStop(1, PAL.navy600);
  ctx.fillStyle = g;
  ctx.fillRect(0, hz, AW, AH - hz);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const [x, w, a] of [[150, 10, 0.5], [60, 26, 0.55], [236, 9, 0.35], [70, 8, 0.25], [190, 7, 0.25]]) {
    for (let k = 0; k < 7; k++) {
      const y = hz + 4 + k * 5, wob = Math.sin(t * 3 + k * 1.3 + x) * 2;
      ctx.fillStyle = rgba(PAL.goldLight, a * (1 - k / 8));
      ctx.fillRect(x - w / 2 + wob, y, w * (1 - k * 0.07), 1.8);
    }
  }
  ctx.restore();
  ctx.fillStyle = rgba(PAL.goldPale, 0.6);
  ctx.fillRect(0, hz, AW, 1.4);
  dhow(ctx, 98 + Math.sin(t * 0.6) * 4, 166, t);
  gull(ctx, 110, 70, 0.8, t, 0.4, PAL.navy800);
  gull(ctx, 124, 78, 0.6, t, 1.8, PAL.navy800);
  const a = 0.5 + 0.5 * Math.sin(t * 4);
  sparkle(ctx, 150, 12, 5 + 5 * a, { alpha: 0.6 + 0.4 * a, color: PAL.white });
}

function tower(ctx, x, base, w, h, cap, t) {
  const top = base - h;
  poly(ctx, [[x, base], [x, top], [x + w, top], [x + w, base]], MID);
  poly(ctx, [[x + w * 0.62, base], [x + w * 0.62, top], [x + w, top], [x + w, base]], DARK);
  ctx.fillStyle = rgba(LIT, 0.85);
  ctx.fillRect(x, top, 1.6, h);
  if (cap === 1) poly(ctx, [[x, top], [x + w / 2, top - w * 0.8], [x + w, top]], MID);
  if (cap === 2) { poly(ctx, [[x, top], [x + w * 0.3, top - 10], [x + w * 0.5, top]], MID); poly(ctx, [[x + w * 0.5, top], [x + w * 0.8, top - 7], [x + w, top]], DARK); }
  // ventanitas: filas con algunas encendidas que titilan
  for (let r = 0; r < Math.floor(h / 6); r++) {
    for (let c = 0; c < Math.floor(w / 4); c++) {
      const on = hash(x * 13 + c, r) > 0.62;
      if (!on) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * 3 + hash(c, r + x) * 9);
      ctx.fillStyle = rgba(PAL.goldLight, 0.75 * tw);
      ctx.fillRect(x + 1.5 + c * 4, top + 3 + r * 6, 1.8, 2);
    }
  }
}

function burj(ctx, cx, base, t) {
  // tramos escalonados: [ancho, alto del tramo]
  const tiers = [[36, 26], [30, 24], [24, 22], [18, 18], [13, 16], [9, 12], [6, 10]];
  let y = base;
  for (const [w, h] of tiers) {
    poly(ctx, [[cx - w / 2, y], [cx - w / 2 + 1.5, y - h], [cx + w / 2 - 1.5, y - h], [cx + w / 2, y]], MID);
    poly(ctx, [[cx - w / 2, y], [cx - w / 2 + 1.5, y - h], [cx - 0.8, y - h], [cx - 0.8, y]], LIT);
    poly(ctx, [[cx + w * 0.2, y], [cx + w * 0.2, y - h], [cx + w / 2 - 1.5, y - h], [cx + w / 2, y]], DARK);
    ctx.fillStyle = rgba(PAL.navy800, 0.25);
    for (let k = 3; k < h; k += 4) ctx.fillRect(cx - w / 2 + 1, y - k, w - 2, 0.8);
    y -= h;
  }
  poly(ctx, [[cx - 2.4, y], [cx, y - 26], [cx + 2.4, y]], LIT);
  poly(ctx, [[cx, y], [cx, y - 26], [cx + 2.4, y]], MID);
  // luz roja de la punta
  ctx.fillStyle = rgba(PAL.coral, 0.6 + 0.4 * Math.sin(t * 5));
  ctx.beginPath(); ctx.arc(cx, y - 26, 1.4, 0, TAU); ctx.fill();
}

function burjAlArab(ctx, x, base) {
  // islita
  ctx.fillStyle = mixHex(PAL.goldPale, PAL.gold, 0.4);
  ctx.beginPath(); ctx.ellipse(x, base + 1, 16, 3, 0, 0, TAU); ctx.fill();
  // vela: mástil curvo y paño blanco
  ctx.fillStyle = PAL.warmWhite;
  ctx.beginPath();
  ctx.moveTo(x - 9, base);
  ctx.quadraticCurveTo(x - 10, base - 40, x - 2, base - 66);
  ctx.quadraticCurveTo(x + 16, base - 30, x + 10, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mixHex(PAL.peach, PAL.dusk, 0.25);
  ctx.beginPath();
  ctx.moveTo(x + 2, base);
  ctx.quadraticCurveTo(x + 4, base - 34, x - 2, base - 66);
  ctx.quadraticCurveTo(x + 16, base - 30, x + 10, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = MID;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x - 10, base); ctx.quadraticCurveTo(x - 11, base - 40, x - 2, base - 68); ctx.stroke();
  // helipuerto
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.ellipse(x - 14, base - 44, 5, 1.6, 0, 0, TAU); ctx.fill();
  ctx.fillRect(x - 12, base - 44, 3, 1.4);
}

function dhow(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.2) * 0.8);
  ctx.rotate(Math.sin(t * 1.7) * 0.04);
  ctx.fillStyle = '#7A4C33';
  ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(13, -2); ctx.lineTo(9, 3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.warmWhite;
  ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(2, -22, 12, -24); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.peach;
  ctx.beginPath(); ctx.moveTo(2, -3); ctx.quadraticCurveTo(6, -16, 12, -24); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
