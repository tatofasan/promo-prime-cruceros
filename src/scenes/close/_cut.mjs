// Banco de cortes del cierre SIN arrancar todas las escenas (si otro equipo tiene un archivo a medio escribir,
// still.mjs no bootea). Compone value (z 80) + close (z 90, con máscara y over) + fx + grade como el compositor.
//   node src/scenes/close/_cut.mjs --t=26.1,26.2 | --from=25.95 --to=26.4 --step=0.016667 [--sheet --cols=6 --thumb=320] --out=shots/close/x
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const fonts = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of fonts.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const { setEnv } = await import('../../engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers, layer } = await import('../../engine/layer.js');
const { applyGrade } = await import('../../engine/grade.js');
const { fxAt } = await import('../../engine/fx.js');
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const scenes = [];
if (!flags.solo) { const v = (await import('../value.js')).default; if (v.init) await v.init(); scenes.push(v); }
const close = (await import('../close.js')).default;
await close.init();
scenes.push(close);
const W = 1920, H = 1080;
const out = createCanvas(W, H), octx = out.getContext('2d');

function frame(t) {
  resetLayers();
  const stage = layer(), sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, W, H);
  for (const s of scenes) {
    if (t < s.from - 1e-9 || t >= s.to - 1e-9 && !(s.to >= 30 && t <= 30)) continue;
    if (s.mask) {
      const L = layer(), lc = L.getContext('2d');
      s.draw(lc, t);
      const M = layer();
      s.mask(M.getContext('2d'), t);
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1; lc.globalCompositeOperation = 'destination-in'; lc.drawImage(M, 0, 0);
      sc.drawImage(L, 0, 0);
    } else { sc.save(); s.draw(sc, t); sc.restore(); }
    if (s.over) { sc.save(); s.over(sc, t); sc.restore(); }
  }
  const f = flags.nofx ? { flash: 0, sx: 0, sy: 0, sr: 0, punch: 0 } : fxAt(t);
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.fillStyle = '#04101F'; octx.fillRect(0, 0, W, H);
  const ov = 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H) + Math.abs(f.sr) * 1.2;
  const z = 1 + f.punch + ov;
  octx.translate(W / 2 + f.sx, H / 2 + f.sy); if (f.sr) octx.rotate(f.sr); octx.scale(z, z); octx.translate(-W / 2, -H / 2);
  octx.drawImage(stage, 0, 0);
  octx.restore();
  if (f.flash > 0.002) {
    octx.save(); octx.globalCompositeOperation = 'screen'; octx.globalAlpha = f.flash;
    const g = octx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
    g.addColorStop(0, f.flashColor); g.addColorStop(1, f.flashColor + '99');
    octx.fillStyle = g; octx.fillRect(0, 0, W, H); octx.restore();
  }
  if (!flags.nograde) applyGrade(octx, t);
  return octx.getImageData(0, 0, W, H).data;
}

let times = flags.t ? String(flags.t).split(',').map(Number) : [];
if (flags.from !== undefined) {
  const a = Number(flags.from), zz = Number(flags.to), st = Number(flags.step ?? 1 / 60);
  for (let k = 0; a + k * st <= zz + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
}
const dir = resolve(root, String(flags.out ?? 'shots/close/cut'));
mkdirSync(dir, { recursive: true });
const thumbs = [];
const crop = flags.crop ? String(flags.crop).split(',').map(Number) : null; // x,y,w,h
const tw = Number(flags.thumb ?? 320), th = Math.round(tw * (crop ? crop[3] / crop[2] : 9 / 16));
for (const t of times) {
  const px = frame(t);
  let img = sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), { raw: { width: W, height: H, channels: 4 } });
  if (crop) img = sharp(await img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }).png().toBuffer());
  if (!flags.sheet) await img.clone().jpeg({ quality: 90 }).toFile(join(dir, `t${t.toFixed(3).padStart(6, '0')}.jpg`));
  if (flags.sheet) {
    const lab = Buffer.from(`<svg width="${tw}" height="20"><rect width="${tw}" height="20" fill="#000a"/><text x="5" y="15" font-family="monospace" font-size="13" fill="#FFD27A">${t.toFixed(3)}</text></svg>`);
    thumbs.push(await img.clone().resize(tw, th).composite([{ input: lab, top: 0, left: 0 }]).png().toBuffer());
  }
}
if (flags.sheet) {
  const cols = Number(flags.cols ?? 6), rows = Math.ceil(thumbs.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#000' } })
    .composite(thumbs.map((b, i) => ({ input: b, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .jpeg({ quality: 88 }).toFile(join(dir, 'sheet.jpg'));
}
console.log(JSON.stringify({ out: dir, n: times.length }));
