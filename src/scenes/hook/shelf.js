// Estante de pared con biblioratos grises, uno caído, una caja de archivo y un cactus triste (horneado).
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, circlePath, ellipsePath } from '../../engine/draw.js';
import { SHELF } from './layout.js';
import { shadowOnly } from './util.js';

const BINDERS = [
  [34, 122, PAL.grey500], [30, 114, PAL.grey600], [38, 126, mixHex(PAL.grey400, PAL.grey500, 0.5)],
  [28, 110, PAL.grey700], [34, 120, PAL.grey500], [32, 116, mixHex(PAL.grey600, PAL.navy600, 0.15)],
  [36, 124, PAL.grey400],
];

function binder(g, x, y, w, h, col, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  // lomo: base, filo claro a la izquierda, sombra a la derecha
  fill(g, rrectPath(0, -h, w, h, 4), col);
  fill(g, rrectPath(0, -h, 3, h, 1.5), rgba(PAL.white, 0.22));
  fill(g, rrectPath(w - 6, -h, 6, h, 2), rgba(PAL.ink, 0.25));
  // etiqueta y agujero para el dedo
  fill(g, rrectPath(w * 0.18, -h * 0.82, w * 0.64, h * 0.3, 2), mixHex(PAL.grey200, col, 0.25));
  g.fillStyle = rgba(PAL.grey600, 0.45);
  g.fillRect(w * 0.26, -h * 0.75, w * 0.48, 2);
  g.fillRect(w * 0.26, -h * 0.68, w * 0.32, 2);
  fill(g, circlePath(w / 2, -h * 0.2, w * 0.2), mixHex(col, PAL.grey200, 0.35));
  fill(g, circlePath(w / 2, -h * 0.2, w * 0.13), rgba(PAL.ink, 0.6));
  g.restore();
}

export function paintShelf(g) {
  const { x, y, w } = SHELF;
  // sombra del estante y de lo que apoya
  shadowOnly(g, 1.1, rrectPath(x, y - 120, w, 134, 4), { dx: 12, dy: 18, blur: 26, color: rgba(PAL.ink, 0.45) });
  // ménsulas
  for (const bx of [x + 36, x + w - 44]) {
    fill(g, rrectPath(bx, y + 12, 8, 34, 2), PAL.grey700);
    fill(g, rrectPath(bx, y + 12, 2, 34, 1), rgba(PAL.white, 0.15));
  }
  // caja de archivo a la izquierda
  const cx = x + 8;
  fill(g, rrectPath(cx, y - 74, 64, 74, 3), lin(g, cx, 0, cx + 64, 0, [PAL.grey400, PAL.grey500]));
  fill(g, rrectPath(cx, y - 74, 64, 6, 2), rgba(PAL.white, 0.25));
  fill(g, rrectPath(cx + 20, y - 52, 24, 9, 4), rgba(PAL.ink, 0.45));
  // biblioratos en fila
  let bx = x + 80;
  for (const [bw, bh, col] of BINDERS.slice(0, 5)) { binder(g, bx, y, bw, bh, col); bx += bw + 2; }
  // uno caído, apoyado en el último
  binder(g, bx + 4, y, 30, 112, PAL.grey600, 0.3);
  // cactus en maceta (desaturado: la única planta y está apagada)
  const px = x + w - 18;
  const green = mixHex('#6E8A7A', PAL.grey500, 0.55);
  fill(g, rrectPath(px - 8, y - 66, 16, 50, 8), green);
  fill(g, rrectPath(px + 4, y - 50, 12, 22, 6), green);
  fill(g, rrectPath(px - 8, y - 66, 4, 48, 2), rgba(PAL.white, 0.18));
  fill(g, rrectPath(px - 15, y - 22, 30, 22, 3), lin(g, px - 15, 0, px + 15, 0, [PAL.grey300, PAL.grey500]));
  fill(g, rrectPath(px - 17, y - 24, 34, 6, 2), PAL.grey300);
  // tabla del estante: cara superior clara, frente, filo
  fill(g, rrectPath(x - 6, y - 3, w + 12, 5, 1), PAL.grey200);
  fill(g, rrectPath(x - 6, y + 2, w + 12, 12, 1), lin(g, 0, y + 2, 0, y + 14, [PAL.grey400, PAL.grey600]));
  fill(g, ellipsePath(x + w / 2, y + 16, w * 0.5, 2, 0), rgba(PAL.ink, 0.25));
}
