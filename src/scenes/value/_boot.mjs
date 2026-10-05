// Mini compositor de VALOR para herramientas propias: MAPA (si carga) + VALOR (+ CIERRE si carga), con la
// misma lógica de máscara/over/fx/grade que src/engine/compositor.js. Sirve para medir sin depender de que
// TODAS las escenas de otros equipos compilen mientras las editan en paralelo.
import { createCanvas, Path2D, GlobalFonts, DOMMatrix, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from '../../../tools/node-env.mjs';

globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers, layer } = await imp('src/engine/layer.js');
const { fxAt } = await imp('src/engine/fx.js');
const { applyGrade } = await imp('src/engine/grade.js');
const time = await imp('src/engine/time.js');

export const W = 1920, H = 1080;
export const BEAT = time.BEAT;
export const scenes = [];
export const missing = [];
for (const p of ['src/scenes/map.js', 'src/scenes/value.js', 'src/scenes/close.js']) {
  try {
    const s = (await imp(p)).default;
    if (s.init) await s.init();
    scenes.push(s);
  } catch (e) {
    if (p.endsWith('value.js')) throw e;
    missing.push(`${p}: ${String(e?.message || e).slice(0, 120)}`);
  }
}
scenes.sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

const maskOn = (s, t) => !!s.mask && (s.maskFrom === undefined || t >= s.maskFrom) && (s.maskUntil === undefined || t <= s.maskUntil);

/** Dibuja el cuadro t en ctx (W×H). */
export function render(ctx, t, { fx = true, grade = true } = {}) {
  resetLayers();
  const stage = layer();
  const sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, W, H);
  for (const s of scenes) {
    if (!(t >= s.from - 1e-9 && t < s.to - 1e-9)) continue;
    if (maskOn(s, t)) {
      const L = layer();
      const lc = L.getContext('2d');
      s.draw(lc, t);
      const M = layer();
      s.mask(M.getContext('2d'), t);
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(M, 0, 0);
      sc.drawImage(L, 0, 0);
    } else { sc.save(); s.draw(sc, t); sc.restore(); }
    if (s.over) { sc.save(); s.over(sc, t); sc.restore(); }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#04101F'; ctx.fillRect(0, 0, W, H);
  const f = fx ? fxAt(t) : { flash: 0, shake: 0, punch: 0, sx: 0, sy: 0, sr: 0 };
  const over = 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H) + Math.abs(f.sr) * 1.2;
  const z = 1 + f.punch + over;
  ctx.translate(W / 2 + f.sx, H / 2 + f.sy); if (f.sr) ctx.rotate(f.sr); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(stage, 0, 0);
  ctx.restore();
  if (f.flash > 0.002) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = f.flash;
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
    g.addColorStop(0, f.flashColor); g.addColorStop(1, f.flashColor + '99');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  if (grade) applyGrade(ctx, t);
}
