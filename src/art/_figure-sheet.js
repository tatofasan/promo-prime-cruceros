// Hoja de FIGURA HUMANA (figure.js): t = 0 adulto a la luz · 1 adulto a contraluz · 2 personaje-ícono; 3 tamaños.
//   node tools/sandbox.mjs --module=src/art/_figure-sheet.js --t=0,1,2 --sheet --cols=1 --thumb=1280 --out=shots/art/figure-sheet
import { PAL } from '../engine/color.js';
import { drawSky } from './sky.js';
import { drawFigure, drawHand, SKINS, HAIRS, skinTones } from './figure.js';

function label(ctx, s, x, y) {
  ctx.font = '600 28px Outfit';
  ctx.fillStyle = 'rgba(4,16,31,0.55)';
  ctx.fillRect(x - 10, y - 30, ctx.measureText(s).width + 20, 40);
  ctx.fillStyle = '#FFE9B8';
  ctx.fillText(s, x, y);
}
export function draw(ctx, t) {
  const k = Math.round(t);
  if (k === 1) {
    drawSky(ctx, 1, { preset: 'sunset', horizonY: 900, sunX: 1500, sunY: 760 });
    ctx.fillStyle = PAL.navy800; ctx.fillRect(0, 1000, 1920, 80);
  } else if (k === 2) {
    const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, PAL.brandCyan); g.addColorStop(1, PAL.ocean600);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  } else {
    drawSky(ctx, 1, { preset: 'golden', horizonY: 900, sunX: 1700, sunY: 200 });
    ctx.fillStyle = '#C8A27A'; ctx.fillRect(0, 1000, 1920, 80);
  }
  const back = k === 1;
  const type = k === 2 ? 'icon' : 'adult';
  const preset = k === 1 ? 'sunset' : 'golden';
  const L = k === 1 ? [0.9, -0.3] : [0.7, -0.7];
  const sizes = type === 'icon' ? [170, 380, 760] : [190, 440, 900];
  const xs = type === 'icon' ? [230, 600, 1260] : [200, 520, 1180];
  const looks = [
    { skin: SKINS[0], hair: HAIRS[3], hairStyle: 'long', top: PAL.coral, bottom: PAL.navy600, skirt: true, pose: { armL: [0.25, 0.3], armR: [2.6, 0.5] } },
    { skin: SKINS[3], hair: HAIRS[1], hairStyle: 'short', top: PAL.brandCyan, bottom: PAL.navy700, pose: { armL: [0.2, 0.9], armR: [0.35, -0.2], legL: [0.12, -0.05], legR: [0.02, 0] } },
    { skin: SKINS[1], hair: HAIRS[0], hairStyle: 'bun', top: PAL.gold, bottom: PAL.ocean600, pose: { armL: [0.45, 1.4], armR: [1.2, 0.6], legL: [0.1, 0], legR: [0.18, -0.1] }, glasses: true },
  ];
  for (let i = 0; i < 3; i++) {
    drawFigure(ctx, 1.2 + i, { type, x: xs[i], y: 1000, h: sizes[i], preset, L, backlit: back, ...looks[i] });
  }
  // detalle de manos
  if (!back) {
    const tones = skinTones(SKINS[1]);
    drawHand(ctx, 1660, 760, 1.45, 130, { tones, L, icon: type === 'icon', side: 1 });
    drawHand(ctx, 1820, 760, 1.7, 130, { tones, L, icon: type === 'icon', side: -1 });
  }
  label(ctx, type === 'icon' ? 'personaje-ícono · 1:3 · 4 dedos + pulgar' : back ? 'adulto a contraluz · navy800 + filo dorado 2–4 px' : 'adulto a la luz · 1:6,5 · piel en 3 tonos', 40, 60);
}
