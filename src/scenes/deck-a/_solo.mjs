// Render aislado de escenas de DECK-A (sin pasar por el registro: sirve aunque otro equipo tenga un archivo roto).
//   node src/scenes/deck-a/_solo.mjs --scenes=dinner --t=7.5,8.2 --out=shots/deck-a/solo [--sheet --cols=5 --thumb=384]
// Aplica fx de los cues y el grado final igual que el compositor.
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '../../..');
const flags = {};
for (const a of process.argv.slice(2)) { const [k, ...v] = a.replace(/^--/, '').split('='); flags[k] = v.length ? v.join('=') : true; }
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers, layer } = await imp('src/engine/layer.js');
const { applyGrade } = await imp('src/engine/grade.js');
const { fxAt } = await imp('src/engine/fx.js');
const names = String(flags.scenes ?? 'dinner').split(',');
const scenes = [];
for (const n of names) { const m = await imp(`src/scenes/${n}.js`); if (m.default.init) await m.default.init(); scenes.push(m.default); }
scenes.sort((a, b) => a.z - b.z);
const out = resolve(root, String(flags.out ?? 'shots/deck-a/solo'));
mkdirSync(out, { recursive: true });
let times = flags.t ? String(flags.t).split(',').map(Number) : [];
if (flags.from !== undefined) { const a = +flags.from, z = +(flags.to ?? a + 1), st = +(flags.step ?? 0.1); for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4)); }
const W = 1920, H = 1080;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const frames = [];
for (const t of times) {
  const a = performance.now();
  resetLayers();
  const stage = layer();
  const sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, W, H);
  for (const s of scenes) {
    if (!(t >= s.from - 1e-9 && t < s.to - 1e-9)) continue;
    if (s.mask) {
      const L = layer(); const lc = L.getContext('2d'); s.draw(lc, t);
      const M = layer(); s.mask(M.getContext('2d'), t);
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'destination-in'; lc.drawImage(M, 0, 0);
      sc.drawImage(L, 0, 0);
    } else { sc.save(); s.draw(sc, t); sc.restore(); }
    if (s.over) { sc.save(); s.over(sc, t); sc.restore(); }
  }
  const f = fxAt(t);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#04101F'; ctx.fillRect(0, 0, W, H);
  const z = 1 + f.punch + 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H) + Math.abs(f.sr) * 1.2;
  ctx.translate(W / 2 + f.sx, H / 2 + f.sy); if (f.sr) ctx.rotate(f.sr); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(stage, 0, 0); ctx.restore();
  if (f.flash > 0.002) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = f.flash; ctx.fillStyle = f.flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  applyGrade(ctx, t);
  const ms = performance.now() - a;
  const png = await canvas.encode('png');
  const file = join(out, `t${t.toFixed(3).padStart(6, '0')}.png`);
  if (!flags['only-sheet']) await sharp(png).toFile(file);
  frames.push({ t, ms: +ms.toFixed(1), png });
}
if (flags.sheet) {
  const cols = +(flags.cols ?? 5), tw = +(flags.thumb ?? 384), th = Math.round((tw * H) / W), lab = 20;
  const rows = Math.ceil(frames.length / cols);
  const comps = [];
  for (let i = 0; i < frames.length; i++) {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    comps.push({ input: await sharp(frames[i].png).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas" font-size="12" fill="#FFD27A">${frames[i].t.toFixed(3)}s</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(out, 'sheet.jpg'));
}
const ms = frames.map((f) => f.ms);
console.log(JSON.stringify({ out, n: frames.length, msAvg: +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1), msMax: Math.max(...ms) }));
