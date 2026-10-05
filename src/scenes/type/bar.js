// Subrayado con volumen: extrusión, base, filo de luz arriba y sombra abajo (3 tonos), con brillo en la punta.
import { clamp } from '../../engine/ease.js';
import { rrectPath, sparkle } from '../../engine/draw.js';
import { mixHex } from '../../engine/color.js';

/**
 * Barra de x a x + w·k (crece desde la izquierda), alto h, centrada en y. col = { top, mid, low, ext }.
 * light = [lx, ly] (hacia la luz) · depth = capas de extrusión · tip = brillo en la punta mientras crece.
 */
export function drawBar(c, x, y, w, h, k, col, { light = [-0.5, -0.86], depth = 8, step = 1.1, tip = true, from = 'left', glint = 0 } = {}) {
  const ww = w * clamp(k, 0, 1.2);
  if (ww < 1) return;
  const x0 = from === 'center' ? x + (w - ww) / 2 : x;
  const r = h / 2;
  const [lx, ly] = light;
  const P = rrectPath(x0, y - h / 2, Math.max(h, ww), h, r);
  c.save();
  for (let i = depth; i >= 1; i--) {
    c.save();
    c.translate(-lx * i * step, -ly * i * step);
    c.fillStyle = mixHex(col.ext, '#04101F', i / depth * 0.6);
    c.fill(P);
    c.restore();
  }
  const g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, col.top);
  g.addColorStop(0.32, col.top);
  g.addColorStop(0.36, col.mid);
  g.addColorStop(0.75, col.mid);
  g.addColorStop(1, col.low);
  c.fillStyle = g;
  c.fill(P);
  if (glint > 0.01) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= glint;
    c.fillStyle = 'rgba(255,240,200,0.6)';
    c.fill(P);
  }
  c.restore();
  if (tip && k > 0.02 && k < 0.98) sparkle(c, x0 + ww - r * 0.6, y - h * 0.2, h * 2.2, { alpha: 0.95, color: '#FFF6DE', rot: k * 2 });
}
