// Pregunta del gancho (0–5,625). Equipo TYPE. Contrato: docs/PLAN.md §6.7.
//  · mundo gris: «¿Y SI» · «TUS PRÓXIMAS» · «VACACIONES…» (la ola se las lleva) → type/hook-grey.js
//  · mar abierto: «…FUERAN EN» · «CRUCERO?» y salida hacia cámara → type/hook-sea.js
//  · 5,600–5,625: anticipación de «EXPERIENCIAS» (cae por encima del aro; sigue en type-exp) → type/exp-title.js
//  La cresta de la ola (over de reveal-sea) se pinta ENCIMA de este titular (OVER_ABOVE en index.js).
import { drawHookGrey, initHookGrey } from './type/hook-grey.js';
import { drawHookSea, initHookSea } from './type/hook-sea.js';
import { drawExpTitle, initExpTitle } from './type/exp-title.js';
import { initSurface } from './type/surface.js';

const scene = {
  id: 'type-hook',
  team: 'TYPE',
  from: 0.0,
  to: 5.625,
  z: 200,
  async init() {
    initSurface();
    initHookGrey();
    initHookSea();
    initExpTitle();
  },
  draw(ctx, t) {
    drawHookGrey(ctx, t);
    drawHookSea(ctx, t);
    drawExpTitle(ctx, t);
  },
};
export default scene;
