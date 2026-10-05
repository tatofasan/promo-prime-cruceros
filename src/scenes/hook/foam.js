// Espuma de encaje sobre un borde de agua: una cinta de ancho irregular (con cortes y borde interior
// festoneado), sombra fría en la mitad de adentro, agujeros chicos e irregulares que dejan ver el agua y grumos
// sueltos. Nada de «collar de perlas». La cinta crece hacia la DERECHA del sentido del trazo (normal (−dy, dx)):
// una cresta que va de izquierda a derecha cuelga hacia abajo; un contorno que gira en sentido horario, hacia
// adentro.
import { PAL, rgba } from '../../engine/color.js';
import { fbm1, hash } from '../../engine/noise.js';
import { TAU } from '../../engine/ease.js';
import { smoothPath } from '../../engine/draw.js';

/**
 * pts: borde [[x, y]…] · o = { width, seed, t, amt (0..1 cuánta espuma), hole (color del agua), closed }
 */
export function drawLace(ctx, pts, o = {}) {
  const w0 = o.width ?? 18, seed = o.seed ?? 1, t = o.t ?? 0, amt = o.amt ?? 1;
  const hole = o.hole ?? PAL.ocean500;
  const n = pts.length;
  if (n < 3) return;
  // normales hacia adentro y largo acumulado (el ruido corre por el borde, no por x)
  const nrm = [], acc = [0];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    nrm.push([-dy / l, dx / l]);
    if (i) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  // ancho por punto: ruido que viaja + cortes donde baja + festón en el borde de adentro
  const wd = pts.map((_, i) => {
    const f = fbm1(acc[i] * 0.006 + seed * 3.1 - t * 0.25, seed, 3);
    const w = (f + 0.15 + (amt - 0.5) * 0.6) * w0 * 1.8;
    return w > 1.2 ? w * (0.85 + 0.3 * Math.abs(Math.sin(acc[i] * 0.09 + seed))) : 0;
  });
  const at = (i, d) => [pts[i][0] + nrm[i][0] * d, pts[i][1] + nrm[i][1] * d];
  ctx.save();
  let i = 0;
  while (i < n) {
    if (!wd[i]) { i++; continue; }
    let j = i;
    while (j < n && wd[j]) j++;
    if (j - i >= 2) {
      // bordes suaves (Catmull-Rom): la espuma es redonda, no facetada
      const edge = (d0, d1) => {
        const a = [], b = [];
        for (let k = i; k < j; k++) a.push(at(k, d0(k)));
        for (let k = j - 1; k >= i; k--) b.push(at(k, d1(k)));
        const P = smoothPath(a, false, 0.5);
        smoothPath(b, false, 0.5, P);
        P.closePath();
        return P;
      };
      const band = edge(() => -1, (k) => wd[k]);
      const sh = edge((k) => wd[k] * 0.55, (k) => wd[k] + 2);
      ctx.fillStyle = rgba(PAL.foam, 0.96);
      ctx.fill(band);
      ctx.save();
      ctx.clip(band);
      ctx.fillStyle = rgba(PAL.aqua200, 0.85);
      ctx.fill(sh);
      // agujeros chicos e irregulares (tono 3: el agua que se ve)
      ctx.fillStyle = rgba(hole, 0.7);
      ctx.beginPath();
      for (let k = i + 1; k < j - 1; k++) {
        if (wd[k] < w0 * 0.8 || hash(seed, k, 5) > 0.3) continue;
        const [x, y] = at(k, wd[k] * (0.35 + 0.3 * hash(seed, k, 9)));
        const r = wd[k] * (0.1 + 0.12 * hash(seed, k, 6));
        const ang = Math.atan2(nrm[k][1], nrm[k][0]) + Math.PI / 2;
        ctx.moveTo(x + Math.cos(ang) * r * 1.6, y + Math.sin(ang) * r * 1.6);
        ctx.ellipse(x, y, r * 1.6, r * (0.6 + 0.4 * hash(seed, k, 7)), ang, 0, TAU);
      }
      ctx.fill();
      ctx.restore();
    }
    i = j;
  }
  // grumos sueltos: adentro (se desprenden de la cinta) y spray fino afuera
  ctx.fillStyle = rgba(PAL.foam, 0.88);
  ctx.beginPath();
  for (let k = 0; k < n; k += 2) {
    if (hash(seed, k, 11) > 0.4 * amt + 0.1) continue;
    const d = (wd[k] || w0 * 0.4) + 3 + hash(seed, k, 12) * w0 * 1.4;
    const [x, y] = at(k, d);
    const r = 1.4 + Math.pow(hash(seed, k, 13), 2) * w0 * 0.32;
    const ang = Math.atan2(nrm[k][1], nrm[k][0]) + Math.PI / 2;
    ctx.moveTo(x + Math.cos(ang) * r * 1.7, y + Math.sin(ang) * r * 1.7);
    ctx.ellipse(x, y, r * 1.7, r, ang, 0, TAU);
    if (hash(seed, k, 15) < 0.35) {
      const [sx, sy] = at(k, -4 - hash(seed, k, 17) * w0);
      const sr = 1 + hash(seed, k, 18) * 2;
      ctx.moveTo(sx + sr, sy);
      ctx.arc(sx, sy, sr, 0, TAU);
    }
  }
  ctx.fill();
  ctx.restore();
}
