// Verificación de fidelidad del logo vectorial contra el PNG original (2651×334):
// dibuja drawLogo a tamaño nativo sobre blanco, lo compara píxel a píxel con el PNG compuesto sobre blanco
// y guarda: el render, la superposición (rojo = sólo original, cian = sólo vector) y la diferencia ×4.
//   node src/scenes/close/_logo-diff.mjs  → shots/close/logo-diff/*.png + métricas
import { createCanvas, loadImage, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
globalThis.Path2D = Path2D;
const { drawLogo, LOGO } = await import(pathToFileURL(join(root, 'src/brand/logo.js')).href);
const out = join(root, 'shots/close/logo-diff');
mkdirSync(out, { recursive: true });

const Wd = LOGO.w, Hd = LOGO.h;
const ref = await loadImage(readFileSync(join(root, 'docs/ref/logo-principal.png')));
const onWhite = (fn) => {
  const c = createCanvas(Wd, Hd);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, Wd, Hd);
  fn(x);
  return c;
};
const A = onWhite((x) => x.drawImage(ref, 0, 0));
const B = onWhite((x) => drawLogo(x, 0, 0, Wd, { anchor: [0, 0] }));
const a = A.getContext('2d').getImageData(0, 0, Wd, Hd).data;
const b = B.getContext('2d').getImageData(0, 0, Wd, Hd).data;

// métricas: diferencia media por canal y cobertura (tinta = no blanco)
let sum = 0, big = 0, inkA = 0, inkB = 0, both = 0, sumPin = 0, nPin = 0, sumTxt = 0, nTxt = 0;
const D = createCanvas(Wd, Hd), dctx = D.getContext('2d'), dimg = dctx.createImageData(Wd, Hd);
const O = createCanvas(Wd, Hd), octx = O.getContext('2d'), oimg = octx.createImageData(Wd, Hd);
for (let i = 0; i < a.length; i += 4) {
  const px = (i / 4) % Wd;
  const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
  sum += d;
  if (px >= 2265 && px < 2505) { sumPin += d; nPin++; } else { sumTxt += d; nTxt++; }
  if (d > 64) big++;
  const ia = (765 - a[i] - a[i + 1] - a[i + 2]) / 765 > 0.25, ib = (765 - b[i] - b[i + 1] - b[i + 2]) / 765 > 0.25;
  inkA += ia; inkB += ib; both += ia && ib;
  const v = Math.min(255, d * 4);
  dimg.data[i] = dimg.data[i + 1] = dimg.data[i + 2] = 255 - v; dimg.data[i + 3] = 255;
  // superposición: gris = coinciden, rojo = sólo original, cian = sólo vector
  oimg.data[i] = ia && !ib ? 255 : ib && !ia ? 0 : ia ? 90 : 255;
  oimg.data[i + 1] = ia && !ib ? 0 : ib && !ia ? 200 : ia ? 90 : 255;
  oimg.data[i + 2] = ia && !ib ? 0 : ib && !ia ? 255 : ia ? 90 : 255;
  oimg.data[i + 3] = 255;
}
dctx.putImageData(dimg, 0, 0);
octx.putImageData(oimg, 0, 0);
writeFileSync(join(out, 'vector.png'), await B.encode('png'));
writeFileSync(join(out, 'diff-x4.png'), await D.encode('png'));
writeFileSync(join(out, 'overlay.png'), await O.encode('png'));
const n = a.length / 4;
// punto de la «i» de «prime»: caja de tinta en x 370–430, y 0–42 (por encima del asta, que arranca en y≈47)
function dot(px) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sx = 0, sy = 0, m = 0;
  for (let y = 0; y < 42; y++) for (let x = 370; x < 430; x++) {
    const i = (y * Wd + x) * 4, k = (765 - px[i] - px[i + 1] - px[i + 2]) / 765;
    if (k > 0.5) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    sx += x * k; sy += y * k; m += k;
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, cx: +(sx / m).toFixed(2), cy: +(sy / m).toFixed(2) };
}
const dRef = dot(a), dVec = dot(b);
const iDot = { ref: dRef, vec: dVec, dW: dVec.w - dRef.w, dH: dVec.h - dRef.h, dCx: +(dVec.cx - dRef.cx).toFixed(2), dCy: +(dVec.cy - dRef.cy).toFixed(2) };
iDot.ok = [iDot.dW, iDot.dH, iDot.dCx, iDot.dCy].every((v) => Math.abs(v) <= 2);
// color medio de las letras (tinta fuerte) en cada palabra: original vs vector
function wordColor(px, xa, xb) {
  let r = 0, g = 0, bl = 0, c = 0;
  for (let y = 0; y < Hd; y++) for (let x = xa; x < xb; x++) {
    const i = (y * Wd + x) * 4;
    if ((765 - px[i] - px[i + 1] - px[i + 2]) / 765 > 0.4) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; c++; }
  }
  return [Math.round(r / c), Math.round(g / c), Math.round(bl / c)];
}
const colors = { primeRef: wordColor(a, 0, 1090), primeVec: wordColor(b, 0, 1090), crucerosRef: wordColor(a, 1110, 2260), crucerosVec: wordColor(b, 1110, 2260) };
console.log(JSON.stringify({ iDot, colors }));
console.log(JSON.stringify({
  meanDiff: +(sum / n).toFixed(3), meanDiffLetters: +(sumTxt / nTxt).toFixed(3), meanDiffPin: +(sumPin / nPin).toFixed(3),
  pxOver64: big, iou: +(both / (inkA + inkB - both)).toFixed(5), inkRef: inkA, inkVec: inkB, out,
}, null, 2));
