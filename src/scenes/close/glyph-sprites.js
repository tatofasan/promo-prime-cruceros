// (Sin uso desde la ronda de correcciones: el logo va a color con drawLogo sobre la placa; queda por si vuelve
// la versión blanca.)
// Letras del logo pre-pintadas (una vez, en init) como sprites a 2×: cara blanca con el degradé cálido de abajo,
// filo de luz del lado del sol y la sombra navy ya incluida. En cada cuadro se dibujan con la transformación de su
// animación (pop, squash, saltos): mismo aspecto que en vivo y ~10× más barato que rellenar 11 caminos con sombra.
import { makeCanvas } from '../../engine/env.js';
import { lin } from '../../engine/draw.js';
import { logoGlyphs } from '../../brand/logo.js';

const SS = 2; // resolución del sprite respecto de la pantalla
let cache = null;

/**
 * Arma los sprites para el logo a escala s (px de pantalla por px del PNG).
 * shadow = { color, blur, x, y } en px de pantalla · rim = color del filo (lado del sol, a la derecha)
 */
export function buildGlyphSprites(s, { shadow, rim, rimDx = 2.2 }) {
  const key = `${s}`;
  if (cache && cache.key === key) return cache;
  const k = s * SS; // px del sprite por px del PNG
  const pad = Math.ceil((shadow.blur * 1.6 + Math.max(Math.abs(shadow.x), Math.abs(shadow.y))) * SS);
  const sprites = new Map();
  for (const g of logoGlyphs()) {
    if (g.pin || !g.path) continue;
    const [x0, y0, x1, y1] = g.box;
    const w = Math.ceil((x1 - x0) * k + pad * 2), h = Math.ceil((y1 - y0) * k + pad * 2);
    const cv = makeCanvas(w, h), c = cv.getContext('2d');
    const toGlyph = () => { c.translate(pad, pad); c.scale(k, k); c.translate(-x0, -y0); };
    // sombra navy (sola: se dibuja la letra con sombra y después se borra la letra)
    c.save();
    c.shadowColor = shadow.color;
    c.shadowBlur = shadow.blur * SS;
    c.shadowOffsetX = shadow.x * SS;
    c.shadowOffsetY = shadow.y * SS;
    toGlyph();
    c.fillStyle = '#000';
    c.fill(g.path, 'evenodd');
    c.restore();
    c.save();
    toGlyph();
    c.globalCompositeOperation = 'destination-out';
    c.fill(g.path, 'evenodd');
    c.restore();
    // filo cálido: la letra corrida hacia el sol asoma por el borde derecho
    c.save();
    toGlyph();
    c.translate(rimDx / s, 0);
    c.fillStyle = rim;
    c.fill(g.path, 'evenodd');
    c.restore();
    // cara: blanco con un tibio de rebote abajo (la luz del mar dorado)
    c.save();
    toGlyph();
    c.fillStyle = lin(c, 0, 20, 0, 270, [[0, '#FFFFFF'], [0.55, '#FFFFFF'], [1, '#FFE8D0']]);
    c.fill(g.path, 'evenodd');
    c.restore();
    sprites.set(g.i, { cv, x0, y0, padU: pad / k, wU: w / k, hU: h / k });
  }
  cache = { key, sprites };
  return cache;
}

/** Dibuja la letra i (ctx ya en coordenadas del PNG del logo) con su sprite. */
export function drawGlyphSprite(ctx, S, i) {
  const sp = S.sprites.get(i);
  if (!sp) return;
  ctx.drawImage(sp.cv, sp.x0 - sp.padU, sp.y0 - sp.padU, sp.wU, sp.hU);
}
