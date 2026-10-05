// Caché de capas LENTAS por tiempo cuantizado (sigue siendo función pura de t): el contenido de una entrada
// depende SOLO de su clave k = floor(t·fps), y se dibuja en tq = k / fps. Cualquier orden de render da los mismos
// píxeles. Sirve para lo que se mueve tan despacio que 15 cuadros/s no se notan (cielo, rayos, sol lejano).
import { makeCanvas } from '../../engine/env.js';

/** fps: número o función de t (p. ej. más cuadros mientras la cámara se mueve rápido). */
export function makeQCache(w, h, fps, slots = 2) {
  const S = [];
  let next = 0;
  const rate = typeof fps === 'function' ? fps : () => fps;
  return {
    /** Prepara los lienzos (llamar en init). */
    init() { while (S.length < slots) S.push({ cv: makeCanvas(w, h), key: null }); },
    /** Tiempo cuantizado de t. */
    tq: (t) => { const f = rate(t); return Math.floor(t * f + 1e-6) / f; },
    /** Lienzo con draw(ctx, tq) ya pintado para la clave de t. */
    get(t, draw) {
      if (!S.length) this.init();
      const f = rate(t);
      const key = f + ':' + Math.floor(t * f + 1e-6);
      let s = S.find((e) => e.key === key);
      if (!s) {
        s = S[next];
        next = (next + 1) % S.length;
        const c = s.cv.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        c.filter = 'none';
        c.clearRect(0, 0, w, h);
        draw(c, Math.floor(t * f + 1e-6) / f);
        s.key = key;
      }
      return s.cv;
    },
  };
}
