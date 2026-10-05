// Chequeo de la ola (ART): ¿la máscara y el cuerpo de agua coinciden al píxel? ¿cuánto de la escena nueva se ve?
//   node src/art/_tools/wcheck.mjs [--module=src/art/wave.js] [--p=0.1,0.3,...]
// · costura: en la zona del frente (u < cresta − 0,01: labio, panza, cara, base), máx(alfa máscara − alfa cuerpo)
//   con espuma/spray/sombra apagados → tiene que ser ~0 (lo que la máscara muestra, el agua lo tapa).
// · visible: fracción del cuadro donde se ve la escena nueva = Σ máscara·(1 − ola completa) / (W·H), en el drop de
//   cada ola (hook p(3,75) · close p(26,25)).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, DOMMatrix } from '@napi-rs/canvas';
import { parseArgs, root } from '../../../tools/node-env.mjs';

const flags = parseArgs();
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const WV = await import(pathToFileURL(resolve(root, String(flags.module ?? 'src/art/wave.js'))).href);
const { HOOK_WAVE, CLOSE_WAVE } = await imp('src/scenes/waves.js');
const W = 1920, H = 1080;

function alpha(fn) {
  resetLayers();
  const cv = createCanvas(W, H);
  const c = cv.getContext('2d');
  fn(c);
  const d = c.getImageData(0, 0, W, H).data;
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];
  return a;
}

const out = { seam: [], visible: {} };
const ps = String(flags.p ?? '0.08,0.2,0.35,0.5,0.62,0.7,0.76,0.85,0.92').split(',').map(Number);
for (const dir of ['rtl', 'ltr']) {
  for (const p of ps) {
    const t = 3.6 + p * 0.3;
    const m = alpha((c) => WV.drawWaveMask(c, p, { dir }));
    const b = alpha((c) => WV.drawWaveCrest(c, t, p, { dir, foam: 0, spray: 0, shadow: 0 }));
    const G = WV.waveGeom(p, { dir });
    const uMax = (G.crest[0] - G.X) / G.Hc - 0.01;
    let worst = 0, bad = 0, n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const xc = dir === 'ltr' ? W - x : x;
        const u = (xc - G.X) / G.Hc;
        if (u >= uMax) continue;
        const i = y * W + x;
        if (!m[i]) continue;
        n++;
        const dlt = m[i] - b[i];
        if (dlt > worst) worst = dlt;
        if (dlt > 8) bad++;
      }
    }
    out.seam.push({ dir, p, maskPx: n, worst, over8: bad });
  }
}
for (const [name, WAVE, tt] of [['hook@3.75', HOOK_WAVE, 3.75], ['close@26.25', CLOSE_WAVE, 26.25]]) {
  const p = WAVE.p(tt);
  const m = alpha((c) => WV.drawWaveMask(c, p, { dir: WAVE.dir }));
  const f = alpha((c) => WV.drawWaveCrest(c, tt, p, { dir: WAVE.dir, foam: 1.2, spray: 1.35, shadow: 0 }));
  let s = 0;
  for (let i = 0; i < W * H; i++) s += (m[i] / 255) * (1 - f[i] / 255);
  out.visible[name] = { p: +p.toFixed(4), visible: +(s / (W * H)).toFixed(4) };
}
console.log(JSON.stringify(out, null, 1));
