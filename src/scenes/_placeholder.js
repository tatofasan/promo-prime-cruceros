// Marcador provisorio: cada equipo lo reemplaza por su escena real. Muestra id, equipo y tiempo local.
import { W, H } from '../engine/time.js';

export function placeholder(ctx, t, s, color) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, color);
  g.addColorStop(1, '#04101F');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '800 64px Outfit';
  ctx.fillText(`${s.id}`, 120, 200);
  ctx.font = '500 34px Outfit';
  ctx.fillText(`${s.team} · ${s.from.toFixed(3)}–${s.to.toFixed(3)} s · t=${t.toFixed(3)}`, 120, 260);
  const p = (t - s.from) / (s.to - s.from);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(120, 300, 900, 8);
  ctx.fillStyle = '#FFB938';
  ctx.fillRect(120, 300, 900 * Math.max(0, Math.min(1, p)), 8);
}
