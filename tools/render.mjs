// Render del video. La pieza se corta en TRAMOS cortos que van a una cola; hasta N procesos Node toman tramos,
// cada proceso dibuja el suyo con Skia, lo codifica a un segmento H.264 (mismos parámetros para todos) y termina.
// Después: concat sin recodificar → mux con la música.
// Procesos cortos a propósito: @napi-rs/canvas pierde ~8 MB nativos por lectura de píxeles, así que ningún
// proceso lee más de --reads cuadros; además la cola reparte solo entre núcleos rápidos y lentos.
//
//   node tools/render.mjs                          → out/promo-prime-cruceros.mp4 (1920×1080, 60 fps, motion blur ×6)
//   node tools/render.mjs --draft                  → out/draft.mp4 (30 fps, 960×540, sin motion blur, rápido)
//   node tools/render.mjs --draft --from=3 --to=6 --out=out/draft-hook.mp4
//
// Flags: --fps · --mblur (submuestras por cuadro) · --shutter (fracción de cuadro, 0.5 = 180°) · --workers
//        --reads (lecturas de píxeles por proceso, def. 60) · --crf · --preset · --full (borrador a 1920×1080)
//        --noaudio · --audio=public/audio/promo.wav · --out · --keep (no borra los tramos)
//        --format=9x16 → versión vertical 1080×1920 (out/promo-prime-cruceros-9x16.mp4, borrador out/draft-9x16.mp4)
// El obturador mira hacia ADELANTE [t, t + shutter/fps): los cortes en el beat quedan limpios.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { cpus } from 'node:os';
import { parseArgs, root } from './node-env.mjs';

const flags = parseArgs();
const draft = !!flags.draft;
const cfg = {
  fps: Number(flags.fps ?? (draft ? 30 : 60)),
  mblur: Math.max(1, Number(flags.mblur ?? (draft ? 1 : 6))),
  shutter: Number(flags.shutter ?? 0.5),
  crf: String(flags.crf ?? (draft ? 22 : 15)),
  preset: String(flags.preset ?? (draft ? 'veryfast' : 'slow')),
  scale: draft && !flags.full ? 0.5 : 1,
};
const format = String(flags.format ?? '16x9');
const suffix = format === '9x16' ? '-9x16' : '';
const workers = Math.max(1, Number(flags.workers ?? Math.min(10, cpus().length - 6)));
const reads = Math.max(cfg.mblur, Number(flags.reads ?? 60));
const outPath = resolve(root, String(flags.out ?? (draft ? `out/draft${suffix}.mp4` : `out/promo-prime-cruceros${suffix}.mp4`)));
const audioPath = resolve(root, String(flags.audio ?? 'public/audio/promo.wav'));
const partsDir = join(root, 'out', `parts-${process.pid}`);
mkdirSync(dirname(outPath), { recursive: true });
mkdirSync(partsDir, { recursive: true });

const DUR = 30;
const from = Number(flags.from ?? 0), to = Number(flags.to ?? DUR);
const nFrames = Math.round((to - from) * cfg.fps);
const chunk = Math.max(1, Math.floor(reads / cfg.mblur));
const chunks = [];
for (let i0 = 0, k = 0; i0 < nFrames; i0 += chunk, k++) chunks.push({ k, i0, i1: Math.min(nFrames, i0 + chunk), seg: join(partsDir, `seg-${String(k).padStart(4, '0')}.mp4`) });
const t0 = Date.now();
console.error(`[render] formato ${format} · ${nFrames} cuadros · ${cfg.fps} fps · mblur ${cfg.mblur} · ${chunks.length} tramos de ${chunk} · ${workers} procesos`);

let done = 0, lastLog = 0;
function runChunk(c) {
  const job = { ...cfg, from, i0: c.i0, i1: c.i1, seg: c.seg, dur: DUR };
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [join(root, 'tools/render-worker.mjs'), Buffer.from(JSON.stringify(job)).toString('base64')], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PROMO_FORMAT: format } });
    let err = '', mine = 0;
    p.stderr.on('data', (d) => { err += d; });
    p.stdout.on('data', (d) => {
      for (const line of String(d).split('\n')) {
        const m = line.match(/^F (\d+)/);
        if (m) { const v = Number(m[1]); done += v - mine; mine = v; }
      }
      if (Date.now() - lastLog > 10000) {
        lastLog = Date.now();
        const el = (Date.now() - t0) / 1000;
        console.error(`[render] ${done}/${nFrames} · ${(done / el).toFixed(2)} c/s · faltan ~${((nFrames - done) / Math.max(0.01, done / el)).toFixed(0)} s`);
      }
    });
    p.on('close', (code) => (code === 0 ? res(c.seg) : rej(new Error(`tramo ${c.k} salió con ${code}:\n${err.slice(-3000)}`))));
  });
}

let code = 0;
try {
  const queue = [...chunks];
  const lane = async () => { while (queue.length) await runChunk(queue.shift()); };
  await Promise.all(Array.from({ length: Math.min(workers, chunks.length) }, lane));
  const list = join(partsDir, 'list.txt');
  writeFileSync(list, chunks.map((c) => `file '${c.seg.replace(/\\/g, '/')}'`).join('\n'));
  const useAudio = !flags.noaudio && existsSync(audioPath);
  if (!flags.noaudio && !useAudio) console.error(`[render] AVISO: falta ${audioPath}; sale sin audio`);
  // duración exacta con -t (con -shortest ffmpeg se comía el último cuadro de video)
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', list,
    ...(useAudio ? ['-ss', String(from), '-t', String(to - from), '-i', audioPath] : []),
    '-map', '0:v', ...(useAudio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []),
    '-c:v', 'copy', '-movflags', '+faststart', '-t', String(to - from), outPath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg concat/mux falló: ${r.stderr}`);
  console.log(JSON.stringify({
    ok: true, out: outPath, sizeMB: +(statSync(outPath).size / 1048576).toFixed(1), frames: nFrames, ...cfg, workers,
    chunks: chunks.length, audio: useAudio, seconds: Math.round((Date.now() - t0) / 1000),
  }, null, 2));
} catch (e) {
  code = 1;
  console.log(JSON.stringify({ ok: false, error: String(e?.stack || e) }, null, 2));
}
if (!flags.keep) rmSync(partsDir, { recursive: true, force: true });
process.exit(code);
