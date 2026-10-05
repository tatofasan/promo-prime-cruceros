// Medidas de cajas de tinta de los titulares (solo para diseño): node src/scenes/type/_measure.mjs
import { createCanvas } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { boot, root } from '../../../tools/node-env.mjs';
await boot({ scenes: false });
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { txt } = await imp('src/engine/text.js');
const c = createCanvas(10, 10).getContext('2d');
const show = (s, o) => {
  const T = txt(s, o);
  c.font = T.font;
  const m = c.measureText(s);
  const gl = T.lines[0].glyphs.map((g) => { const mm = c.measureText(g.ch); return `${g.ch}:${g.x.toFixed(0)}+${g.w.toFixed(0)} [${(-mm.actualBoundingBoxAscent).toFixed(0)},${mm.actualBoundingBoxDescent.toFixed(0)}]`; });
  console.log(s, o.size, 'w', T.width.toFixed(1), 'capH', T.capH.toFixed(1), 'base', T.lines[0].base.toFixed(1), 'asc', m.actualBoundingBoxAscent.toFixed(1), 'desc', m.actualBoundingBoxDescent.toFixed(1));
  console.log('   ', gl.join(' '));
};
show('¿Y SI', { size: 212, weight: 900, tracking: -0.02 });
show('TUS PRÓXIMAS', { size: 112, weight: 900, tracking: -0.01 });
show('VACACIONES…', { size: 118, weight: 900, tracking: -0.01 });
show('…FUERAN EN', { size: 112, weight: 900, tracking: -0.01 });
show('CRUCERO?', { size: 214, weight: 900, tracking: -0.02 });
show('EXPERIENCIAS', { size: 118, weight: 900, tracking: -0.015 });
show('ÚNICAS', { size: 170, weight: 900, tracking: -0.02 });
show('EN CRUCERO', { size: 96, weight: 900, tracking: 0.03 });
