// Casino y show (plato → ruleta; látigo al escenario; reflector → sol). Equipo DECK-B. Contrato: docs/PLAN.md §6.3.
// Tramo: 9,375 ruleta cenital (match con el plato) → casino → LÁTIGO en exp.show → escenario → disco de luz.
import { cue } from '../engine/time.js';
import { E, clamp } from '../engine/ease.js';
import { initCasino, drawCasino, ANT_B } from './deck-b/casino.js';
import { initStage, drawStage } from './deck-b/stage.js';
import { initGrain } from './deck-b/grain.js';
import { whipSmear, whipStreaks } from './deck-b/whip.js';

let T_WHIP = 10.3125;
const IN_DUR = 0.22;

/**
 * Corrimiento horizontal del casino al salir. El contramovimiento (la cámara retrocede a la izquierda con un
 * push leve, ANT_A → ANT_B) lo hace la cámara de la mesa, con parallax; acá arranca el LÁTIGO a la derecha:
 * el contenido acelera hacia la izquierda hasta el corte (pico de barrido en exp.show).
 */
function casinoX(t) {
  if (t < ANT_B) return 0;
  return -1500 * E.inCubic(clamp((t - ANT_B) / (T_WHIP - ANT_B)));
}
/** Corrimiento del escenario al entrar: llega desde la derecha y se pasa un poco (overshoot). */
function stageX(t) {
  const p = clamp((t - T_WHIP) / IN_DUR);
  return 640 * (1 - E.backOut(1.25)(E.outCubic(p)));
}

const scene = {
  id: 'show',
  team: 'DECK-B',
  from: 9.375,
  to: 11.25,
  z: 50,
  async init() {
    T_WHIP = cue('exp.show');
    initGrain();
    initCasino();
    initStage();
  },
  draw(ctx, t) {
    const casino = t < T_WHIP;
    const X = casino ? casinoX : stageX;
    const x = X(t);
    // velocidad: hacia atrás en el casino (acelera hasta el corte) y hacia adelante en el escenario
    // (así el primer cuadro del escenario ya llega barrido)
    const v = casino ? (x - X(t - 1 / 60)) * 60 : (X(t + 1 / 60) - x) * 60;
    const sm = Math.min(1100, Math.max(0, Math.abs(v) * 0.05 - 80));
    ctx.save();
    ctx.translate(x, 0);
    whipSmear(ctx, sm, (c) => (casino ? drawCasino(c, t) : drawStage(c, t)));
    ctx.restore();
    whipStreaks(ctx, clamp((sm - 150) / 700), t);
  },
};
export default scene;
