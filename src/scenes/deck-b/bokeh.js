// Luces bokeh (fuera de foco): sprites precalculados con borde más brillante, como una lente real.
import { makeCanvas } from '../../engine/env.js';
import { PAL, rgba } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';

const S = 128;
const sprites = new Map();
const soft = new Map();
export const BOKEH_COLORS = [PAL.gold, PAL.goldLight, PAL.coralLight, PAL.coral, PAL.ocean400, PAL.goldPale];

function build(color) {
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  const r = S / 2 - 2;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, r);
  gr.addColorStop(0, rgba(color, 0.5));
  gr.addColorStop(0.7, rgba(color, 0.58));
  gr.addColorStop(0.88, rgba(color, 0.78));
  gr.addColorStop(0.96, rgba(color, 0.3));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(S / 2, S / 2, r, 0, TAU);
  g.fill();
  return cv;
}

function buildSoft(color) {
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, rgba(color, 0.7));
  gr.addColorStop(0.55, rgba(color, 0.45));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return cv;
}

export function initBokeh() {
  for (const c of BOKEH_COLORS) {
    if (!sprites.has(c)) sprites.set(c, build(c));
    if (!soft.has(c)) soft.set(c, buildSoft(c));
  }
}

/** Disco bokeh de radio r en (x, y). Usar con composición 'lighter' o 'screen'. */
export function bokeh(ctx, x, y, r, color, alpha = 1, isSoft = false) {
  if (alpha <= 0.003 || r < 0.5) return;
  const img = (isSoft ? soft : sprites).get(color) ?? sprites.get(PAL.gold);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
}
