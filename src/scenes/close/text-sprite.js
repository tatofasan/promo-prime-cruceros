// Texto ya quieto pre-pintado a 2× con su sombra (una vez): se dibuja con un drawImage en lugar de 20+ letras con
// sombra por cuadro. Mismo layout que drawText (txt() del motor): caja, línea base y kerning idénticos.
import { makeCanvas } from '../../engine/env.js';

const cache = new Map();

/** T = txt(...) · o = { fill, shadow: { color, blur, x, y }, extrude: { depth, color, dx, dy } (como drawText) } */
export function textSprite(T, o = {}) {
  const key = T.font + '|' + T.lines.map((l) => l.text).join('\n') + '|' + JSON.stringify(o);
  let S = cache.get(key);
  if (S) return S;
  const ex = o.extrude ? (o.extrude.depth ?? 8) * Math.max(Math.abs(o.extrude.dx ?? 0.7), Math.abs(o.extrude.dy ?? 1)) : 0;
  const k = 2, pad = Math.ceil(((o.shadow?.blur ?? 0) * 1.5) + Math.abs(o.shadow?.y ?? 0) + 6 + ex);
  const cv = makeCanvas(Math.ceil((T.width + pad * 2) * k), Math.ceil((T.height + pad * 2) * k));
  const c = cv.getContext('2d');
  c.scale(k, k);
  c.translate(pad, pad);
  c.font = T.font;
  c.textBaseline = 'alphabetic';
  if (o.extrude) {
    // letra 3D: copias corridas en el color de la extrusión, de atrás hacia adelante (igual que drawText)
    const { depth = 8, color = '#0A2340', dx = 0.7, dy = 1 } = o.extrude;
    c.fillStyle = color;
    for (let q = depth; q >= 1; q--) for (const ln of T.lines) for (const g of ln.glyphs) c.fillText(g.ch, ln.x0 + g.x + dx * q, ln.base + dy * q);
  }
  if (o.shadow) {
    c.shadowColor = o.shadow.color;
    c.shadowBlur = (o.shadow.blur ?? 0) * k;
    c.shadowOffsetX = (o.shadow.x ?? 0) * k;
    c.shadowOffsetY = (o.shadow.y ?? 0) * k;
  }
  c.fillStyle = o.fill ?? '#ffffff';
  for (const ln of T.lines) for (const g of ln.glyphs) c.fillText(g.ch, ln.x0 + g.x, ln.base);
  S = { cv, pad, w: cv.width / k, h: cv.height / k, T };
  cache.set(key, S);
  return S;
}

/** Dibuja el sprite con la caja del texto anclada en (x, y) como drawText (anchor [ax, ay]). */
export function drawTextSprite(ctx, S, x, y, [ax, ay] = [0, 0]) {
  ctx.drawImage(S.cv, x - ax * S.T.width - S.pad, y - ay * S.T.height - S.pad, S.w, S.h);
}
