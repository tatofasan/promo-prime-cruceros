// Ayudas propias de VALOR: tres tonos por superficie, sprites cacheados y sus sombras pre-desenfocadas.
import { makeCanvas } from '../../engine/env.js';
import { shade } from '../../engine/color.js';
import { bake } from '../../engine/draw.js';

/** Tres tonos de una superficie: base, sombra dura (más oscura) y filo de luz (más clara). */
export const tones = (base, dark = -0.2, light = 0.24) => ({ base, dark: shade(base, dark), light: shade(base, light) });

/**
 * Sprite cacheado: dibuja fn en coordenadas locales dentro de la caja [-ox, -oy, w, h] a escala s.
 * Se pinta después con drawSprite (origen local en el 0,0 del contexto).
 */
export function sprite(w, h, ox, oy, s, fn) {
  const c = makeCanvas(Math.ceil(w * s), Math.ceil(h * s));
  const x = c.getContext('2d');
  x.scale(s, s);
  x.translate(ox, oy);
  fn(x);
  // horneado: en Node un lienzo de comandos se re-rasteriza en cada drawImage
  return { c: bake(c), w, h, ox, oy, s };
}

export function drawSprite(ctx, sp) {
  ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h);
}

/** Silueta desenfocada de un sprite (sombra proyectada barata: se calcula una vez en init). */
export function shadowOf(sp, { blur = 18, color = '#04101F' } = {}) {
  const pad = blur * 2.5;
  const out = sprite(sp.w + pad * 2, sp.h + pad * 2, sp.ox + pad, sp.oy + pad, sp.s, (x) => {
    x.filter = `blur(${blur}px)`;
    drawSprite(x, sp);
    x.filter = 'none';
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(-sp.ox - pad, -sp.oy - pad, sp.w + pad * 2, sp.h + pad * 2);
  });
  return out;
}

/**
 * Sombra larga «flat»: la silueta arrastrada en diagonal (dx, dy) y desvanecida. Una vez, en init.
 */
export function longShadowOf(sp, { dx = 1, dy = 1, len = 260, color = '#04101F', steps = 48 } = {}) {
  const padX = Math.abs(dx) * len + 4, padY = Math.abs(dy) * len + 4;
  return sprite(sp.w + padX, sp.h + padY, sp.ox, sp.oy, sp.s, (x) => {
    for (let i = steps; i >= 1; i--) {
      const f = i / steps;
      x.globalAlpha = Math.pow(1 - f, 1.6);
      x.save();
      x.translate(dx * len * f, dy * len * f);
      drawSprite(x, sp);
      x.restore();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(-sp.ox, -sp.oy, sp.w + padX, sp.h + padY);
  });
}

/** Rectángulo redondeado como subpath del contexto (para clip y fill encadenados). */
export function rr(c, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q);
  c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q);
  c.arcTo(x, y, x + w, y, q);
  c.closePath();
}

/**
 * Escritura simple con tracking (sin animación), alineada a la izquierda / centro / derecha.
 * Con tracking positivo el espacio entre palabras se agranda (ws px extra por espacio; por defecto 3,5 × tracking)
 * para que «TARJETA DE EMBARQUE» no se lea «TARJETADE».
 */
export function label(c, str, x, y, { font, color, tracking = 0, align = 'left', ws } = {}) {
  c.font = font;
  c.fillStyle = color;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  if (!tracking) {
    const w = c.measureText(str).width;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    c.fillText(str, x0, y);
    return w;
  }
  const extra = ws ?? (tracking > 0 ? tracking * 3.5 : 0);
  const chars = [...str];
  const nSp = chars.filter((ch) => ch === ' ').length;
  const w = c.measureText(str).width + tracking * (chars.length - 1) + extra * nSp;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  // con tracking: medir el prefijo para respetar el kerning aproximado
  let acc = '', sp = 0;
  chars.forEach((ch, i) => {
    if (ch === ' ') { sp++; acc += ch; return; }
    const gx = x0 + (acc ? c.measureText(acc).width : 0) + tracking * i + extra * sp;
    c.fillText(ch, gx, y);
    acc += ch;
  });
  return w;
}
