// Terminación de imagen, por encima de todo: grano de película animado (determinista por cuadro) y viñeta
// suave. Las escenas pueden ajustar por tramo con addGrade().
// Rendimiento (Skia en CPU): un fillRect con patrón en 'overlay' a pantalla completa cuesta ~35 ms; pegar
// azulejos ya rasterizados con drawImage cuesta ~1–2 ms. La viñeta se hornea una vez por combinación.
import { makeCanvas } from './env.js';
import { rng } from './noise.js';
import { W, H, FPS } from './time.js';

const tiles = [];
const SIZE = 512;
const extras = [];
const vignettes = new Map();
/** addGrade(t => ({ grain: 0.09, vignette: 0.5 })) — gana el último valor definido. */
export function addGrade(fn) { extras.push(fn); }

function initTiles() {
  if (tiles.length) return;
  const r = rng(90817);
  for (let k = 0; k < 6; k++) {
    const c = makeCanvas(SIZE, SIZE);
    const x = c.getContext('2d');
    const img = x.createImageData(SIZE, SIZE);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() + r() + r() + r() - 2) * 95;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    tiles.push(c);
  }
}

function vignetteCanvas(amount, color) {
  const key = `${amount.toFixed(3)}|${color}`;
  let c = vignettes.get(key);
  if (c) return c;
  const tmp = makeCanvas(W, H);
  const x = tmp.getContext('2d');
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, `rgba(${color},0)`);
  v.addColorStop(1, `rgba(${color},${amount})`);
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);
  // rasterizar (en Node un lienzo de comandos se re-rasteriza en cada drawImage)
  c = makeCanvas(W, H);
  c.getContext('2d').putImageData(x.getImageData(0, 0, W, H), 0, 0);
  if (vignettes.size > 24) vignettes.clear();
  vignettes.set(key, c);
  return c;
}

export function gradeAt(t) {
  const g = { grain: 0.07, vignette: 0.38, vignetteColor: '4,16,31' };
  for (const fn of extras) Object.assign(g, fn(t) || {});
  return g;
}

/** Aplica el grado sobre el lienzo final (coordenadas de pantalla). */
export function applyGrade(ctx, t) {
  initTiles();
  const g = gradeAt(t);
  const f = Math.max(0, Math.floor(t * FPS + 1e-4));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (g.vignette > 0.001) ctx.drawImage(vignetteCanvas(Math.round(g.vignette * 200) / 200, g.vignetteColor), 0, 0);
  if (g.grain > 0) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = g.grain;
    const tile = tiles[f % tiles.length];
    const ox = (f * 149) % SIZE, oy = (f * 83) % SIZE;
    for (let y = -oy; y < H; y += SIZE) for (let x = -ox; x < W; x += SIZE) ctx.drawImage(tile, x, y);
  }
  ctx.restore();
}
