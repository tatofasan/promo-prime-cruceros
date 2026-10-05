// Cuadros/hojas del tramo de TYPE SIN depender de index.js (si otro equipo tiene un archivo a medio editar, el
// registro completo no carga). Replica el compositor del director (máscara, over, OVER_ABOVE, fx y grade) solo
// con las escenas del tramo 0–13,125. Uso igual que tools/still.mjs:
//   node src/scenes/type/_still.mjs --from=2.15 --to=2.4 --step=0.0167 --sheet --out=shots/review/type/x
//   node src/scenes/type/_still.mjs --t=3.7,3.75 [--crop=x,y,w,h] [--cues=exp.dinner --offsets=-0.033,0]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { boot, parseArgs, root } from '../../../tools/node-env.mjs';

const flags = parseArgs();
await boot({ scenes: false });
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { fxAt } = await imp('src/engine/fx.js');
const { applyGrade } = await imp('src/engine/grade.js');
const { resetLayers, layer } = await imp('src/engine/layer.js');
const time = await imp('src/engine/time.js');
const { W, H, CUES } = time;
const files = ['hook-office', 'reveal-sea', 'pool', 'dinner', 'show', 'sunset', 'type-hook', 'type-exp'];
const ABOVE = ['reveal-sea', 'close'];
const scenes = [];
for (const f of files) {
  try { const s = (await imp(`src/scenes/${f}.js`)).default; await s.init?.(); scenes.push(s); }
  catch (e) { console.error(`(sin ${f}: ${String(e.message).slice(0, 120)})`); }
}
scenes.sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
const BASE = '#04101F';
const maskOn = (s, t) => !!s.mask && (s.maskFrom === undefined || t >= s.maskFrom) && (s.maskUntil === undefined || t <= s.maskUntil);

function frame(out, t, { only = null } = {}) {
  resetLayers();
  const stage = layer();
  const sc = stage.getContext('2d');
  sc.fillStyle = BASE; sc.fillRect(0, 0, W, H);
  const act = scenes.filter((s) => t >= s.from - 1e-9 && t < s.to - 1e-9 && (!only || only.includes(s.id)));
  for (const s of act) {
    if (maskOn(s, t)) {
      const L = layer(); const lc = L.getContext('2d'); s.draw(lc, t);
      const M = layer(); s.mask(M.getContext('2d'), t);
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1; lc.globalCompositeOperation = 'destination-in'; lc.drawImage(M, 0, 0);
      sc.drawImage(L, 0, 0);
    } else { sc.save(); s.draw(sc, t); sc.restore(); }
    if (s.over && !ABOVE.includes(s.id)) { sc.save(); s.over(sc, t); sc.restore(); }
  }
  for (const s of act) if (s.over && ABOVE.includes(s.id)) { sc.save(); s.over(sc, t); sc.restore(); }
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.fillStyle = BASE; out.fillRect(0, 0, W, H);
  const f = flags.nofx ? { flash: 0, sx: 0, sy: 0, sr: 0, punch: 0 } : fxAt(t);
  const ov = 2 * Math.max(Math.abs(f.sx) / W, Math.abs(f.sy) / H) + Math.abs(f.sr) * 1.2;
  const z = 1 + f.punch + ov;
  out.translate(W / 2 + f.sx, H / 2 + f.sy); if (f.sr) out.rotate(f.sr); out.scale(z, z); out.translate(-W / 2, -H / 2);
  out.drawImage(stage, 0, 0);
  out.restore();
  if (f.flash > 0.002) {
    out.save(); out.globalCompositeOperation = 'screen'; out.globalAlpha = f.flash;
    const g = out.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
    g.addColorStop(0, f.flashColor); g.addColorStop(1, f.flashColor + '99');
    out.fillStyle = g; out.fillRect(0, 0, W, H); out.restore();
  }
  if (!flags.nograde) applyGrade(out, t);
}

const outDir = resolve(root, String(flags.out ?? 'shots/review/type/tmp'));
mkdirSync(outDir, { recursive: true });
let times = [];
if (flags.t) times = String(flags.t).split(',').map(Number);
if (flags.from !== undefined) {
  const a = Number(flags.from), z = Number(flags.to ?? a + 1), st = Number(flags.step ?? 0.0167);
  for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
}
if (flags.cues) {
  const offs = String(flags.offsets ?? '0').split(',').map(Number);
  for (const id of String(flags.cues).split(',')) for (const c of CUES.filter((c) => c.id.startsWith(id))) for (const o of offs) times.push(+(c.t + o).toFixed(4));
}
const only = flags.only ? String(flags.only).split(',') : null;
const crop = flags.crop ? String(flags.crop).split(',').map(Number) : null;
const cv = createCanvas(W, H);
const ctx = cv.getContext('2d');
const shots = [];
for (const t of times) {
  const a = performance.now();
  frame(ctx, t, { only });
  const png = cv.encodeSync('png');
  const ms = performance.now() - a;
  let img = sharp(png);
  if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  const buf = await img.png().toBuffer();
  if (!flags['only-sheet']) await sharp(buf).toFile(join(outDir, `t${t.toFixed(3).padStart(6, '0')}.png`));
  shots.push({ t, buf, ms });
}
if (flags.sheet) {
  const cw = crop ? crop[2] : W, ch = crop ? crop[3] : H;
  const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * ch) / cw), lab = 20;
  const rows = Math.ceil(shots.length / cols);
  const comps = [];
  for (let i = 0; i < shots.length; i++) {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    comps.push({ input: await sharp(shots[i].buf).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${shots[i].t.toFixed(4)}s</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(outDir, 'sheet.jpg'));
}
console.log(JSON.stringify({ out: outDir, n: shots.length, msAvg: +(shots.reduce((s, x) => s + x.ms, 0) / Math.max(1, shots.length)).toFixed(1) }));
