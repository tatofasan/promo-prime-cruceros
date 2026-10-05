// Una celda a tamaño completo para mirar el detalle. Cambiá CELL con la variable de entorno ART_CELL (0..5).
import { scene } from './_sheet-sea.js';

const CELLS = [
  { preset: 'day', sunX: 1500, sunY: 230, r: 70 },
  { preset: 'golden', sunX: 1450, sunY: 300, r: 80 },
  { preset: 'sunset', sunX: 960, sunY: 560, r: 110 },
  { preset: 'dusk', sunX: 1100, sunY: 640, r: 90 },
  { preset: 'night', sunX: 1400, sunY: 200, r: 50 },
  { preset: 'golden', sunX: 1450, sunY: 300, r: 80, cam: { x: 120, y: 40, z: 1.8, r: 0.01 } },
];
const CELL = CELLS[Number(globalThis.process?.env?.ART_CELL ?? 1)];

export function draw(ctx, t) {
  scene(ctx, t, CELL);
}
