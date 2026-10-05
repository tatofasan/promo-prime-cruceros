// Muestras de gaviotas: de día grandes y chicas, y en silueta al atardecer.
import { drawSky } from './sky.js';
import { drawGulls, gull } from './gulls.js';
import { resolve } from './presets.js';
import { PAL, mixHex } from '../engine/color.js';

export function draw(ctx, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 1920, 540); ctx.clip();
  drawSky(ctx, t, { preset: 'golden', horizonY: 700, sunX: 1500, sunY: 200 });
  drawGulls(ctx, t, { preset: 'golden', count: 7, area: { x: 0, y: 80, w: 1920, h: 360 }, scale: 1.4 });
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 540, 1920, 540); ctx.clip();
  ctx.translate(0, 540);
  drawSky(ctx, t, { preset: 'sunset', horizonY: 500, sunX: 960, sunY: 420 });
  drawGulls(ctx, t, { preset: 'sunset', count: 6, area: { x: 0, y: 60, w: 1920, h: 300 }, scale: 1.2 });
  ctx.restore();
  // cuadro de aleteo: 8 fases
  const col = { top: mixHex(PAL.grey300, '#93A9C8', 0.3), under: '#FFF4E0', tip: PAL.grey900, body: '#ffffff', rim: '#FFE9B8', beak: PAL.gold };
  for (let k = 0; k < 8; k++) gull(ctx, 140 + k * 230, 470, 80, Math.sin((k / 8) * Math.PI * 2), 1, col, false);
}
