// Escritorio (plano D.desk, horneado): tapa de laminado frío con reflejo del tubo, canto con filo de luz,
// cajonera en la sombra y la rutina encima: teclado, mouse, teléfono de línea, lapicero y cuaderno.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, rad, fill, rrectPath, ellipsePath, polyPath, texture } from '../../engine/draw.js';
import { rng } from '../../engine/noise.js';
import { bake, put, shadowOnly } from './util.js';
import { DESK, KEYB, MOUSE, MON, MUG, STACK } from './layout.js';

const BX = -340, BY = 740, BW = 2600, BH = 470, S = 1.15;
let SPR = null;
const TOP_BACK = mixHex(PAL.grey700, PAL.grey600, 0.5);
const TOP_FRONT = mixHex(PAL.grey500, PAL.grey400, 0.45);

export function initDesk() {
  SPR = bake(BX, BY, BW, BH, S, (g) => {
    paintTop(g);
    paintFrontAndUnder(g);
    // sombras proyectadas largas (la luz del tubo viene de arriba a la izquierda)
    const cast = (x, y, rx, ry, a = 0.32) => shadowOnly(g, S, ellipsePath(x, y, rx, ry, -0.03), { blur: 18, color: rgba(PAL.ink, a) });
    cast(MON.cx + 90, 806, 190, 16);
    cast(MUG.x + 50, MUG.y + 4, 80, 10);
    cast(STACK.x + 60, STACK.y + 4, 130, 12, 0.36);
    cast(KEYB.cx + 50, KEYB.yf + 8, 260, 10, 0.26);
    cast(740, 904, 170, 12);
    cast(500, 902, 50, 8);
    cast(340, 906, 140, 8, 0.22);
    // sombras de contacto de lo que vive aparte (monitor, taza, pila)
    fill(g, ellipsePath(MON.cx + 10, 803, 150, 15), rgba(PAL.ink, 0.35));
    fill(g, ellipsePath(MUG.x + 8, MUG.y + 2, 58, 9), rgba(PAL.ink, 0.35));
    fill(g, ellipsePath(STACK.x + 10, STACK.y + 3, 100, 11), rgba(PAL.ink, 0.38));
    paintNotebook(g, 210, 902);
    paintPenCup(g, 476, 900);
    paintPhone(g, 600, 900);
    paintKeyboard(g);
    paintMouse(g);
  });
}

function paintTop(g) {
  const top = rrectPath(BX, DESK.back, BW, DESK.front - DESK.back, 0);
  fill(g, top, lin(g, 0, DESK.back, 0, DESK.front, [TOP_BACK, mixHex(TOP_BACK, TOP_FRONT, 0.6), TOP_FRONT]));
  // vetas largas del laminado
  const r = rng(5);
  for (let i = 0; i < 46; i++) {
    const y = DESK.back + 6 + r() * (DESK.front - DESK.back - 10);
    const x = BX + r() * BW, w = 120 + r() * 520;
    g.fillStyle = rgba(r() < 0.5 ? PAL.grey200 : PAL.grey700, 0.05 + r() * 0.06);
    g.fillRect(x, y, w, 1 + r() * 1.4);
  }
  // reflejo del tubo fluorescente sobre la tapa
  fill(g, top, rad(g, 640, 820, 520, [[0, rgba(PAL.grey200, 0.2)], [1, rgba(PAL.grey200, 0)]]));
  fill(g, rrectPath(260, 790, 760, 6, 3), rgba(PAL.white, 0.06));
  // oclusión contra la pared
  fill(g, rrectPath(BX, DESK.back, BW, 26, 0), lin(g, 0, DESK.back, 0, DESK.back + 26, [rgba(PAL.ink, 0.4), rgba(PAL.ink, 0)]));
  texture(g, top, { alpha: 0.07, scale: 1.2 });
}

function paintFrontAndUnder(g) {
  const { front, lip } = DESK;
  // bajo mesada: oscuro
  fill(g, rrectPath(BX, lip, BW, BY + BH - lip, 0), lin(g, 0, lip, 0, BY + BH, [mixHex(PAL.grey900, PAL.ink, 0.3), PAL.ink]));
  // cajonera a la derecha, en la sombra
  const cx = 1560, cw = 330;
  fill(g, rrectPath(cx, lip, cw, 220, 0), mixHex(PAL.grey700, PAL.grey900, 0.45));
  fill(g, rrectPath(cx + 12, lip + 10, cw - 24, 64, 4), mixHex(PAL.grey700, PAL.grey600, 0.3));
  fill(g, rrectPath(cx + 12, lip + 10, cw - 24, 2, 1), rgba(PAL.white, 0.12));
  fill(g, rrectPath(cx + 120, lip + 34, 90, 8, 4), PAL.grey500);
  fill(g, rrectPath(cx + 120, lip + 34, 90, 2.5, 1), rgba(PAL.white, 0.35));
  fill(g, rrectPath(cx + 12, lip + 84, cw - 24, 64, 4), mixHex(PAL.grey700, PAL.grey600, 0.2));
  fill(g, rrectPath(cx + 120, lip + 108, 90, 8, 4), PAL.grey600);
  fill(g, rrectPath(BX, lip, BW, 46, 0), lin(g, 0, lip, 0, lip + 46, [rgba(PAL.ink, 0.65), rgba(PAL.ink, 0)]));
  // canto: filo de luz, frente y sombra inferior
  fill(g, rrectPath(BX, front - 1, BW, lip - front + 1, 0), lin(g, 0, front, 0, lip, [PAL.grey500, mixHex(PAL.grey600, PAL.grey700, 0.5)]));
  fill(g, rrectPath(BX, front - 1, BW, 3, 0), rgba(PAL.grey200, 0.85));
  fill(g, rrectPath(BX, front + 2, BW, 3, 0), rgba(PAL.white, 0.12));
  fill(g, rrectPath(BX, lip - 3, BW, 3, 0), rgba(PAL.ink, 0.45));
  texture(g, rrectPath(BX, front, BW, lip - front, 0), { alpha: 0.08 });
}

function paintKeyboard(g) {
  const { cx, yb, yf, wb, wf } = KEYB;
  fill(g, ellipsePath(cx + 14, yf + 10, wf * 0.56, 12), rgba(PAL.ink, 0.35));
  // cuerpo: cara superior en perspectiva + frente
  const body = polyPath([[cx - wb / 2, yb], [cx + wb / 2, yb], [cx + wf / 2, yf], [cx - wf / 2, yf]]);
  fill(g, body, lin(g, 0, yb, 0, yf, [PAL.grey500, PAL.grey400]));
  fill(g, rrectPath(cx - wf / 2, yf, wf, 11, 3), lin(g, 0, yf, 0, yf + 11, [PAL.grey500, PAL.grey700]));
  fill(g, rrectPath(cx - wf / 2, yf - 1, wf, 2, 1), rgba(PAL.grey200, 0.7));
  // teclas por fila (cada una con tapa clara y labio oscuro)
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y0 = yb + 5 + r * ((yf - yb - 8) / rows);
    const kh = (yf - yb - 8) / rows - 2.4;
    const p = (r + 0.5) / rows;
    const rw = wb + (wf - wb) * p - 18;
    const x0 = cx - rw / 2;
    const n = r === rows - 1 ? 9 : 14;
    const kw = rw / n;
    for (let k = 0; k < n; k++) {
      let w = kw - 2.4, x = x0 + k * kw;
      if (r === rows - 1 && k === 3) w = kw * 3 - 2.4;
      if (r === rows - 1 && (k === 4 || k === 5)) continue;
      fill(g, rrectPath(x, y0 + 1.6, w, kh, 2), mixHex(PAL.grey600, PAL.grey700, 0.3));
      fill(g, rrectPath(x + 0.6, y0, w - 1.2, kh - 1.2, 2), mixHex(PAL.grey300, PAL.grey200, r / 8));
    }
  }
  texture(g, body, { alpha: 0.06 });
}

function paintMouse(g) {
  const { x, y } = MOUSE;
  // alfombrita
  fill(g, rrectPath(x - 66, y - 12, 136, 24, 6), mixHex(PAL.grey700, PAL.grey900, 0.4));
  fill(g, rrectPath(x - 66, y + 10, 136, 4, 2), PAL.grey600);
  // mouse: base, filo, sombra
  fill(g, ellipsePath(x + 6, y + 6, 26, 7), rgba(PAL.ink, 0.45));
  fill(g, ellipsePath(x, y - 4, 23, 15), lin(g, x - 20, y - 18, x + 20, y + 10, [PAL.grey200, PAL.grey300, PAL.grey500]));
  fill(g, rrectPath(x - 1, y - 18, 2, 12, 1), rgba(PAL.grey600, 0.6));
  fill(g, ellipsePath(x - 8, y - 11, 8, 3.5, -0.3), rgba(PAL.white, 0.55));
  // cable hacia el monitor
  g.strokeStyle = PAL.grey700; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y - 18); g.bezierCurveTo(x - 6, y - 50, x - 120, y - 40, MON.cx + 40, 800); g.stroke();
}

function paintPhone(g, x, y) {
  const dark = mixHex(PAL.grey700, PAL.grey900, 0.35);
  fill(g, ellipsePath(x + 120, y + 3, 130, 10), rgba(PAL.ink, 0.35));
  // cuerpo en cuña: frente, tapa inclinada
  fill(g, rrectPath(x, y - 46, 230, 46, 8), lin(g, 0, y - 46, 0, y, [PAL.grey600, dark]));
  fill(g, polyPath([[x + 6, y - 44], [x + 224, y - 44], [x + 214, y - 62], [x + 16, y - 62]]), PAL.grey500);
  fill(g, rrectPath(x + 16, y - 62, 198, 2, 1), rgba(PAL.white, 0.3));
  // visor apagado y teclado sin números
  fill(g, rrectPath(x + 22, y - 36, 74, 18, 3), mixHex(PAL.grey900, PAL.ink, 0.5));
  fill(g, rrectPath(x + 28, y - 30, 40, 2, 1), rgba(PAL.grey300, 0.25));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    fill(g, rrectPath(x + 116 + c * 26, y - 38 + r * 11, 20, 7, 2), PAL.grey400);
    fill(g, rrectPath(x + 116 + c * 26, y - 38 + r * 11, 20, 2, 1), rgba(PAL.white, 0.3));
  }
  // tubo apoyado arriba
  fill(g, rrectPath(x + 4, y - 86, 200, 26, 12), lin(g, 0, y - 86, 0, y - 60, [PAL.grey500, dark]));
  fill(g, rrectPath(x - 4, y - 92, 44, 32, 12), lin(g, 0, y - 92, 0, y - 60, [PAL.grey500, dark]));
  fill(g, rrectPath(x + 170, y - 92, 44, 32, 12), lin(g, 0, y - 92, 0, y - 60, [PAL.grey500, dark]));
  fill(g, rrectPath(x + 8, y - 90, 190, 3, 1.5), rgba(PAL.white, 0.25));
  // cable enrulado
  g.strokeStyle = PAL.grey700; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= 18; i++) {
    const p = i / 18;
    const cxp = x - 10 - Math.sin(p * Math.PI) * 26, cyp = y - 64 + p * 56;
    g.lineTo(cxp + (i % 2 ? 7 : -7), cyp);
  }
  g.stroke();
}

function paintPenCup(g, x, y) {
  fill(g, ellipsePath(x + 6, y + 2, 34, 6), rgba(PAL.ink, 0.35));
  // lapiceras (detrás del borde)
  const pens = [[-12, 66, PAL.grey300, -0.12], [2, 78, PAL.grey900, 0.04], [14, 60, PAL.grey500, 0.16], [-2, 92, PAL.grey400, -0.03]];
  for (const [dx, h, col, rot] of pens) {
    g.save(); g.translate(x + dx, y - 50); g.rotate(rot);
    fill(g, rrectPath(-3.5, -h + 50, 7, h, 3), col);
    fill(g, rrectPath(-3.5, -h + 50, 2, h, 1), rgba(PAL.white, 0.25));
    g.restore();
  }
  // vaso en tres tonos
  fill(g, rrectPath(x - 26, y - 56, 52, 56, 5), lin(g, x - 26, 0, x + 26, 0, [PAL.grey500, PAL.grey600, PAL.grey700]));
  fill(g, rrectPath(x - 23, y - 54, 4, 50, 2), rgba(PAL.white, 0.22));
  fill(g, ellipsePath(x, y - 56, 26, 5), mixHex(PAL.grey900, PAL.ink, 0.4));
}

function paintNotebook(g, x, y) {
  fill(g, ellipsePath(x + 112, y + 4, 120, 8), rgba(PAL.ink, 0.3));
  fill(g, rrectPath(x, y - 20, 220, 13, 3), PAL.grey500);
  fill(g, rrectPath(x, y - 8, 220, 9, 2), PAL.grey200);
  for (let i = 0; i < 3; i++) fill(g, rrectPath(x + 2, y - 6 + i * 3, 216, 1, 0), rgba(PAL.grey500, 0.5));
  fill(g, rrectPath(x, y, 220, 4, 2), PAL.grey600);
  fill(g, rrectPath(x + 170, y - 21, 7, 25, 2), PAL.grey700);
  fill(g, rrectPath(x, y - 20, 220, 2, 1), rgba(PAL.white, 0.3));
  // lápiz encima
  g.save(); g.translate(x + 40, y - 24); g.rotate(-0.04);
  fill(g, rrectPath(0, -4, 120, 7, 2), PAL.grey300);
  fill(g, polyPath([[120, -4], [134, -0.5], [120, 3]]), PAL.grey200);
  g.restore();
}

/** Escritorio horneado. */
export function drawDesk(ctx) {
  put(ctx, SPR);
}
