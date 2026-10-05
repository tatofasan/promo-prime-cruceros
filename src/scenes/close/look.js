// Luz del cierre: el preset 'sunset' de ART retocado para la marca. Cielo navy arriba (el logo blanco se lee),
// banda dorada en el horizonte y mar navy profundo con un camino de oro (la píldora verde salta encima).
// Es un objeto { sky, sea, name }: todo el kit de ART lo acepta igual que un nombre de preset.
import { SKY_PRESETS, SEA_PRESETS } from '../../art/index.js';
import { PAL, mixHex } from '../../engine/color.js';

const S = SKY_PRESETS.sunset;
const SEA = SEA_PRESETS.sunset;

export const CLOSE_SKY = {
  ...S,
  // cenit navy → índigo → dusk (detrás del logo) → rosa y coral → oro en el horizonte
  stops: [
    [0, PAL.navy900], [0.22, PAL.navy800], [0.44, '#2B2C66'], [0.66, PAL.dusk],
    [0.8, PAL.sunsetPink], [0.9, PAL.coral], [0.96, PAL.gold], [1, PAL.goldLight],
  ],
  glowA: 0.5,
  hazeA: 0.5,
  raysA: 0.12,
  stars: 0.22,
};

export const CLOSE_SEA = {
  ...SEA,
  far: mixHex('#F59A84', PAL.goldLight, 0.25),
  mid: mixHex(PAL.navy600, PAL.dusk, 0.4),
  near: mixHex(PAL.navy700, PAL.dusk, 0.15),
  deep: PAL.navy900,
  lit: mixHex(PAL.dusk, PAL.navy500, 0.25),
  trough: mixHex(PAL.navy900, PAL.dusk, 0.1),
  line: PAL.goldLight,
  lineA: 0.8,
  foam: PAL.peach,
  glitter: PAL.goldPale,
  glow: PAL.gold,
  glowA: 0.55,
  horizonLine: PAL.goldPale,
  reflect: mixHex(PAL.navy900, PAL.dusk, 0.2),
};

/** Preset del cierre (name 'sunset': las nubes y las gaviotas usan los sprites y siluetas de ese preset). */
export const LOOK = { sky: CLOSE_SKY, sea: CLOSE_SEA, name: 'sunset' };

// encuadre del fondo (mundo, cámara neutra)
export const HORIZON = 690;
export const SUN = { x: 1500, y: 640, r: 86 };
// el barco a la izquierda (lejos del anillo del CTA) y avanzando a la vista: ~36 px/s, ~140 px en el cierre
export const SHIP_AT = { x: 360, y: HORIZON + 16, scale: 0.34, vx: 36 };
