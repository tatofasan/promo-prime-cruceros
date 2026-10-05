// Verificación numérica (solo para medir): ¿la ola se lleva las letras SIN FUGAS? Cuadro a cuadro 3,55–3,87.
// Por cuadro dibuja por separado: el gris (hook-grey), el mar (hook-sea), la máscara y la cresta de reveal-sea.
//   · gris dentro de la máscara (lo que el agua YA pasó): tiene que ser 0
//   · mar FUERA de la máscara (todavía oficina): tiene que ser 0
//   · gris visible (alfa · (1 − cresta)) a la derecha del frente en su renglón: 0
// Lee píxeles vía PNG → sharp (sin la fuga de canvas.data()).
//   node src/scenes/type/_leak.mjs [--from=3.55 --to=3.87]
import { createCanvas } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { boot, root, parseArgs } from '../../../tools/node-env.mjs';
const flags = parseArgs();
await boot({ scenes: false });
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { resetLayers } = await imp('src/engine/layer.js');
const { W, H } = await imp('src/engine/time.js');
const sea = (await imp('src/scenes/reveal-sea.js')).default;
const th = (await imp('src/scenes/type-hook.js')).default;
await sea.init?.();
await th.init?.();
const { drawHookGrey } = await imp('src/scenes/type/hook-grey.js');
const { drawHookSea } = await imp('src/scenes/type/hook-sea.js');
const { WAVE } = await imp('src/scenes/type/wave-clip.js');

const cv = createCanvas(W, H);
const c = cv.getContext('2d');
async function alpha(fn) {
  resetLayers();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, W, H);
  c.save(); fn(c); c.restore();
  const { data } = await sharp(cv.encodeSync('png')).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return data;
}
const a = Number(flags.from ?? 3.55), z = Number(flags.to ?? 3.87);
const rows = [];
for (let f = Math.round(a * 60); f <= Math.round(z * 60); f++) {
  const t = f / 60;
  const p = WAVE.p(t);
  const G = await alpha((x) => drawHookGrey(x, t));
  const S = await alpha((x) => drawHookSea(x, t));
  const M = await alpha((x) => sea.mask(x, t));
  const Cr = await alpha((x) => sea.over?.(x, t));
  let gIn = 0, gInMax = 0, sOut = 0, sOutMax = 0, gVis = 0, sVis = 0;
  for (let i = 0; i < W * H; i++) {
    const m = M[i] / 255, g = G[i] / 255, s = S[i] / 255, cr = Cr[i] / 255;
    // a 2 px del borde de la máscara el antialias se comparte: se mira solo lo claramente adentro/afuera
    if (m > 0.98 && g > 0.02) { gIn++; gInMax = Math.max(gInMax, g); }
    if (m < 0.02 && s > 0.02) { sOut++; sOutMax = Math.max(sOutMax, s); }
    if (g * (1 - cr) > 0.02) gVis++;
    if (s * (1 - cr) > 0.02) sVis++;
  }
  rows.push(`${t.toFixed(4)} p=${p.toFixed(3)}  gris en máscara: ${gIn} px (máx α ${gInMax.toFixed(2)})  mar fuera: ${sOut} px (máx α ${sOutMax.toFixed(2)})  visibles gris/mar: ${gVis}/${sVis}`);
}
console.log(rows.join('\n'));
