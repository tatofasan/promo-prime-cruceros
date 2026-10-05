// Banco de pruebas del ícono de WhatsApp (sandbox).
import { drawWhatsApp } from '../../brand/whatsapp.js';
import { PAL } from '../../engine/color.js';
export const W = 1200, H = 500;
export const bg = '#0F3157';
export function draw(ctx) {
  ctx.fillStyle = PAL.wa;
  ctx.beginPath(); ctx.roundRect(40, 40, 420, 420, 60); ctx.fill();
  drawWhatsApp(ctx, 250, 250, 380, { color: '#fff' });
  drawWhatsApp(ctx, 700, 250, 340, { color: '#fff', bg: PAL.wa });
  ctx.fillStyle = PAL.wa;
  ctx.beginPath(); ctx.roundRect(940, 200, 220, 100, 50); ctx.fill();
  drawWhatsApp(ctx, 1000, 250, 64, { color: '#fff' });
}
