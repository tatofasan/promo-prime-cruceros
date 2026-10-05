// Geometría pura de las rutas (sin motor): la usan la escena (route.js) y la prueba de tierra
// (_route-land-test.mjs), así la prueba mide EXACTAMENTE la curva que se dibuja.
// Cada tramo es una lista de puntos de paso (ya proyectados a coordenadas de mapa por tools/build-map.mjs)
// que pasan por mar; la curva es una Catmull-Rom centrípeta por esos puntos (no se pasa de largo en las
// curvas cerradas, como Gibraltar o Bab-el-Mandeb).

/** Catmull-Rom centrípeta (alfa 0,5) por los puntos P; n muestras por tramo. Devuelve [[x, y], …]. */
export function catmull(P, n = 18) {
  if (P.length < 2) return P.slice();
  const pts = [P[0], ...P, P[P.length - 1]];
  // extremos fantasma: reflejo del vecino (la curva sale y llega con la dirección del primer/último tramo)
  pts[0] = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
  const m = P.length;
  pts[pts.length - 1] = [2 * P[m - 1][0] - P[m - 2][0], 2 * P[m - 1][1] - P[m - 2][1]];
  const out = [P[0].slice()];
  const td = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const t0 = 0, t1 = t0 + td(p0, p1), t2 = t1 + td(p1, p2), t3 = t2 + td(p2, p3);
    for (let k = 1; k <= n; k++) {
      const t = t1 + ((t2 - t1) * k) / n;
      const pt = [0, 1].map((d) => {
        const A1 = ((t1 - t) / (t1 - t0)) * p0[d] + ((t - t0) / (t1 - t0)) * p1[d];
        const A2 = ((t2 - t) / (t2 - t1)) * p1[d] + ((t - t1) / (t2 - t1)) * p2[d];
        const A3 = ((t3 - t) / (t3 - t2)) * p2[d] + ((t - t2) / (t3 - t2)) * p3[d];
        const B1 = ((t2 - t) / (t2 - t0)) * A1 + ((t - t0) / (t2 - t0)) * A2;
        const B2 = ((t3 - t) / (t3 - t1)) * A2 + ((t - t1) / (t3 - t1)) * A3;
        return ((t2 - t) / (t2 - t1)) * B1 + ((t - t1) / (t2 - t1)) * B2;
      });
      out.push(pt);
    }
  }
  return out;
}

/** Polilínea densa del tramo con longitudes acumuladas: { pts, len, total }. */
export function buildLeg(waypoints, n = 18) {
  const pts = catmull(waypoints, n);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
