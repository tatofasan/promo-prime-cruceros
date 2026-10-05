// Contraste WCAG entre una zona de cara de letra y su fondo inmediato — solo para medir.
//   node src/scenes/type/_contrast.mjs archivo.png x0,y0,x1,y1(fondo) x0,y0,x1,y1(cara) [umbral de cara 0..1]
// La zona de cara toma solo los píxeles más claros que el umbral (para no promediar con la extrusión).
import sharp from 'sharp';
const [file, bgR, faceR, thr = '0'] = process.argv.slice(2);
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
function stats(R, min = 0) {
  const [x0, y0, x1, y1] = R.split(',').map(Number);
  let mx = 0, mn = 1, sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * info.width + x) * info.channels;
    const L = lum(data[i], data[i + 1], data[i + 2]);
    if (L < min) continue;
    mx = Math.max(mx, L); mn = Math.min(mn, L); sum += L; n++;
  }
  return { mean: +(sum / Math.max(1, n)).toFixed(4), max: +mx.toFixed(4), min: +mn.toFixed(4), n };
}
const b = stats(bgR), f = stats(faceR, Number(thr));
const cr = (a, c) => (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
console.log(JSON.stringify({ bg: b, face: f, contrastMean: +cr(f.mean, b.mean).toFixed(2), contrastWorstBg: +cr(f.mean, b.max).toFixed(2) }));
