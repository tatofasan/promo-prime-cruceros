// Tiempo de las dos OLAS de transición (archivo del director). Lo importan quienes tienen que moverse
// exactamente con el agua: reveal-sea (máscara + cresta), type-hook (el texto que se lleva la ola),
// close (máscara + cresta) y value (lo que queda debajo).
//
// p = progreso del FRENTE de la ola: 0 = la cresta todavía fuera de cuadro del lado de entrada,
//     1 = la cresta ya salió por el lado opuesto. Lo que el frente ya pasó es la escena NUEVA.
// La forma, el rulo, la espuma y el spray son de src/art/wave.js (ART); acá solo vive el CUÁNDO.
import { E, clamp } from '../engine/ease.js';
import { cue } from '../engine/time.js';

function make(t0, t1, dir) {
  return {
    t0, t1, dir,
    /** progreso de la ola en t (0 antes, 1 después) */
    p: (t) => E.inOutSine(clamp((t - t0) / (t1 - t0))),
    active: (t) => t >= t0 && t <= t1,
  };
}

/** Primera ola: sale del monitor (derecha) y barre hacia la izquierda; en el drop (3,75) ya pasó el centro. */
export const HOOK_WAVE = make(cue('hook.surge') + 0.24, cue('reveal.drop') + 0.11, 'rtl');
/** Segunda ola: rima con la primera, en sentido contrario; en close.in (26,25) ya pasó el centro. */
export const CLOSE_WAVE = make(cue('val.surge') + 0.22, cue('close.in') + 0.1, 'ltr');
