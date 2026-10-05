// Mar abierto (reveal-sea): tiempos y composición. Todo sale de cues.json y de HOOK_WAVE (director).
import { cue, BEAT } from '../../../engine/time.js';
import { HOOK_WAVE } from '../../waves.js';

/** Tiempos de la coreografía. */
export const R = {
  wave0: HOOK_WAVE.t0,          // la cresta asoma por la derecha
  wave1: HOOK_WAVE.t1,          // la cresta sale por la izquierda
  drop: cue('reveal.drop'),     // 3,75 · el mar ya se ve en ≥ 70 %
  q5: cue('reveal.q5'),         // 4,22 · «CRUCERO?»
  horn: cue('reveal.horn'),     // 4,69 · bocinazo y flare que barre
  horn2: cue('reveal.horn') + BEAT / 2, // 4,92 · segundo toque, más corto (sin flare)
  push: cue('reveal.push'),     // 5,156 · la cámara se dispara al casco
  ant: 5.08,                    // anticipación (≈ 5 cuadros de dolly-out antes del disparo)
  land: cue('exp.pool'),        // 5,625 · ojo de buey en (960, 540) r 300
  end: 5.9,
  beat: BEAT,
};

/** Composición del mundo (coordenadas de cada plano con la cámara en reposo). */
export const HZ = 664;                       // horizonte (cielo y mar)
// sol arriba a la derecha, bien afuera del bloque del titular: su halo no queda detrás del «?» de «CRUCERO?»
export const SUN = { x: 1738, y: 146, r: 66 };
// medio del barco en la flotación; v px/s (navega a la derecha: ≥ 120 px en el push-in); drop = cuánto baja la
// flotación en pantalla al acercarse (perspectiva: lo cercano asienta más abajo del horizonte)
export const SHIP0 = { x: 1030, y: 712, scale: 0.52, v: 96, drop: 34 };
export const PRESET = 'golden';
/** Ojo de buey final (match cut con el iris de pool). */
export const EYE = { x: 960, y: 540, r: 300 };
