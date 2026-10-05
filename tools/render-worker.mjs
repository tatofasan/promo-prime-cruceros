// Un proceso de render: dibuja los cuadros [i0, i1) y los codifica a un tramo H.264. Lo lanza tools/render.mjs.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { boot, blurredPixels } from './node-env.mjs';

const job = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'));
const B = await boot();
const W = B.W, H = B.H;
const ow = Math.round(W * job.scale), oh = Math.round(H * job.scale);
const vf = [job.scale !== 1 ? `scale=${ow}:${oh}:flags=lanczos` : null, 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'].filter(Boolean).join(',');
const ff = spawn('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error',
  '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(job.fps), '-i', '-',
  '-vf', vf, '-c:v', 'libx264', '-preset', job.preset, '-crf', job.crf, '-profile:v', 'high',
  '-x264-params', 'aq-mode=3:deblock=-1,-1', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-an', job.seg], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = once(ff, 'close');
let n = 0;
for (let i = job.i0; i < job.i1; i++) {
  const t = job.from + i / job.fps;
  const px = blurredPixels(B, t, { fps: job.fps, mblur: job.mblur, shutter: job.shutter, dur: job.dur });
  if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) await once(ff.stdin, 'drain');
  n++;
  if (n % 10 === 0 || i === job.i1 - 1) process.stdout.write(`F ${n}\n`);
}
ff.stdin.end();
const [code] = await ffDone;
process.exit(code === 0 ? 0 : 2);
