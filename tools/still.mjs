// Cuadros sueltos y hojas de contactos, directo en Node (sin navegador, sin GPU: rápido y determinista).
//
//   node tools/still.mjs --t=0.5,3.75,4.2                       → shots/still/t00.500.png …
//   node tools/still.mjs --scene=pool --step=0.117 --sheet      → todos los cuadros cada corchea de la escena + hoja
//   node tools/still.mjs --from=3.4 --to=4.2 --step=0.0333 --sheet --cols=8 --thumb=240   (movimiento cuadro a cuadro)
//   node tools/still.mjs --cues=map. --offsets=-0.1,0,0.1 --sheet
//   node tools/still.mjs --section=destinations --step=0.47 --sheet --out=shots/dest
//
// --format=9x16 → versión vertical (1080×1920).
// Flags: --out=dir (def. shots/still) · --sheet (sheet.jpg con rótulos) · --cols · --thumb (ancho miniatura)
//        --jpeg · --only-sheet (no guarda los cuadros sueltos) · --mblur=N (motion blur como el render final)
//        --nofx · --nograde · --safe (dibuja márgenes de seguridad) · --scale=0.5 (cuadros sueltos más chicos)
// Imprime un JSON: archivos, ms por cuadro, errores.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { boot, parseArgs, root, blurredPixels } from './node-env.mjs';

const flags = parseArgs();
const out = resolve(root, String(flags.out ?? 'shots/still'));
mkdirSync(out, { recursive: true });
const report = { ok: true, out, frames: [] };

try {
  const B = await boot();
  const I = B.info;
  let times = [];
  if (flags.t) times = String(flags.t).split(',').map(Number);
  let from = flags.from, to = flags.to;
  if (flags.section) {
    const s = I.sections.find((x) => x.id === flags.section);
    if (!s) throw new Error(`sección desconocida: ${flags.section} (hay: ${I.sections.map((x) => x.id).join(', ')})`);
    from ??= s.from; to ??= s.to - 0.001;
  }
  if (flags.scene) {
    const s = I.scenes.find((x) => x.id === flags.scene);
    if (!s) throw new Error(`escena desconocida: ${flags.scene} (hay: ${I.scenes.map((x) => x.id).join(', ')})`);
    from ??= s.from; to ??= Math.min(I.DUR, s.to) - 0.001;
  }
  if (from !== undefined) {
    const a = Number(from), z = Number(to ?? a + 1), st = Number(flags.step ?? I.BEAT / 2);
    for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
  }
  if (flags.cues) {
    const offs = String(flags.offsets ?? '0').split(',').map(Number);
    for (const c of I.cues.filter((c) => c.id.startsWith(String(flags.cues)))) for (const o of offs) times.push(+(c.t + o).toFixed(4));
  }
  if (!times.length) times = [0];
  const mblur = Number(flags.mblur ?? 1);
  const opts = { fx: !flags.nofx, grade: !flags.nograde };
  const scale = Number(flags.scale ?? 1);
  const jpeg = !!flags.jpeg;

  for (const t of times) {
    const t0 = performance.now();
    let img;
    if (mblur > 1) {
      const px = blurredPixels(B, t, { mblur, dur: I.DUR, opts });
      img = sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), { raw: { width: B.W, height: B.H, channels: 4 } });
    } else {
      img = sharp(B.png(t, opts));
    }
    const ms = performance.now() - t0;
    if (flags.safe) img = img.composite([{ input: safeOverlay(B.W, B.H) }]);
    const full = await img.png().toBuffer();
    const frame = { t, ms: +ms.toFixed(1) };
    const near = I.cues.filter((c) => Math.abs(c.t - t) < 0.03).map((c) => c.id);
    if (near.length) frame.cue = near.join(' ');
    if (!flags['only-sheet']) {
      const file = join(out, `t${t.toFixed(3).padStart(6, '0')}.${jpeg ? 'jpg' : 'png'}`);
      let s = sharp(full);
      if (scale !== 1) s = s.resize(Math.round(B.W * scale));
      await (jpeg ? s.jpeg({ quality: 90 }) : s.png()).toFile(file);
      frame.file = file;
    }
    frame.buf = full;
    report.frames.push(frame);
  }

  if (flags.sheet) {
    const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * B.H) / B.W), lab = 22;
    const rows = Math.ceil(report.frames.length / cols);
    const comps = [];
    for (let i = 0; i < report.frames.length; i++) {
      const f = report.frames[i];
      const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
      comps.push({ input: await sharp(f.buf).resize(tw, th).toBuffer(), left: x, top: y + lab });
      const bar = Math.floor(f.t / I.BAR + 1e-6), beat = Math.floor((f.t % I.BAR) / I.BEAT + 1e-6) + 1;
      const label = `${f.t.toFixed(3)}s c${bar}b${beat}${f.cue ? ' ' + f.cue : ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      comps.push({
        input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="16" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${label}</text></svg>`),
        left: x, top: y,
      });
    }
    report.sheet = join(out, 'sheet.jpg');
    await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } })
      .composite(comps).jpeg({ quality: 88 }).toFile(report.sheet);
  }
  report.msAvg = +(report.frames.reduce((s, f) => s + f.ms, 0) / report.frames.length).toFixed(1);
  report.msMax = Math.max(...report.frames.map((f) => f.ms));
} catch (e) {
  report.ok = false;
  report.error = String(e?.stack || e);
}
report.frames = report.frames.map(({ buf, ...f }) => f);
if (report.frames.length > 40) report.frames = [...report.frames.slice(0, 6), { note: `… ${report.frames.length - 12} más …` }, ...report.frames.slice(-6)];
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

function safeOverlay(w, h) {
  if (h > w) {
    // vertical (PLAN §13.2): interfaz de Reels/TikTok arriba, abajo y a la derecha
    return Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="250" fill="#ff00aa22"/><rect x="0" y="1500" width="${w}" height="${h - 1500}" fill="#ff00aa22"/><rect x="950" y="900" width="${w - 950}" height="800" fill="#ff00aa22"/><rect x="80" y="260" width="870" height="1220" fill="none" stroke="#ff00aa" stroke-width="2" stroke-dasharray="12 8"/><line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="#ff00aa55"/><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#ff00aa55"/></svg>`);
  }
  const m = 96, ty = 54;
  return Buffer.from(`<svg width="${w}" height="${h}"><rect x="${m}" y="${ty}" width="${w - 2 * m}" height="${h - 2 * ty}" fill="none" stroke="#ff00aa" stroke-width="2" stroke-dasharray="12 8"/><line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="#ff00aa55"/><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#ff00aa55"/></svg>`);
}
