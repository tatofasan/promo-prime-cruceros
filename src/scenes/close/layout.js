// Cierre: tiempos (de cues.json) y geometría del lockup en pantalla. Un solo lugar para ajustar el encuadre.
import { cue, BEAT } from '../../engine/time.js';
import { pinPlacement, logoFrame, LOGO } from '../../brand/logo.js';

export const T_IN = cue('close.in');       // 26,25 la ola revela el atardecer
export const T_LAND = T_IN + 2 / 60;       // 26,283 el pin aterriza YA en la «o» (la cresta ya pasó esa x)
export const T_PLATE = T_LAND + 1 / 60;    // 26,30 la placa nace del pin y se estira (hasta 26,45)
export const T_WORD = cue('close.word');   // 26,72 logo completo (desde 26,70) + barrido de luz
export const T_URL = cue('close.url');     // 27,19 se tipea la URL
export const T_CTA = cue('close.cta');     // 27,66 píldora de WhatsApp
export const T_FIN = cue('close.final');   // 28,13 golpe final
export const T_SWEEP2 = T_FIN + 2 * BEAT;  // 29,06 segundo barrido de luz sobre la placa
export { BEAT };

// 'plate' = logo a color (prime #FF3D00, cruceros #00A7CE) sobre placa blanca COMPACTA (decisión de post, §6.6
// opción 1). 'navy' (logo blanco sobre el cielo) queda descartada.
export const VARIANT = { current: 'plate' };

/** Geometría del lockup: placa ≤ 1560×260 entre y 180 y 430, URL afuera debajo, CTA abajo (lejos del barco). */
export function lockupGeo() {
  const L = { x: 960, y: 312, w: 1380 };
  const F = logoFrame(L.x, L.y, L.w);
  const pin = pinPlacement(L.x, L.y, L.w);
  const base = F.oy + LOGO.baseline * F.s; // pie de las letras en pantalla
  return {
    ...L, F, pin, base,
    plate: { x: 960, y: 305, w: 1520, h: 250, r: 34 },
    url: { x: 960, y: 489, size: 46 },
    cta: { x: 960, y: 836, h: 116 },
  };
}
