// Energía (|ΔY| entre cuadros consecutivos) por franja de pantalla en un tramo de un borrador 960×540.
//   node src/scenes/close/_bands.cjs out/draft-close.mp4 1.9 0.47
const { spawnSync } = require('child_process');
const [f, ss, dur] = process.argv.slice(2);
const W = 960, H = 540;
const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', ss, '-t', dur, '-i', f, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const b = r.stdout, fs = W * H, n = Math.floor(b.length / fs);
const bands = [[0, 90, 'cielo arriba'], [90, 215, 'placa'], [215, 270, 'url'], [270, 345, 'cielo bajo/barco/sol'], [345, 370, 'horizonte'], [370, 455, 'mar medio+cta'], [455, 540, 'mar cerca']];
const acc = bands.map(() => 0);
for (let k = 1; k < n; k++) for (const [j, [y0, y1]] of bands.entries()) { let s = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; s += Math.abs(b[k * fs + i] - b[(k - 1) * fs + i]); } acc[j] += s; }
let tot = 0;
bands.forEach((bd, j) => { const v = acc[j] / (n - 1) / fs; tot += v; console.log(bd[2].padEnd(22), 'aporte', v.toFixed(3), ' media en la franja', (acc[j] / (n - 1) / ((bd[1] - bd[0]) * W)).toFixed(2)); });
console.log('total', tot.toFixed(2), 'cuadros', n);
