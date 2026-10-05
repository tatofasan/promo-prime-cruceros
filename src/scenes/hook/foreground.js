// Primer plano (plano D.fg, fuera de foco): una sansevieria apagada que asoma abajo a la izquierda y el respaldo
// de una silla de oficina abajo a la derecha (se reconoce: marco, malla y filo de luz). Horneados ya desenfocados. Más polvo flotando en la luz del tubo.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, ellipsePath, smoothPath, rad } from '../../engine/draw.js';
import { E, clamp } from '../../engine/ease.js';
import { hash, noise1 } from '../../engine/noise.js';
import { bake, blurSprite, put } from './util.js';
import { T } from './layout.js';

let PLANT = null, TOOLS = null;
const LEAF = mixHex('#5E7868', PAL.grey600, 0.45);
const LEAF_DK = mixHex(LEAF, PAL.ink, 0.35);
const LEAF_EDGE = mixHex('#C9C79A', PAL.grey300, 0.6);
const BASE = [110, 1160]; // base de la planta (fuera de cuadro)

export function initForeground() {
  const plant = bake(-160, 520, 520, 700, 0.6, (g) => {
    const leaves = [[-0.32, 520, 64], [-0.12, 610, 72], [0.06, 560, 66], [0.24, 470, 60], [-0.5, 400, 54], [0.4, 380, 50]];
    for (const [a, len, w] of leaves) {
      g.save();
      g.translate(BASE[0], BASE[1]);
      g.rotate(a);
      // hoja: mitad iluminada, mitad en sombra, borde claro y bandas
      const half = (side) => {
        const p = smoothPath([[0, 0], [side * w * 0.5, -len * 0.35], [side * w * 0.42, -len * 0.75], [side * 4, -len]]);
        p.lineTo(0, -len); p.lineTo(0, 0); p.closePath();
        return p;
      };
      fill(g, half(-1), LEAF);
      fill(g, half(1), LEAF_DK);
      g.strokeStyle = LEAF_EDGE; g.lineWidth = 5;
      g.stroke(smoothPath([[-w * 0.04, 0], [-w * 0.5, -len * 0.35], [-w * 0.42, -len * 0.75], [-4, -len]]));
      g.fillStyle = rgba(PAL.ink, 0.18);
      for (let k = 1; k < 9; k++) g.fillRect(-w * 0.45, -len * (k / 10), w * 0.9, 6);
      g.restore();
    }
  });
  PLANT = blurSprite(plant, 10);
  // respaldo de silla de oficina (de espaldas) abajo a la derecha: marco de plástico, malla y filo de luz fría
  const chair = bake(1420, 860, 700, 400, 0.6, (g) => {
    const back = new Path2D('M1500 1240 C1490 1080 1520 960 1600 930 C1700 900 1880 900 1980 932 C2060 960 2080 1080 2070 1240 Z');
    const mesh = new Path2D('M1540 1240 C1534 1096 1556 990 1618 966 C1708 940 1872 940 1962 968 C2024 992 2038 1096 2032 1240 Z');
    fill(g, back, lin(g, 0, 900, 0, 1240, [mixHex(PAL.grey700, PAL.navy700, 0.3), mixHex(PAL.grey900, PAL.ink, 0.45)]));
    fill(g, mesh, lin(g, 1540, 0, 2040, 0, [mixHex(PAL.grey900, PAL.navy800, 0.3), mixHex(PAL.grey900, PAL.navy700, 0.2), mixHex(PAL.grey900, PAL.ink, 0.5)]));
    g.save();
    g.clip(mesh);
    g.strokeStyle = rgba(PAL.grey500, 0.22);
    g.lineWidth = 3;
    for (let x = 1400; x < 2200; x += 22) { g.beginPath(); g.moveTo(x, 900); g.lineTo(x + 340, 1260); g.stroke(); g.beginPath(); g.moveTo(x + 340, 900); g.lineTo(x, 1260); g.stroke(); }
    g.restore();
    // costura central y sombra del lado derecho
    g.strokeStyle = rgba(PAL.ink, 0.4); g.lineWidth = 6;
    g.beginPath(); g.moveTo(1786, 948); g.lineTo(1786, 1240); g.stroke();
    fill(g, new Path2D('M1960 968 C2024 992 2038 1096 2032 1240 L2070 1240 C2080 1080 2060 960 1980 932 Z'), rgba(PAL.ink, 0.35));
    // filo de luz fría arriba (tubo + pantalla)
    g.strokeStyle = rgba(PAL.aqua100, 0.55); g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(1540, 1010); g.bezierCurveTo(1560, 950, 1610, 934, 1700, 918); g.bezierCurveTo(1800, 906, 1890, 912, 1960, 930); g.stroke();
    g.strokeStyle = rgba(PAL.white, 0.5); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(1590, 948); g.bezierCurveTo(1650, 922, 1760, 910, 1860, 914); g.stroke();
  });
  TOOLS = blurSprite(chair, 4);
}

/** Primer plano. dark = cuánto lo apaga el parpadeo del tubo. */
export function drawForeground(ctx, t) {
  const wind = t > T.surge ? E.outCubic(clamp((t - T.surge) / 0.3)) : 0;
  const sway = 0.012 * Math.sin(t * 1.3) - 0.12 * wind - 0.03 * wind * Math.sin(t * 24);
  ctx.save();
  ctx.translate(BASE[0], BASE[1]);
  ctx.rotate(sway);
  ctx.translate(-BASE[0], -BASE[1]);
  put(ctx, PLANT);
  ctx.restore();
  put(ctx, TOOLS);
}

/** Polvo en suspensión dentro del cono de luz (lo agita el estallido). */
export function drawDust(ctx, t, light = 1) {
  const wind = t > T.surge ? (t - T.surge) : 0;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 34; i++) {
    const x0 = 160 + hash(i, 1) * 1050, y0 = 70 + hash(i, 2) * 620;
    const x = x0 + 26 * noise1(t * 0.35 + i, 3) + t * 7 - wind * wind * 2600 * (0.5 + hash(i, 4));
    const y = y0 + 22 * noise1(t * 0.3 + i * 1.7, 5) - wind * 300;
    const r = 1.5 + hash(i, 6) * 3.2;
    const a = (0.12 + 0.25 * hash(i, 7)) * light * (0.6 + 0.4 * Math.sin(t * 2 + i));
    if (a <= 0.01) continue;
    ctx.fillStyle = rad(ctx, x, y, r * 2.2, [[0, rgba(PAL.grey200, a)], [1, rgba(PAL.grey200, 0)]]);
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }
  ctx.restore();
}
