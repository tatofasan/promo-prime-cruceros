// Prueba de encuadres de la cámara de mesa: t = índice de la lista.
import { initCasino, drawCasino } from './casino.js';
import { tableCam } from './persp.js';
const C = [
  { D: 930, pitch: 1.21, yaw: -0.39, tx: -470, ty: 60 },
  { D: 900, pitch: 1.18, yaw: -0.39, tx: -440, ty: 120 },
  { D: 1000, pitch: 1.24, yaw: -0.45, tx: -400, ty: 120 },
  { D: 860, pitch: 1.15, yaw: -0.3, tx: -420, ty: 100 },
];
export async function init() { initCasino(); }
export function draw(ctx, t) {
  const c = C[Math.round(t)];
  drawCasino(ctx, 10.2, tableCam({ ...c, F: 1600 }));
}
