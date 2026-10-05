// Sólidos simples sobre la mesa en perspectiva: cilindros (fichas, columna de la ruleta) y sombras de apoyo.
import { TAU } from '../../engine/ease.js';

/**
 * Marco de un cilindro vertical de radio r entre z y z + h, apoyado en (x, y).
 * Devuelve P(θ, top) en pantalla (θ en coordenadas de imagen: 0 = derecha, π/2 = hacia la cámara)
 * y el ángulo θ0 donde empieza la mitad visible del costado (de θ0 a θ0 + π).
 */
export function cylFrame(cam, x, y, z, r, h) {
  const m = cam.aff(x, y, z);
  const u = cam.up(x, y, z);
  const ux = u[0] * h, uy = u[1] * h;
  // extremos de la elipse a lo largo de la normal al vector vertical de pantalla
  const nx = -u[1], ny = u[0];
  const th = Math.atan2(nx * m[2] + ny * m[3], nx * m[0] + ny * m[1]);
  const mid = th + Math.PI / 2;
  const mx = m[0] * Math.cos(mid) + m[2] * Math.sin(mid), my = m[1] * Math.cos(mid) + m[3] * Math.sin(mid);
  // la mitad visible del costado es la opuesta al vector "arriba"
  const th0 = mx * u[0] + my * u[1] < 0 ? th : th - Math.PI;
  const P = (a, top = false) => [
    m[4] + (m[0] * Math.cos(a) + m[2] * Math.sin(a)) * r + (top ? ux : 0),
    m[5] + (m[1] * Math.cos(a) + m[3] * Math.sin(a)) * r + (top ? uy : 0),
  ];
  return { m, ux, uy, th0, P };
}

/** Path del costado visible (o de un tramo [a0, a1] dentro de la mitad visible). */
export function sidePath(F, a0 = F.th0, a1 = F.th0 + Math.PI, n = 14) {
  const p = new Path2D();
  for (let i = 0; i <= n; i++) {
    const [x, y] = F.P(a0 + ((a1 - a0) * i) / n, false);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const [x, y] = F.P(a0 + ((a1 - a0) * i) / n, true);
    p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/** Elipse (tapa) del cilindro en pantalla. */
export function capPath(F, top = true, n = 28) {
  const p = new Path2D();
  for (let i = 0; i < n; i++) {
    const [x, y] = F.P((i / n) * TAU, top);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

/** Sombra blanda de contacto sobre la mesa (en el plano z = 0), corrida hacia la luz contraria. */
export function contactShadow(ctx, cam, x, y, r, { alpha = 0.45, dx = 10, dy = -8, soft = 1.6, color = '4,16,31' } = {}) {
  if (alpha <= 0.003) return;
  const m = cam.aff(x + dx, y + dy, 0);
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const R = r * soft;
  const g = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, R);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.55, `rgba(${color},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
}
