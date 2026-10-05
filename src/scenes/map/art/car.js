// Postal CARIBE: islita de arena con palmeras que se mecen, laguna turquesa con arrecife más claro,
// sombrilla a rayas, estrella de mar, catamarán y destellos. 280 × 184, luz arriba-izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { sparkle } from '../../../engine/draw.js';
import { AW, AH, sky, sunGlow, sea, cloud, gull, palm } from './kit.js';

export function draw(ctx, t) {
  const hz = 92;
  sky(ctx, hz, [mixHex(PAL.ocean400, PAL.aqua300, 0.4), [0.6, PAL.aqua200], [1, PAL.aqua100]]);
  sunGlow(ctx, 50, 30, 12, { halo: PAL.goldPale });
  cloud(ctx, 150, 70, 1.5, { a: 0.95 });
  cloud(ctx, 232, 80, 1.0, { a: 0.9 });
  cloud(ctx, 30, 82, 0.8, { a: 0.8 });
  sea(ctx, t, hz, { top: mixHex(PAL.ocean400, PAL.aqua300, 0.35), bottom: PAL.ocean500, line: PAL.white, seed: 7, glint: 8 });
  // laguna: agua baja más clara alrededor de la isla
  const cx = 140, cy = 146;
  const lg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 130);
  lg.addColorStop(0, rgba(PAL.aqua200, 0.95));
  lg.addColorStop(0.55, rgba(PAL.aqua300, 0.55));
  lg.addColorStop(1, rgba(PAL.aqua300, 0));
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.ellipse(cx, cy, 136, 36, 0, 0, TAU); ctx.fill();
  // espuma de la orilla (late con el oleaje)
  const k = 0.5 + 0.5 * Math.sin(t * 2.6);
  ctx.strokeStyle = rgba(PAL.foam, 0.7);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.setLineDash([14, 4, 5, 7, 22, 5]);
  ctx.lineDashOffset = -t * 9;
  ctx.beginPath(); ctx.ellipse(cx, cy + 2, 86 + 4 * k, 17 + 1.5 * k, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  // arena: base, sombra abajo-derecha, arena mojada y filo
  ctx.fillStyle = mixHex(PAL.goldPale, PAL.gold, 0.55);
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + 3, 82, 15, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.goldPale;
  ctx.beginPath(); ctx.ellipse(cx - 2, cy, 78, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.warmWhite;
  ctx.beginPath(); ctx.ellipse(cx - 14, cy - 4, 46, 5, 0, 0, TAU); ctx.fill();
  // estrella de mar
  ctx.save();
  ctx.translate(176, 150);
  ctx.rotate(0.3);
  ctx.fillStyle = PAL.coral;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 1.6 : 4.2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.fill();
  ctx.restore();
  // sombrilla a rayas con su sombra
  ctx.fillStyle = rgba(PAL.gold, 0.45);
  ctx.beginPath(); ctx.ellipse(198, 151, 15, 3.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.warmWhite;
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(192, 148); ctx.lineTo(188, 124); ctx.stroke();
  ctx.save();
  ctx.translate(188, 124);
  ctx.rotate(-0.16 + Math.sin(t * 2) * 0.02);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? PAL.warmWhite : PAL.coral;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.arc(0, 2, 16, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = rgba(PAL.navy900, 0.12);
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.arc(0, 2, 16, Math.PI * 1.5, TAU); ctx.closePath(); ctx.fill();
  ctx.restore();
  // palmeras (de atrás para adelante)
  palm(ctx, 150, 146, 50, t, { lean: 0.22, ph: 1.2 });
  palm(ctx, 98, 148, 70, t, { lean: -0.28, ph: 0 });
  palm(ctx, 120, 150, 58, t, { lean: 0.08, ph: 2.1 });
  // catamarán a lo lejos
  ctx.save();
  ctx.translate(248, 112 + Math.sin(t * 2) * 0.7);
  ctx.fillStyle = PAL.warmWhite;
  ctx.fillRect(-10, 0, 20, 2.4);
  ctx.fillStyle = PAL.navy700;
  ctx.fillRect(-9, 2.4, 6, 1.6);
  ctx.fillRect(3, 2.4, 6, 1.6);
  ctx.fillStyle = PAL.white;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -19); ctx.lineTo(9, 0); ctx.fill();
  ctx.fillStyle = PAL.coralLight;
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1, -15); ctx.lineTo(-8, 0); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const a = Math.max(0, Math.sin(t * 2.6 + i * 2.1));
    sparkle(ctx, 40 + i * 90, 126 + (i % 2) * 30, 6 * a, { alpha: a });
  }
  gull(ctx, 210, 40, 0.9, t, 0.7);
  gull(ctx, 228, 50, 0.7, t, 2.4);
}
