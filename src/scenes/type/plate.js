// Placa del lockup (arriba a la izquierda): velo navy translúcido (~0,55) en degradé, filo de luz de 1 px,
// reflejo diagonal suave y una barra dorada fina que destella 2 cuadros en cada corte. La placa es SIEMPRE la caja
// del texto más el margen (exp-title.js la calcula cuadro a cuadro): el texto nunca se sale. Aparece cuando las
// líneas llegan (7,17) y se apaga JUNTO con la última línea en exp.out. Sin desenfoque de fondo (el compositor no
// lo garantiza): la separación la dan el velo, la extrusión y la sombra de las letras.
import { E, clamp } from '../../engine/ease.js';
import { rrectPath } from '../../engine/draw.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { C } from './style.js';
import { beatPulse } from '../../engine/time.js';

// x, y, textX y scale fijan el lockup (exp-title.js ubica el texto con esto); margen de la placa alrededor del texto
export const PLATE = { x: 96, y: 70, scale: 0.34, textX: 96 + 40, w: 440, h: 220, r: 18 };
export const PAD = { left: 38, top: 24, right: 28, bottom: 14 };

const IN0 = 7.17; // aparece cuando las líneas ya llegaron (el viaje termina en 7,27–7,36)

/** lastA = alfa de la última línea (la placa y la barra se apagan con ella). */
export function plateState(t, lastA = 1) {
  const body = E.outCubic(clamp((t - IN0) / 0.1)) * lastA;
  const bar = E.backOut(1.8)(clamp((t - IN0 - 0.02) / 0.16)) * lastA;
  // destello de 2 cuadros EXACTO en cada corte + latido suave en cada beat (el lockup sigue vivo)
  let flash = 0.22 * beatPulse(t, { from: 7.3, to: C.out, decay: 0.12 });
  for (const tc of [C.dinner, C.casino, C.sunset]) { const q = t - tc; if (q >= 0 && q < 2 / 60) flash = 1; else if (q >= 0 && q < 0.4) flash = Math.max(flash, 0.5 * Math.exp(-(q - 2 / 60) * 9)); }
  return { bar, body, flash };
}

/** Pinta la placa sobre la caja `box` { x, y, w, h } (pantalla). */
export function drawPlate(ctx, t, ps, box) {
  const { x, y, w, h } = box;
  const r = PLATE.r;
  if (ps.body > 0.002) {
    const P = rrectPath(x, y, w, h, r);
    ctx.save();
    ctx.globalAlpha *= ps.body;
    // sombra blanda y leve (no «recuadro de interfaz»)
    ctx.save();
    ctx.shadowColor = rgba(PAL.ink, 0.3);
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = rgba(PAL.navy900, 0.3);
    ctx.fill(P);
    ctx.restore();
    // velo en degradé: más liviano arriba, más denso abajo (ahí van «ÚNICAS» y «EN CRUCERO»)
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba(PAL.navy700, 0.36));
    g.addColorStop(0.45, rgba(PAL.navy900, 0.46));
    g.addColorStop(1, rgba(PAL.ink, 0.56));
    ctx.fillStyle = g;
    ctx.fill(P);
    // reflejo diagonal suave
    ctx.save();
    ctx.clip(P);
    const s = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    s.addColorStop(0, 'rgba(255,255,255,0.09)');
    s.addColorStop(0.35, 'rgba(255,255,255,0.025)');
    s.addColorStop(0.36, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    // filo de luz de 1 px (más vivo arriba) y canto frío abajo
    const rim = ctx.createLinearGradient(0, y, 0, y + h);
    rim.addColorStop(0, 'rgba(255,255,255,0.55)');
    rim.addColorStop(0.2, 'rgba(255,255,255,0.12)');
    rim.addColorStop(0.8, 'rgba(255,255,255,0.05)');
    rim.addColorStop(1, rgba(PAL.aqua300, 0.25));
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.stroke(rrectPath(x + 0.5, y + 0.5, w - 1, h - 1, r));
    ctx.restore();
  }
  if (ps.bar > 0.002) {
    const bw = 4, bx = x + 15, by = y + 18, full = h - 36, bh = full * Math.min(1.08, ps.bar);
    const B = rrectPath(bx, by, bw, Math.max(bw, bh), bw / 2);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, ps.bar * 1.5);
    if (ps.flash > 0.01) {
      ctx.shadowColor = rgba(PAL.gold, Math.min(1, 0.95 * ps.flash));
      ctx.shadowBlur = 22 * ps.flash;
    }
    const g = ctx.createLinearGradient(0, by, 0, by + full);
    g.addColorStop(0, PAL.goldPale);
    g.addColorStop(0.45, PAL.gold);
    g.addColorStop(1, mixHex(PAL.gold, PAL.coral, 0.6));
    ctx.fillStyle = g;
    ctx.fill(B);
    if (ps.flash > 0.6) {
      // destello: la barra se enciende casi blanca y se ensancha un pelo
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= ps.flash;
      ctx.fillStyle = '#FFF6DE';
      ctx.fill(rrectPath(bx - 1, by - 2, bw + 2, Math.max(bw, bh) + 4, (bw + 2) / 2));
    }
    ctx.restore();
  }
}
