// SELLO «DESDE USD 355»: tinta con textura de goma (manchas, poros y bordes comidos), precalculada en init.
import { PAL, rgb } from '../../engine/color.js';
import { fbm2, hash } from '../../engine/noise.js';
import { fontStr } from '../../engine/text.js';
import { sprite, drawSprite, rr, label } from './util.js';

export const INK = '#E8401E';
const SW = 560, SH = 250;
let SPR = null;

function paintStamp(c) {
  c.strokeStyle = INK;
  c.fillStyle = INK;
  // doble marco redondeado
  c.lineWidth = 11;
  c.beginPath(); rr(c, -SW / 2 + 8, -SH / 2 + 8, SW - 16, SH - 16, 30); c.stroke();
  c.lineWidth = 4;
  c.beginPath(); rr(c, -SW / 2 + 26, -SH / 2 + 26, SW - 52, SH - 52, 18); c.stroke();
  // «DESDE» entre dos rayitas
  label(c, 'DESDE', 0, -SH / 2 + 82, { font: fontStr(800, 44), color: INK, tracking: 44 * 0.32, align: 'center' });
  c.fillRect(-SW / 2 + 58, -SH / 2 + 64, 96, 6);
  c.fillRect(SW / 2 - 154, -SH / 2 + 64, 96, 6);
  // «USD 355»
  label(c, 'USD 355', 0, SH / 2 - 44, { font: fontStr(900, 124), color: INK, tracking: -124 * 0.01, align: 'center' });
  // estrellitas laterales
  for (const sx of [-1, 1]) {
    c.save();
    c.translate(sx * (SW / 2 - 52), -SH / 2 + 66);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6 : 15;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
  }
}

/** Gasta la tinta: poros finos, manchas claras grandes y un poco más de carga en un costado. */
function distress(cv) {
  const x = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4 + 3;
      if (!d[k]) continue;
      const big = fbm2(i * 0.012, j * 0.012, 7, 3);
      const fine = hash(i, j, 3);
      const side = i / w;
      let a = 1;
      if (big > 0.26 - side * 0.2) a *= 0.62 + 0.2 * side;
      if (fine < 0.05 + 0.05 * (1 - side)) a *= 0.2;
      a *= 0.9 + 0.1 * side;
      d[k] = Math.round(d[k] * a);
    }
  }
  x.putImageData(img, 0, 0);
}

export function initStamp() {
  if (SPR) return;
  SPR = sprite(SW + 20, SH + 20, (SW + 20) / 2, (SH + 20) / 2, 1.5, paintStamp);
  distress(SPR.c);
}

/** Dibuja la impresión del sello (centro en 0,0). k = escala, a = alfa. */
export function drawStampImprint(c, { a = 1, k = 1, bleed = 0 } = {}) {
  c.save();
  c.scale(k, k);
  c.globalAlpha *= a;
  if (bleed > 0.02) {
    // la tinta «se abre» un instante al golpear (copias apenas más grandes, sin filtro: barato)
    for (const e of [1.035, 1.018]) {
      c.save();
      c.globalAlpha *= 0.22 * bleed;
      c.scale(e, e);
      drawSprite(c, SPR);
      c.restore();
    }
  }
  drawSprite(c, SPR);
  c.restore();
}

export { rgb, PAL };
