// Micro prueba de la degradación de @napi-rs/canvas: ¿qué recurso se acumula por operación?
//   node src/scenes/close/_napi-micro.mjs <grad|path|path2d|arc|text> [cuadros]
import { createCanvas, Path2D } from '@napi-rs/canvas';
import os from 'node:os';
if (process.env.PRIO) { try { os.setPriority(0, os.constants.priority[process.env.PRIO]); } catch (e) { console.error('prio', e.message); } }
const W = 1920, H = 1080;
const cv = createCanvas(W, H), c = cv.getContext('2d');
const mode = process.argv[2] ?? 'grad', N = Number(process.argv[3] ?? 200);
const ms = [];
for (let f = 0; f < N; f++) {
  const s = performance.now();
  c.clearRect(0, 0, W, H);
  for (let i = 0; i < 600; i++) {
    const x = (i * 37) % W, y = (i * 53) % H;
    if (mode === 'grad') { c.fillStyle = c.createLinearGradient(x, y, x + 50, y + 50); c.fillStyle.addColorStop?.(0, '#fff'); c.fillRect(x, y, 40, 40); }
    if (mode === 'gradfill') { const g = c.createLinearGradient(x, y, x + 50, y + 50); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(x, y, 40, 40); }
    if (mode === 'path') { c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 20; k++) c.lineTo(x + k * 3, y + (k % 2) * 9); c.closePath(); c.fillStyle = '#abc'; c.fill(); }
    if (mode === 'path2d') { const p = new Path2D(); p.moveTo(x, y); for (let k = 0; k < 20; k++) p.lineTo(x + k * 3, y + (k % 2) * 9); p.closePath(); c.fillStyle = '#abc'; c.fill(p); }
    if (mode === 'rgba') { c.fillStyle = `rgba(${i % 255},${(i * 7) % 255},90,${(i % 10) / 10})`; c.fillRect(x, y, 30, 30); }
    if (mode === 'screen') { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = '#345'; c.fillRect(x, y, 60, 60); c.restore(); }
    if (mode === 'lighter') { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#345'; c.fillRect(x, y, 60, 60); c.restore(); }
    if (mode === 'stroke') { c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40, y); c.stroke(); }
    if (mode === 'screengrad') { c.save(); c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(x, 0, x + 300, 0); g.addColorStop(0, 'rgba(255,200,0,0)'); g.addColorStop(0.5, 'rgba(255,200,0,0.5)'); g.addColorStop(1, 'rgba(255,200,0,0)'); c.fillStyle = g; c.beginPath(); c.rect(x - 200, y, 600, 40); c.fill(); c.restore(); }
    if (mode === 'lightergrad' || mode === 'srcovergrad' || mode === 'multiplygrad') { c.save(); c.globalCompositeOperation = { lightergrad: 'lighter', srcovergrad: 'source-over', multiplygrad: 'multiply' }[mode]; const g = c.createLinearGradient(x, 0, x + 300, 0); g.addColorStop(0, 'rgba(255,200,0,0)'); g.addColorStop(0.5, 'rgba(255,200,0,0.5)'); g.addColorStop(1, 'rgba(255,200,0,0)'); c.fillStyle = g; c.beginPath(); c.rect(x - 200, y, 600, 40); c.fill(); c.restore(); }
    if (mode === 'screenrect') { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,200,0,0.5)'; c.beginPath(); c.rect(x - 200, y, 600, 40); c.fill(); c.restore(); }
    if (mode === 'opaquegrad') { const g = c.createLinearGradient(x, 0, x + 300, 0); g.addColorStop(0, '#ff0'); g.addColorStop(0.5, '#f80'); g.addColorStop(1, '#f00'); c.fillStyle = g; c.fillRect(x - 200, y, 600, 40); }
    if (mode === 'alphagradrect') { const g = c.createLinearGradient(x, 0, x + 300, 0); g.addColorStop(0, 'rgba(255,200,0,0)'); g.addColorStop(0.5, 'rgba(255,200,0,0.5)'); g.addColorStop(1, 'rgba(255,200,0,0)'); c.fillStyle = g; c.fillRect(x - 200, y, 600, 40); }
    if (mode === 'samegrad') { globalThis.G0 ??= (() => { const g = c.createLinearGradient(0, 0, 300, 0); g.addColorStop(0, 'rgba(255,200,0,0)'); g.addColorStop(0.5, 'rgba(255,200,0,0.5)'); g.addColorStop(1, 'rgba(255,200,0,0)'); return g; })(); c.save(); c.translate(x - 200, y); c.fillStyle = globalThis.G0; c.fillRect(0, 0, 600, 40); c.restore(); }
    if (mode === 'save') { c.save(); c.translate(x, y); c.rotate(0.1); c.fillStyle = '#abc'; c.fillRect(0, 0, 30, 30); c.restore(); }
  }
  c.getImageData(0, 0, 1, 1);
  ms.push(performance.now() - s);
}
const q = (a, b) => (ms.slice(a, b).reduce((s, v) => s + v, 0) / (b - a)).toFixed(1);
console.log(mode, 'ini', q(0, 20), 'mid', q(N / 2 - 10, N / 2 + 10), 'fin', q(N - 20, N), 'rss', Math.round(process.memoryUsage().rss / 1e6));
