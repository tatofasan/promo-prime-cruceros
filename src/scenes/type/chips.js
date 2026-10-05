// Chips de escena abajo a la izquierda (ancla x 96, y 1000): disco dorado con pictograma que entra girando,
// píldora de vidrio navy que se estira desde el disco y letras que entran escalonadas. El disco, la píldora y el
// texto entran y salen JUNTOS (nunca queda el ícono solo ni una píldora vacía). Salen antes del corte.
import { txt } from '../../engine/text.js';
import { E, clamp, pop } from '../../engine/ease.js';
import { beatPulse, BEAT } from '../../engine/time.js';
import { rrectPath, sparkle } from '../../engine/draw.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { C } from './style.js';
import { ICONS } from './icons.js';
import { frost, sweepAtop } from './surface.js';

const AX = 96, AY = 1000;
const RB = 35; // radio del disco
const HP = 62; // alto de la píldora
const CY = AY - RB; // centro vertical
const SIZE = 36;
const E8 = BEAT / 8;
const OUT_DUR = 0.15; // lo que tarda en irse: la píldora se cierra sobre el disco y los dos se van juntos
const OUT_GAP = 0.02; // termina de salir un poquito antes del corte siguiente

export const CHIPS = [
  // entra 1/8 de beat después de cada corte (el primero, apenas cae «EN CRUCERO») y termina de salir antes del
  // corte siguiente: completo y quieto ≥ 0,6 s
  { text: 'PILETAS Y TOBOGANES', icon: 'pool', in: C.w3 + BEAT / 4, out: C.dinner - OUT_DUR - OUT_GAP },
  { text: 'CENAS GOURMET', icon: 'cloche', in: C.dinner + E8, out: C.casino - OUT_DUR - OUT_GAP },
  { text: 'SHOWS Y CASINO', icon: 'star', in: C.casino + E8, out: C.sunset - OUT_DUR - OUT_GAP },
  { text: 'ATARDECERES EN CUBIERTA', icon: 'sunset', in: C.sunset + E8, out: C.out - OUT_DUR - OUT_GAP },
];
// el texto se mide en el primer uso (en el navegador las fuentes cargan después de importar las escenas)
const tOf = (ch) => (ch.T ??= txt(ch.text, { size: SIZE, weight: 700, tracking: 0.06 }));

function badge(ctx, t, ch, k, spin) {
  const cx = AX + RB, cy = CY;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.scale(k, k);
  // sombra + disco en 3 tonos (base dorada, sombra abajo a la derecha, filo de luz arriba)
  ctx.save();
  ctx.shadowColor = rgba(PAL.ink, 0.5);
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = mixHex(PAL.gold, PAL.coral, 0.45);
  ctx.beginPath(); ctx.arc(0, 0, RB, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(-RB * 0.6, -RB, RB * 0.6, RB);
  g.addColorStop(0, PAL.goldPale);
  g.addColorStop(0.45, PAL.goldLight);
  g.addColorStop(0.5, PAL.gold);
  g.addColorStop(1, mixHex(PAL.gold, PAL.coral, 0.3));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(-0.8, -1.2, RB - 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,235,0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, RB - 4.5, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  // pictograma con latido en cada beat
  const bp = 1 + 0.1 * beatPulse(t, { from: ch.in + 0.3, to: ch.out, decay: 0.09 });
  ctx.rotate(-spin);
  ctx.scale(bp, bp);
  ICONS[ch.icon](ctx, RB * 1.12, t);
  ctx.restore();
}

function drawChip(ctx, t, ch) {
  const q = t - ch.in;
  if (q < 0) return;
  const qo = t - ch.out;
  if (qo > OUT_DUR) return;
  // disco: pop con giro; píldora: se estira desde el disco con rebote (los dos arrancan en el mismo cuadro)
  let k = pop(t, ch.in - 0.04, { dur: 0.32, over: 1.3 });
  let spin = -1.4 * (1 - E.backOut(1.6)(clamp(q / 0.36)));
  let body = E.backOut(1.25)(clamp((q + 0.03) / 0.26));
  // salida: la píldora se cierra sobre el disco y el disco se encoge AL MISMO TIEMPO (terminan juntos)
  if (qo > 0) {
    const p = clamp(qo / OUT_DUR);
    body *= 1 - E.inCubic(p);
    k *= Math.max(0, 1 - E.inCubic(p));
    spin += 0.9 * p;
  }
  const T = tOf(ch);
  const full = RB + 14 + T.width + 8;
  const w = RB + full * Math.max(0, body);
  const x0 = AX + RB - RB * 0.2;
  if (body > 0.01) {
    const P = rrectPath(x0, CY - HP / 2, Math.max(HP, w), HP, HP / 2);
    ctx.save();
    ctx.shadowColor = rgba(PAL.ink, 0.45);
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = rgba(PAL.navy900, 0.9);
    ctx.fill(P);
    ctx.restore();
    frost(ctx, P, { x: x0, y: CY - HP / 2, w: Math.max(HP, w), h: HP }, { blur: 12 });
    ctx.save();
    const g = ctx.createLinearGradient(0, CY - HP / 2, 0, CY + HP / 2);
    g.addColorStop(0, rgba(PAL.navy700, 0.62));
    g.addColorStop(1, rgba(PAL.ink, 0.82));
    ctx.fillStyle = g;
    ctx.fill(P);
    const rim = ctx.createLinearGradient(0, CY - HP / 2, 0, CY + HP / 2);
    rim.addColorStop(0, 'rgba(255,255,255,0.45)');
    rim.addColorStop(0.3, 'rgba(255,255,255,0.06)');
    rim.addColorStop(1, rgba(PAL.aqua300, 0.2));
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6;
    ctx.stroke(P);
    ctx.restore();
    // letras escalonadas (entran desde la izquierda con micro-pop; salen desde la última), recortadas a la píldora
    ctx.save();
    ctx.clip(P);
    ctx.font = T.font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const tx = AX + RB * 2 + 18, by = CY + T.capH / 2;
    const gl = T.lines[0].glyphs;
    gl.forEach((g, i) => {
      // entran con la píldora (la píldora las destapa); al salir las tapa la píldora que se cierra
      const qi = q + 0.03 - i * 0.006;
      if (qi <= 0) return;
      const e = E.outCubic(clamp(qi / 0.2));
      const a = clamp(qi / 0.05);
      if (a <= 0.002) return;
      const s = 1 + 0.35 * Math.exp(-qi / 0.05);
      const gx = tx + g.x, cx = gx + g.w / 2;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(cx - (1 - e) * 16, by);
      ctx.scale(s, s);
      ctx.translate(-cx, -by);
      ctx.fillStyle = rgba(PAL.ink, 0.6);
      ctx.fillText(g.ch, gx + 1.2, by + 2.4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(g.ch, gx, by);
      ctx.restore();
    });
    // brillo que cruza el vidrio cuando terminan de entrar las letras
    sweepAtop(ctx, { x: x0, y: CY - HP / 2, w: Math.max(HP, w), h: HP }, (q - 0.42) / 0.6, { color: '255,233,184', alpha: 0.32, width: 0.22, blend: 'screen' });
    ctx.restore();
  }
  if (k > 0.002) badge(ctx, t, ch, k, spin);
  // chispa al llegar el disco
  const sp = (q - 0.1) / 0.32;
  if (sp > 0 && sp < 1) sparkle(ctx, AX + RB * 1.8, CY - RB * 0.8, 22 * Math.sin(Math.PI * sp), { alpha: 1, color: '#FFF4D6', rot: sp });
}

export function drawChips(ctx, t) {
  for (const ch of CHIPS) drawChip(ctx, t, ch);
}
