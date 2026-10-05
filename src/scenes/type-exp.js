// «Experiencias únicas en crucero» + chips de escena (5,625–13,125). Equipo TYPE. Contrato: docs/PLAN.md §6.7.
//  · titular grande (bloque arriba, libre la zona del splash) → lockup arriba a la izquierda sobre una placa que
//    es la caja del texto + margen; latido del 6 % en cada corte → type/exp-title.js, type/plate.js
//  · chips abajo a la izquierda, uno por escena (ícono, píldora y texto entran y salen juntos) → type/chips.js
import { drawExpTitle, initExpTitle } from './type/exp-title.js';
import { drawChips } from './type/chips.js';
import { initSurface } from './type/surface.js';

const scene = {
  id: 'type-exp',
  team: 'TYPE',
  from: 5.625,
  to: 13.125,
  z: 200,
  async init() {
    initSurface();
    initExpTitle();
  },
  draw(ctx, t) {
    drawChips(ctx, t);
    drawExpTitle(ctx, t, { scene: 'exp' });
  },
};
export default scene;
