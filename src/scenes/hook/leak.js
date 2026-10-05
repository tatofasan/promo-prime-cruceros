// El agua que se filtra del monitor desde hook.leak (plano D.desk): por el borde de abajo del vidrio asoman
// bultos de agua que se hinchan, chorrean gotas con brillo (estiradas por la velocidad) sobre el mentón y la
// base, y se forma un charco con anillos y coronitas.
import { PAL, rgba } from '../../engine/color.js';
import { lin, fill, circlePath, ellipsePath, sparkle, rrectPath } from '../../engine/draw.js';
import { E, clamp, TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { MON, T } from './layout.js';

const YB = MON.y + MON.h; // borde inferior del vidrio
const CHIN = YB + MON.chin;
const LAND = 793; // tapa de la base del monitor
const SEEPS = [
  { x: MON.x + MON.w * 0.64, w: 110, h: 44, t0: 0.0 },
  { x: MON.x + MON.w * 0.22, w: 60, h: 22, t0: 0.07 },
  { x: MON.x + MON.w * 0.9, w: 46, h: 18, t0: 0.11 },
];
const DROPS = [];

export function initLeak() {
  // gotas que chorrean entre leak y surge
  for (let i = 0; i < 14; i++) {
    const s = SEEPS[i % 3 === 0 ? 0 : i % 3];
    DROPS.push({ x: s.x + (hash(i, 1) - 0.5) * s.w * 0.4, born: T.leak + 0.05 + (i / 14) * (T.surge - T.leak - 0.04), r: 3 + hash(i, 2) * 3.5 });
  }
}

function seepGrow(t, s) {
  return E.backOut(1.6)(clamp((t - T.leak - s.t0) / 0.2));
}

export function drawLeak(ctx, t) {
  if (t < T.leak || t > T.surge + 0.02) return;
  // charco en la base del monitor
  const pg = E.outCubic(clamp((t - T.leak - 0.12) / 0.3));
  if (pg > 0) {
    const px = SEEPS[0].x - 20, py = LAND + 6;
    fill(ctx, ellipsePath(px, py, 90 * pg, 11 * pg), lin(ctx, 0, py - 10, 0, py + 10, [rgba(PAL.aqua200, 0.85), rgba(PAL.ocean400, 0.85)]));
    fill(ctx, ellipsePath(px - 20 * pg, py - 3 * pg, 40 * pg, 3 * pg), rgba(PAL.white, 0.55));
  }
  for (const s of SEEPS) {
    const g = seepGrow(t, s);
    if (g <= 0) continue;
    const w = s.w * (0.4 + 0.6 * g), h = s.h * g + 3 * Math.sin(t * 22 + s.x);
    // hilo que corre por el mentón
    fill(ctx, rrectPath(s.x - 3, YB, 6, (CHIN - YB) * g, 3), lin(ctx, 0, YB, 0, CHIN, [rgba(PAL.aqua200, 0.9), rgba(PAL.ocean400, 0.7)]));
    // bulto que se hincha colgando del borde del vidrio
    const p = new Path2D();
    p.moveTo(s.x - w / 2, YB - 2);
    p.bezierCurveTo(s.x - w * 0.42, YB + h * 0.7, s.x - w * 0.18, YB + h, s.x + 2 * Math.sin(t * 17), YB + h);
    p.bezierCurveTo(s.x + w * 0.2, YB + h, s.x + w * 0.44, YB + h * 0.65, s.x + w / 2, YB - 2);
    p.closePath();
    fill(ctx, p, lin(ctx, 0, YB, 0, YB + h, [PAL.aqua100, PAL.aqua300, PAL.ocean400]));
    ctx.strokeStyle = rgba(PAL.ocean600, 0.6); ctx.lineWidth = 1.5; ctx.stroke(p);
    fill(ctx, ellipsePath(s.x - w * 0.22, YB + h * 0.35, w * 0.08, h * 0.22, -0.4), rgba(PAL.white, 0.85));
    sparkle(ctx, s.x - w * 0.2, YB + h * 0.3, 7 + 5 * g, { alpha: 0.9 * g, rot: t * 2 });
  }
  // gotas que caen (estiradas por la velocidad) y salpican al tocar la base
  for (const d of DROPS) {
    const u = t - d.born;
    if (u < 0) continue;
    const y0 = YB + 30;
    const y = y0 + 0.5 * 2600 * u * u;
    if (y < LAND) {
      const v = 2600 * u;
      const st = 1 + v * 0.0016;
      fill(ctx, ellipsePath(d.x, y, d.r / Math.sqrt(st), d.r * st), lin(ctx, 0, y - d.r * st, 0, y + d.r * st, [PAL.aqua100, PAL.ocean400]));
      fill(ctx, circlePath(d.x - d.r * 0.3, y - d.r * 0.3, d.r * 0.35), rgba(PAL.white, 0.9));
    } else {
      const ul = u - Math.sqrt((2 * (LAND - y0)) / 2600);
      if (ul > 0.25) continue;
      // anillo + coronita
      const rr = 6 + ul * 140;
      ctx.strokeStyle = rgba(PAL.white, 0.7 * (1 - ul / 0.25));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(d.x, LAND + 6, rr, rr * 0.18, 0, 0, TAU); ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI * (0.15 + 0.7 * (k / 3));
        const q = ul / 0.25;
        fill(ctx, circlePath(d.x + Math.cos(a) * 30 * q, LAND + Math.sin(a) * 40 * q + 300 * ul * ul, 2 * (1 - q)), PAL.aqua100);
      }
    }
  }
}

