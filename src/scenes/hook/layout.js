// Composición de la oficina gris (coordenadas de cada plano tal como se ven con la cámara en reposo).
// La mitad izquierda (x 96–1000, y 260–800) queda para la pregunta de TYPE: ahí solo hay fondo tranquilo.
import { cue } from '../../engine/time.js';

/** Profundidad de cada plano (0 = infinito, 1 = foco en el escritorio, >1 = primer plano). */
export const D = { city: 0.3, wall: 0.7, desk: 1, fly: 1.06, fg: 1.45 };

/** Tiempos de la coreografía (todos salen de cues.json). */
export const T = {
  cal: [cue('hook.cal1'), cue('hook.cal2'), cue('hook.cal3')],
  q: [cue('hook.q1'), cue('hook.q2'), cue('hook.q3')],
  leak: cue('hook.leak'),
  surge: cue('hook.surge'),
  gap: cue('hook.gap'),
  drop: cue('reveal.drop'),
  end: 3.98,
};

// plano pared
export const WIN = { x: 150, y: 96, w: 820, h: 560, mull: 560, blind: 252 };
export const CLOCK = { x: 1236, y: 214, r: 90 };
// el estante quedó a la derecha del almanaque: se ve en la apertura cerrada y queda al borde en el encuadre abierto
export const SHELF = { x: 1884, y: 300, w: 362 };
// almanaque GRANDE (la apertura es un primer plano de él y del reloj): el día se lee con mayúsculas de ≥ 90 px
export const CAL = { nx: 1625, ny: 70, x: 1425, y: 96, w: 400, h: 420 };
export const LAMP = { x0: 250, x1: 1030, y: 30 };

// plano escritorio
export const DESK = { back: 772, front: 942, lip: 992 };
export const MON = { x: 1150, y: 368, w: 532, h: 300, bez: 16, chin: 30 };
MON.cx = MON.x + MON.w / 2;
MON.cy = MON.y + MON.h / 2;
export const KEYB = { cx: 1362, yb: 846, yf: 906, wb: 420, wf: 456 };
export const MOUSE = { x: 1662, y: 884 };
export const MUG = { x: 1052, y: 884, w: 86, h: 102 };
export const STACK = { x: 1806, y: 906, w: 156, bh: 25 };
