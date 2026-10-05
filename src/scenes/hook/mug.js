// Taza de café (horneada, cerámica en tres tonos) y su vapor en vivo: tres hilos que suben ondulando;
// en c1 el vapor sube más alto y más rápido, y en el estallido se lo lleva el viento.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, rad, fill, rrectPath, ellipsePath } from '../../engine/draw.js';
import { clamp, prog, E } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { bake, put } from './util.js';
import { MUG, T } from './layout.js';

let SPR = null;
const CER = mixHex(PAL.grey300, PAL.grey400, 0.35);

export function initMug() {
  const { x, y, w, h } = MUG;
  SPR = bake(x - w, y - h - 20, w * 2.2, h + 40, 2, (g) => {
    const l = x - w / 2, top = y - h;
    // asa (detrás a la derecha)
    g.strokeStyle = mixHex(CER, PAL.grey600, 0.4);
    g.lineWidth = 13;
    g.beginPath(); g.ellipse(l + w + 2, top + h * 0.45, 22, 28, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.strokeStyle = rgba(PAL.white, 0.25); g.lineWidth = 3;
    g.beginPath(); g.ellipse(l + w + 2, top + h * 0.45, 26, 32, 0, -Math.PI / 2, -0.2); g.stroke();
    // cuerpo: base clara a la izquierda (luz), sombra plana a la derecha, filo
    const body = new Path2D();
    body.moveTo(l, top);
    body.lineTo(l + w, top);
    body.lineTo(l + w - 4, y - 10);
    body.quadraticCurveTo(l + w - 6, y, l + w - 16, y);
    body.lineTo(l + 16, y);
    body.quadraticCurveTo(l + 6, y, l + 4, y - 10);
    body.closePath();
    fill(g, body, lin(g, l, 0, l + w, 0, [mixHex(CER, PAL.grey200, 0.6), CER, CER, mixHex(CER, PAL.grey600, 0.5)]));
    g.save();
    g.clip(body);
    fill(g, rrectPath(l + w * 0.64, top, w * 0.4, h, 0), rgba(PAL.ink, 0.16));
    fill(g, rrectPath(l + 6, top + 8, 5, h - 22, 2.5), rgba(PAL.white, 0.5));
    // franja pintada (detalle)
    fill(g, rrectPath(l, top + h * 0.56, w, 9, 0), mixHex(PAL.grey600, PAL.navy600, 0.2));
    g.restore();
    // boca: borde, café adentro con reflejo
    fill(g, ellipsePath(x, top, w / 2, 9), mixHex(CER, PAL.white, 0.4));
    fill(g, ellipsePath(x, top + 1.5, w / 2 - 5, 6.5), mixHex('#3A2E28', PAL.grey900, 0.5));
    fill(g, ellipsePath(x - 12, top + 0.5, 10, 2), rgba(PAL.white, 0.25));
  });
}

export function drawMug(ctx) {
  put(ctx, SPR);
}

/** Intensidad del vapor: tranquilo en c0, sube en c1. */
const steamK = (t) => 0.55 + 0.45 * E.inOutSine(prog(t, T.q[0] - 0.4, T.leak));

/** Vapor: hilos hechos de manchas suaves que suben y ondulan. */
export function drawSteam(ctx, t) {
  const k = steamK(t);
  const wind = t > T.surge ? E.outCubic(clamp((t - T.surge) / 0.25)) : 0;
  const top = MUG.y - MUG.h;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let s = 0; s < 3; s++) {
    const n = 16;
    const rise = 150 + 110 * k;
    const speed = 0.55 + 0.6 * k;
    for (let i = 0; i < n; i++) {
      const p = ((i / n) + t * speed * 0.6 + s * 0.31) % 1;
      const y = top - 6 - p * rise;
      const x = MUG.x + (s - 1) * 16 + noise1(p * 3 - t * 0.9 + s * 7, 41) * 26 * (0.3 + p) - wind * 380 * p * p;
      const r = 9 + p * 26;
      const a = 0.34 * k * Math.sin(p * Math.PI) * (1 - wind * 0.6);
      if (a < 0.004) continue;
      ctx.fillStyle = rad(ctx, x, y, r, [[0, rgba(PAL.grey200, a)], [1, rgba(PAL.grey200, 0)]]);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}
