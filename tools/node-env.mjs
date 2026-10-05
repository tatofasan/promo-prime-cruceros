// Arranque del motor en Node: Skia (@napi-rs/canvas) + fuentes + escenas. Lo usan still, render y check.
// El código de src/ es el MISMO que corre en el navegador: acá solo se enchufa la plataforma.
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, ...v] = a.slice(2).split('=');
    flags[k] = v.length ? v.join('=') : true;
  }
  return flags;
}

let booted = null;
/**
 * Deja todo listo y devuelve { renderFrame, info, canvas, ctx, W, H, errors, pixels, png }.
 * scenes: false → solo plataforma y fuentes (para probar componentes sueltos sin arrancar las escenas).
 *
 * OJO (@napi-rs/canvas 1.0.10): cada lectura de píxeles (getImageData o canvas.data()) pierde ~8 MB nativos
 * que el GC no devuelve. Las herramientas leen poco por proceso (render.mjs recicla procesos por tramos);
 * para guardar cuadros sueltos usá png(), que codifica sin fuga.
 */
export async function boot({ scenes = true, format = parseArgs().format ?? process.env.PROMO_FORMAT ?? '16x9' } = {}) {
  if (booted) return booted;
  globalThis.__FORMAT__ = String(format);
  globalThis.Path2D = Path2D;
  globalThis.DOMMatrix ??= DOMMatrix;
  const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
  for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
  const imp = (p) => import(pathToFileURL(join(root, p)).href);
  const { setEnv } = await imp('src/engine/env.js');
  setEnv({
    platform: 'node',
    createCanvas: (w, h) => createCanvas(w, h),
    loadImage: (p) => loadImage(readFileSync(p)),
    assetUrl: (p) => join(root, 'public', p),
  });
  if (!scenes) {
    const time = await imp('src/engine/time.js');
    booted = { W: time.W, H: time.H, info: { W: time.W, H: time.H, DUR: time.DUR } };
    return booted;
  }
  const comp = await imp('src/engine/compositor.js');
  await comp.initScenes();
  const inf = comp.info();
  const canvas = createCanvas(inf.W, inf.H);
  const ctx = canvas.getContext('2d');
  booted = {
    ...comp, info: inf, canvas, ctx, W: inf.W, H: inf.H,
    /** Renderiza t y devuelve los píxeles RGBA (Uint8ClampedArray). */
    pixels(t, opts) {
      comp.renderFrame(ctx, t, { strict: true, ...opts });
      return canvas.data();
    },
    /** Renderiza t y devuelve un PNG (sin fuga de memoria). */
    png(t, opts) {
      comp.renderFrame(ctx, t, { strict: true, ...opts });
      return canvas.encodeSync('png');
    },
    /** Renderiza t y fuerza la rasterización leyendo 1 píxel (para medir tiempos sin fuga). */
    touch(t, opts) {
      comp.renderFrame(ctx, t, { strict: true, ...opts });
      ctx.getImageData(0, 0, 1, 1);
    },
  };
  return booted;
}

/** Promedia submuestras de obturador [t, t + shutter/fps) → RGBA (motion blur real). */
export function blurredPixels(B, t, { fps = 60, mblur = 1, shutter = 0.5, dur = 30, opts = {} } = {}) {
  if (mblur <= 1) return B.pixels(t, opts);
  const n = B.W * B.H * 4;
  const acc = new Uint16Array(n);
  for (let s = 0; s < mblur; s++) {
    const ts = Math.min(dur, t + (s / mblur) * (shutter / fps));
    const px = B.pixels(ts, opts);
    for (let i = 0; i < n; i++) acc[i] += px[i];
  }
  const out = new Uint8ClampedArray(n);
  const half = mblur >> 1;
  for (let i = 0; i < n; i++) out[i] = (acc[i] + half) / mblur;
  return out;
}
