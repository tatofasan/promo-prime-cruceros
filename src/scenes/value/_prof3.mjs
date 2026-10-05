// Perfil del compositor por etapas en t (mapa, valor con máscara, over, grade).
import { createCanvas } from '@napi-rs/canvas';
import { scenes } from './_boot.mjs';
import { resetLayers, layer } from '../../engine/layer.js';
import { applyGrade } from '../../engine/grade.js';
const t = Number(process.argv[2] ?? 20.6);
const out = createCanvas(1920, 1080).getContext('2d');
const flush = (c) => c.getImageData(0, 0, 1, 1);
for (let rep = 0; rep < 3; rep++) {
  const T0 = performance.now();
  resetLayers();
  const stage = layer(); const sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, 1920, 1080);
  const times = {};
  for (const s of scenes) {
    if (!(t >= s.from && t < s.to)) continue;
    let a = performance.now();
    if (s.mask && t >= (s.maskFrom ?? -1) && t <= (s.maskUntil ?? 99)) {
      const L = layer(); const lc = L.getContext('2d');
      s.draw(lc, t); flush(lc); times[s.id + '.draw'] = performance.now() - a; a = performance.now();
      const M = layer(); s.mask(M.getContext('2d'), t); flush(M.getContext('2d')); times[s.id + '.mask'] = performance.now() - a; a = performance.now();
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'destination-in'; lc.drawImage(M, 0, 0); flush(lc);
      times[s.id + '.din'] = performance.now() - a; a = performance.now();
      sc.drawImage(L, 0, 0); flush(sc); times[s.id + '.blit'] = performance.now() - a;
    } else { sc.save(); s.draw(sc, t); sc.restore(); flush(sc); times[s.id] = performance.now() - a; }
    a = performance.now();
    if (s.over) { sc.save(); s.over(sc, t); sc.restore(); flush(sc); times[s.id + '.over'] = performance.now() - a; }
  }
  let a = performance.now();
  out.drawImage(stage, 0, 0); applyGrade(out, t); flush(out); times.grade = performance.now() - a;
  times.total = performance.now() - T0;
  if (rep === 2) console.log(t, Object.fromEntries(Object.entries(times).map(([k, v]) => [k, +v.toFixed(0)])));
}
