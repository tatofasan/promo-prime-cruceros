// Estilos de titulares del equipo TYPE: caras en degradé con «horizonte» metálico, filo de luz, extrusión
// sombreada y sombra blanda. Todo con la paleta oficial (PAL).
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { cue } from '../../engine/time.js';

// golpes que usa TYPE (fuente única: cues.json)
export const C = {
  q1: cue('hook.q1'), q2: cue('hook.q2'), q3: cue('hook.q3'),
  leak: cue('hook.leak'), surge: cue('hook.surge'), gap: cue('hook.gap'),
  drop: cue('reveal.drop'), q5: cue('reveal.q5'), horn: cue('reveal.horn'), push: cue('reveal.push'),
  pool: cue('exp.pool'), w2: cue('exp.w2'), w3: cue('exp.w3'), slide: cue('exp.slide'), ring: cue('exp.ring'),
  dinner: cue('exp.dinner'), casino: cue('exp.casino'), sunset: cue('exp.sunset'), out: cue('exp.out'),
};

/** Rampa de la extrusión: de la cara (near) al fondo (far), un color por capa. */
export function extRamp(near, far, depth) {
  const out = [];
  for (let k = 0; k <= depth; k++) out.push(mixHex(near, far, Math.pow(k / depth, 0.8)));
  return out;
}

// Hielo: la pregunta en el mundo gris (blanco frío que se apaga hacia abajo, extrusión navy)
export const ICE = {
  face: [[0, '#FFFFFF'], [0.46, '#F4F7FA'], [0.5, PAL.grey200], [1, mixHex(PAL.grey300, PAL.grey200, 0.4)]],
  rim: '#FFFFFF', rimPx: 2.2,
  ext: extRamp(PAL.navy700, PAL.ink, 9), step: 1.15,
  shadow: { color: rgba(PAL.ink, 0.62), blur: 30, dist: 22 },
  echo: '#FFFFFF',
};

// Oro: la palabra que late (lo único cálido del mundo gris)
export const GOLD = {
  face: [[0, PAL.goldPale], [0.44, PAL.goldLight], [0.5, PAL.gold], [1, mixHex(PAL.gold, PAL.coral, 0.42)]],
  rim: '#FFF6DE', rimPx: 2.2,
  ext: extRamp(mixHex(PAL.navy700, '#3a2a10', 0.25), PAL.ink, 9), step: 1.15,
  shadow: { color: rgba(PAL.ink, 0.6), blur: 30, dist: 22 },
  glow: PAL.gold,
  echo: PAL.goldLight,
};

// Blanco de mar: titulares sobre cielo y escenas de a bordo (blanco con tinte aqua abajo)
export const SEA = {
  face: [[0, '#FFFFFF'], [0.46, '#FFFFFF'], [0.5, PAL.aqua100], [1, mixHex(PAL.aqua100, PAL.aqua200, 0.55)]],
  rim: '#FFFFFF', rimPx: 2.6,
  ext: extRamp(PAL.navy600, PAL.ink, 12), step: 1.2,
  shadow: { color: rgba(PAL.ink, 0.5), blur: 34, dist: 26 },
  echo: '#FFFFFF',
};

// Oro de a bordo (palabra clave de la experiencia)
export const SEA_GOLD = {
  ...GOLD,
  ext: extRamp(PAL.navy600, PAL.ink, 12), step: 1.2,
  shadow: { color: rgba(PAL.ink, 0.5), blur: 34, dist: 26 },
};

/** Subrayado: base, filo de luz arriba y sombra abajo (3 tonos) + extrusión del mismo color que el texto. */
export const BAR_GOLD = { top: PAL.goldPale, mid: PAL.gold, low: mixHex(PAL.gold, PAL.coral, 0.5), ext: PAL.navy800 };
export const BAR_CORAL = { top: PAL.peach, mid: PAL.coral, low: mixHex(PAL.coral, PAL.sunsetPink, 0.5), ext: PAL.navy800 };
