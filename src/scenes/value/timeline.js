// Tiempos de la escena VALOR (todo sale de cues.json; acá solo se nombran).
import { cue, b, BEAT, BAR } from '../../engine/time.js';

export const T = {
  win: 20.5,                // la ventana de VALOR arranca acá: barrido cian que sube (máscara) hasta val.in
  in: cue('val.in'),        // 20,625 · aterriza la valija (impacto en el corte)
  s1: cue('val.s1'),        // 21,094 · calco EN PAREJA
  s2: cue('val.s2'),        // 21,563 · calco EN FAMILIA
  s3: cue('val.s3'),        // 21,797 · calco CON AMIGOS (corchea del 3: se lee 0,65 s antes de la salida)
  wob: b(11, 4.5),          // 22,266 · segundo bamboleo de los tres calcos
  hold: 22.45,              // el cuadro del compás 11 queda completo hasta acá; salida rápida hasta val.pass
  pass: cue('val.pass'),    // 22,5   · gira la valija → tarjeta de embarque
  roll: cue('val.pass') + BEAT, // 22,969 · arranca el contador
  price: cue('val.price'),  // 23,438 · SELLO
  tear: cue('val.tear'),    // 23,906 · se arranca el talón
  pro: cue('val.pro'),      // 24,375 · especialistas
  b1: cue('val.b1'),        // 24,844 · globo del cliente (la especialista asiente)
  b2: cue('val.b2'),        // 25,313 · globo de Prime + pulgar arriba y guiño
  surge: cue('val.surge'),  // 25,781 · anticipación de la segunda ola
  end: 26.6,
};
export { BEAT, BAR };
/** Corchea y semicorchea. */
export const E8 = BEAT / 2;
export const E16 = BEAT / 4;
export const F = 1 / 60;
