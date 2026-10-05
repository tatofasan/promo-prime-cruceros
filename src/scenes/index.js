// Registro de escenas (orden de dibujo = z). Ventanas y dueños: docs/PLAN.md §5–§7.
// Solo el director edita este archivo.
import hook_office from './hook-office.js';
import reveal_sea from './reveal-sea.js';
import pool from './pool.js';
import dinner from './dinner.js';
import show from './show.js';
import sunset from './sunset.js';
import map from './map.js';
import value from './value.js';
import close from './close.js';
import type_hook from './type-hook.js';
import type_exp from './type-exp.js';

export const SCENES = [
  hook_office,
  reveal_sea,
  pool,
  dinner,
  show,
  sunset,
  map,
  value,
  close,
  type_hook,
  type_exp,
];

// Crestas de ola que se pintan ENCIMA de todo (incluidos los titulares de TYPE). PLAN §7 (v2).
export const OVER_ABOVE = ['reveal-sea', 'close'];

// Ventanas fijadas por el director (pisan las de cada archivo). PLAN §7 (v2):
// value arranca en 20,5 con máscara ascendente para que la valija entre desde abajo y frene en val.in.
const WINDOWS = { value: { from: 20.5 } };
for (const sc of SCENES) Object.assign(sc, WINDOWS[sc.id] || {});

