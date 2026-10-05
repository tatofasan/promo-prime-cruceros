// Ayudas del gancho: sprites horneados en init() (lo estático se dibuja una sola vez) e impulsos amortiguados.
import { makeCanvas } from '../../engine/env.js';
import { TAU, clamp } from '../../engine/ease.js';

/** Hornea fn en un lienzo que cubre el rect (x, y, w, h) del plano, supermuestreado ×s. */
export function bake(x, y, w, h, s, fn) {
  const c = makeCanvas(Math.ceil(w * s), Math.ceil(h * s));
  const g = c.getContext('2d');
  g.scale(s, s);
  g.translate(-x, -y);
  fn(g);
  return { c, x, y, w, h, s };
}

/** Pega un sprite horneado en su lugar (con la transformación actual del contexto). */
export function put(ctx, S, dx = 0, dy = 0) {
  ctx.drawImage(S.c, S.x + dx, S.y + dy, S.w, S.h);
}

/** Copia desenfocada de un sprite (profundidad de campo precalculada; px en unidades del plano). */
export function blurSprite(S, px) {
  const c = makeCanvas(S.c.width, S.c.height);
  const g = c.getContext('2d');
  g.filter = `blur(${(px * S.s).toFixed(2)}px)`;
  g.drawImage(S.c, 0, 0);
  g.filter = 'none';
  return { ...S, c };
}

/** Pasa un sprite a grises fríos (luminancia), con contraste y brillo propios. */
export function greySprite(S, { tint = [0.97, 1, 1.04], contrast = 0.8, lift = 0 } = {}) {
  const c = makeCanvas(S.c.width, S.c.height);
  const g = c.getContext('2d');
  g.drawImage(S.c, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const v = 128 + (l - 128) * contrast + lift;
    d[i] = clamp(v * tint[0], 0, 255);
    d[i + 1] = clamp(v * tint[1], 0, 255);
    d[i + 2] = clamp(v * tint[2], 0, 255);
  }
  g.putImageData(img, 0, 0);
  return { ...S, c };
}

/**
 * Solo la sombra de una forma (la forma no se pinta): se dibuja lejos y la sombra se corre a su lugar.
 * s = escala de horneado del lienzo (las sombras de canvas van en píxeles del dispositivo).
 */
export function shadowOnly(g, s, path, { dx = 0, dy = 0, blur = 20, color = 'rgba(4,16,31,0.4)' } = {}) {
  const OFF = 20000;
  g.save();
  g.translate(-OFF, 0);
  g.shadowColor = color;
  g.shadowBlur = blur * s;
  g.shadowOffsetX = (OFF + dx) * s;
  g.shadowOffsetY = dy * s;
  g.fillStyle = '#000';
  g.fill(path);
  g.restore();
}

/** Impulso amortiguado: 0 antes de t0; después oscila y se apaga (bamboleos, retrocesos, temblores). */
export function wobble(t, t0, { freq = 3, decay = 6 } = {}) {
  const u = t - t0;
  if (u < 0) return 0;
  return Math.exp(-decay * u) * Math.sin(TAU * freq * u);
}

/** Envolvente de golpe: 0 antes de t0, 1 en t0 y cae exponencial (decay en s). */
export function hit(t, t0, decay = 0.08) {
  const u = t - t0;
  return u < 0 ? 0 : Math.exp(-u / decay);
}

/** Cuerda de puntos → Path2D cerrado con curvas suaves (Catmull-Rom). */
export function blobPath(pts, tension = 0.5) {
  const p = new Path2D();
  const n = pts.length;
  const k = tension / 3;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  p.closePath();
  return p;
}
