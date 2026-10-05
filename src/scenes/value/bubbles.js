// Globos de chat: aparecen como «escribiendo…» (tres puntitos que saltan) y se estiran hasta el mensaje
// completo con rebote, justo en su cue. El de Prime lleva un tilde que se dibuja con destello.
import { PAL, shade, rgba } from '../../engine/color.js';
import { E, clamp, spring, TAU, lerp } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { fontStr, txt } from '../../engine/text.js';
import { shade3 } from './shade3.js';
import { tones, label } from './util.js';
import { checkStroke } from './icons.js';

const FS = 50;
const PAD = 42, BH = 118, R = 42;

function bubblePath(w, h, tail) {
  // caja redondeada con colita (tail: 'bl' abajo-izquierda hacia afuera, 'br' abajo-derecha)
  const p = new Path2D();
  const r = Math.min(R, h / 2, w / 2);
  p.moveTo(r, 0);
  p.lineTo(w - r, 0);
  p.arcTo(w, 0, w, r, r);
  p.lineTo(w, h - r);
  p.arcTo(w, h, w - r, h, r);
  if (tail === 'br') {
    p.lineTo(w - r * 0.6, h);
    p.quadraticCurveTo(w - 6, h + 6, w + 18, h + 30);
    p.quadraticCurveTo(w - 40, h + 22, w - r * 1.6, h);
  }
  if (tail === 'bl') {
    p.lineTo(r * 1.6, h);
    p.quadraticCurveTo(40, h + 22, -18, h + 30);
    p.quadraticCurveTo(6, h + 6, r * 0.6, h);
  }
  p.lineTo(r, h);
  p.arcTo(0, h, 0, h - r, r);
  p.lineTo(0, r);
  p.arcTo(0, 0, r, 0, r);
  p.closePath();
  return p;
}

/**
 * Globo en t. o = { t0 (cue: el globo llega completo con rebote), x, y (esquina sup-izq del globo completo),
 *   text, bg, fg, weight, tail, check (bool), out (t de salida), lean (rad) }
 */
export function drawBubble(c, t, o) {
  const dt = t - o.t0;
  if (dt < -0.42) return;
  const T = txt(o.text, { size: FS, weight: o.weight ?? 600, tracking: 0 });
  const extra = o.check ? 88 : 0;
  const fullW = T.width + PAD * 2 + extra;
  // etapa 1: «escribiendo…» (−0,42 → −0,035): globito con tres puntitos que saltan
  const typeIn = spring(dt, -0.42, { from: 0, to: 1, freq: 4, damp: 9 });
  // etapa 2: POP en el cue con el mensaje YA completo adentro (sin tipear después) y rebote al entrar
  const P0 = -0.035;
  const grow = dt < P0 ? 0 : 1;
  const w = grow ? fullW : 150;
  const s = grow ? Math.max(0, spring(dt, P0, { from: 0.5, to: 1, freq: 3.6, damp: 8 })) : Math.max(0, Math.min(typeIn, 1.2));
  let k = 1;
  if (o.out !== undefined && t > o.out) k = Math.max(0, 1 - E.backIn(2.2)(clamp((t - o.out) / 0.22)));
  if (s * k <= 0.002) return;
  const tn = tones(o.bg, -0.14, 0.2);
  c.save();
  // ancla de crecimiento: el lado de la colita. El globito de «escribiendo…» llega volando desde su costado.
  const ax = o.tail === 'bl' ? 0 : fullW;
  const fly = o.from ? o.from * (1 - E.backOut(1.4)(clamp((dt + 0.42) / 0.2))) : 0;
  c.translate(o.x + ax + fly, o.y + BH);
  if (o.lean) c.rotate(o.lean);
  c.scale(s * k, s * k);
  c.translate(o.tail === 'bl' ? 0 : -w, -BH);
  const path = bubblePath(w, BH, o.tail);
  // sombra suave
  c.save();
  c.shadowColor = 'rgba(4,16,31,0.38)';
  c.shadowBlur = 28;
  c.shadowOffsetX = 10;
  c.shadowOffsetY = 16;
  c.fillStyle = o.bg;
  c.fill(path);
  c.restore();
  shade3(c, path, tn, { sh: 8, rim: 3 });
  // puntitos de «escribiendo…»
  const dotsA = 1 - grow;
  if (dotsA > 0.01) {
    for (let i = 0; i < 3; i++) {
      const bob = Math.max(0, Math.sin((t * 9 - i * 0.7) * Math.PI)) * 10;
      c.fillStyle = rgba(o.fg, 0.55 * dotsA);
      c.beginPath(); c.arc(w / 2 - 30 + i * 30, BH / 2 - bob, 9, 0, TAU); c.fill();
    }
  }
  // texto completo desde el pop
  if (grow) label(c, o.text, PAD, BH / 2 + T.capH / 2, { font: T.font, color: o.fg });
  // tilde en círculo dorado
  if (o.check && grow > 0.85) {
    const cx = fullW - PAD - 26, cy = BH / 2;
    const ck = spring(dt, 0.04, { from: 0, to: 1, freq: 3.6, damp: 7 });
    if (ck > 0.01) {
      const cp = new Path2D();
      cp.arc(cx, cy, 31 * ck, 0, TAU);
      shade3(c, cp, tones(PAL.gold, -0.22, 0.4), { sh: 4, rim: 2 });
      c.save();
      c.translate(cx, cy + 2);
      checkStroke(c, 52, E.outCubic(clamp((dt - 0.1) / 0.16)), PAL.white, 8);
      c.restore();
      const sp = clamp((dt - 0.22) / 0.3);
      if (sp > 0 && sp < 1) sparkle(c, cx + 26, cy - 26, 30 * Math.sin(Math.PI * sp), { alpha: 1, color: '#FFFFFF' });
      // estallido de chispitas doradas y blancas desde el tilde
      const bp = (dt - 0.12) / 0.5;
      if (bp > 0 && bp < 1) {
        for (let i = 0; i < 14; i++) {
          // solo hacia la derecha/arriba/abajo del tilde: nunca cruzan el texto del globo
          const a = -1.75 + (i / 13) * 3.5, d = (64 + 22 * (i % 3)) + 300 * E.outCubic(bp) * (0.6 + 0.4 * ((i * 7) % 5) / 4);
          const sz = (i % 2 ? 14 : 20) * (1 - bp);
          sparkle(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, sz, { alpha: 1, color: i % 3 ? PAL.goldLight : '#FFFFFF', rot: bp * 2 });
        }
      }
    }
  }
  c.restore();
}

export { shade };
