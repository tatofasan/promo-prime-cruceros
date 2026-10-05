// Titulares de VALOR con el estilo de la pieza (§6.7): Outfit 900 en mayúsculas, cara «SEA» (blanco que
// pasa a aqua100 en la mitad, como los titulares de TYPE) con extrusión navy y palabra clave en degradé dorado.
// Entrada POR PALABRA con la MISMA curva y la misma escala final (cada palabra sube desde abajo dentro de la
// máscara de su línea: nunca se pisan dos líneas), escalonada de a cuadros. Salida por línea en una sola
// dirección (sin cruzarse ni transparencias). Espacio entre palabras explícito (wordSpace, en em).
import { txt, drawText } from '../../engine/text.js';
import { E, clamp, spring, TAU } from '../../engine/ease.js';
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { layer } from '../../engine/layer.js';
import { rr } from './util.js';

export const goldFill = (c, T) => {
  const b = T.lines[0].base;
  const g = c.createLinearGradient(0, b - T.capH * 1.05, 0, b + 4);
  g.addColorStop(0, PAL.goldPale);
  g.addColorStop(0.46, PAL.goldLight);
  g.addColorStop(0.5, PAL.gold);
  g.addColorStop(1, mixHex(PAL.gold, PAL.coral, 0.3));
  return g;
};

const SEA_LOW = mixHex(PAL.aqua100, PAL.aqua200, 0.55);
/** Cara «SEA» (la misma de TYPE): blanco arriba, horizonte en la mitad y aqua100 abajo. */
export const seaFill = (c, T) => {
  const b = T.lines[0].base;
  const g = c.createLinearGradient(0, b - T.capH, 0, b);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.46, '#FFFFFF');
  g.addColorStop(0.5, PAL.aqua100);
  g.addColorStop(1, SEA_LOW);
  return g;
};

/**
 * Prepara un bloque. lines = [{ text, size, weight, tracking, gold, color, wordSpace (em), lead }];
 * o = { x, y, align ('left'|'center'), gap (px entre líneas) }. y = línea de base de la PRIMERA línea.
 * wordSpace por defecto: 0,38 em si el tracking es ≥ 0,06 em (si no, 0,26 em).
 */
export function makeBlock(lines, o) {
  const words = [];
  let y = o.y;
  let wi = 0;
  const L = lines.map((ln, li) => {
    const tr = ln.tracking ?? -0.015;
    const ws = ln.text.split(' ').map((w) => txt(w, { size: ln.size, weight: ln.weight ?? 900, tracking: tr }));
    const space = ln.size * (ln.wordSpace ?? (tr >= 0.06 ? 0.38 : 0.26));
    const width = ws.reduce((s, T) => s + T.width, 0) + space * (ws.length - 1);
    let x = o.align === 'center' ? o.x - width / 2 : o.x;
    if (li > 0) y += ln.size * (ln.lead ?? 0.98) + (o.gap ?? 0);
    let il = 0;
    for (const T of ws) {
      words.push({ T, x, y, w: T.width, line: li, il: il++, i: wi++, gold: !!ln.gold, color: ln.color, size: ln.size });
      x += T.width + space;
    }
    return { y, width, size: ln.size, x0: o.align === 'center' ? o.x - width / 2 : o.x };
  });
  const minX = Math.min(...words.map((w) => w.x)), maxX = Math.max(...words.map((w) => w.x + w.w));
  return { words, lines: L, box: { x: minX, y: o.y - lines[0].size, w: maxX - minX, h: y - o.y + lines[0].size * 1.25 } };
}

/** Curva única de entrada «whip»: sube desde abajo (dentro de la máscara de la línea) y frena con un overshoot chico. */
export const WHIP_DUR = 0.22;
function enter(kind, dt, size) {
  const s = { dx: 0, dy: 0, sx: 1, sy: 1, r: 0, a: 1, clip: false };
  if (dt < 0) { s.a = 0; return s; }
  if (kind === 'whip' || kind === 'rise') {
    const u = clamp(dt / WHIP_DUR);
    const k = (1 - u) * (1 - u);
    s.dy = size * 1.45 * (1 - E.backOut(1.5)(u));
    s.sy = 1 + 0.1 * k;
    s.sx = 1 - 0.035 * k;
    s.clip = true;
  } else if (kind === 'slam') {
    const hit = 0.1;
    if (dt < hit) {
      const e = E.inQuad(dt / hit);
      s.sx = s.sy = 2.2 - 1.2 * e;
      s.a = clamp(dt / 0.04);
    } else {
      const q = dt - hit;
      const k = Math.exp(-q * 9) * Math.cos(q * 32);
      s.sy = 1 - 0.14 * k; s.sx = 1 + 0.1 * k;
    }
  } else if (kind === 'pop') {
    const k = spring(dt, 0, { from: 0, to: 1, freq: 3.2, damp: 7 });
    s.sx = s.sy = Math.max(0, k);
    s.dy = (1 - Math.min(1, k)) * size * 0.3;
    s.r = (1 - Math.min(1, k)) * -0.25;
    s.a = clamp(dt / 0.05);
  }
  return s;
}

/** Salida por palabra: 'pop' anticipa y se encoge · 'fly' se va arriba (bloques de una línea). */
function leave(kind, dt, size, s) {
  if (dt < 0) return s;
  const d = kind === 'pop' ? 0.2 : 0.26;
  const p = clamp(dt / d);
  if (kind === 'pop') {
    const k = Math.max(0, 1 - E.backIn(2.6)(p));
    s.sx *= k; s.sy *= k; s.a *= clamp(k * 4);
  } else if (kind === 'fly') {
    s.dy -= E.backIn(1.8)(p) * size * 2.6;
    s.sy *= 1 + 0.3 * E.inQuad(p);
    s.a *= 1 - E.inCubic(p);
  }
  return s;
}

/** Salida 'slide' por LÍNEA: cada línea se va de costado (sin cruzarse con las otras), estirándose. */
function lineOut(o, li, t) {
  if (o.leave !== 'slide' || o.out === undefined) return null;
  const p = clamp((t - (o.out + li * (o.lineStagger ?? 0.01))) / (o.outDur ?? 0.055));
  if (p <= 0) return null;
  const e = E.inCubic(p);
  return { dx: (o.outDir ?? -1) * e * 1700, sx: 1 + 0.35 * E.inQuad(p), p };
}

/**
 * Dibuja el bloque en t.
 * o = { t, in, enter, stagger, order(w), out, leave ('slide'|'fly'|'pop'), outDir, outDur, lineStagger, outStagger,
 *       extrude {depth,color,dx,dy} | false, shadow, sweep {t0, dur, alpha}, live (px, por línea), underline,
 *       hops [t…] (ola de saltitos por palabra), hopAmp (× tamaño), hopOrder(w) }
 */
export function drawBlock(ctx, B, o) {
  const t = o.t;
  if (t < o.in - 0.001) return;
  const paint = (c) => {
    for (let li = 0; li < B.lines.length; li++) {
      const ln = B.lines[li];
      const lo = lineOut(o, li, t);
      if (lo && lo.p >= 1) continue;
      c.save();
      if (lo) {
        // la línea entera se corre y se estira desde su borde de salida
        const ax = (o.outDir ?? -1) < 0 ? ln.x0 + ln.width : ln.x0;
        c.translate(ax + lo.dx, 0);
        c.scale(lo.sx, 1);
        c.translate(-ax, 0);
      }
      const ly = o.live ? Math.sin(TAU * 0.5 * t + li * 1.3) * o.live * clamp((t - o.in - 0.5) / 0.4) : 0;
      for (const w of B.words) {
        if (w.line !== li) continue;
        const st = o.order ? o.order(w) : w.i;
        let s = enter(o.enter ?? 'whip', t - (o.in + st * (o.stagger ?? 0.0333)), w.size);
        if (o.out !== undefined && o.leave !== 'slide') s = leave(o.leave ?? 'pop', t - (o.out + st * (o.outStagger ?? 0.03)), w.size, s);
        if (s.a <= 0.003 || s.sx <= 0.002 || s.sy <= 0.002) continue;
        // saltitos en el beat: una ola que recorre las palabras (2 cuadros entre una y otra)
        if (o.hops) {
          for (const th of o.hops) {
            const u = (t - (th + (o.hopOrder ? o.hopOrder(w) : w.i) * 0.0333)) / 0.2;
            if (u <= 0 || u >= 1.6) continue;
            if (u < 1) s.dy -= w.size * (o.hopAmp ?? 0.13) * Math.sin(Math.PI * u);
            else { const q = (u - 1) / 0.6; s.sy *= 1 - 0.06 * Math.sin(Math.PI * q); s.sx *= 1 + 0.03 * Math.sin(Math.PI * q); }
          }
        }
        c.save();
        if (s.clip) {
          // máscara de la línea: la palabra sube desde abajo de su propia base (no invade otras líneas)
          c.beginPath();
          c.rect(w.x - w.size, w.y - w.size * 1.25, w.w + w.size * 2, w.size * 1.25 + w.size * 0.24);
          c.clip();
        }
        c.globalAlpha *= s.a;
        // pivote: centro de la palabra sobre la línea de base (el squash apoya en el piso)
        c.translate(w.x + w.w / 2 + s.dx, w.y + s.dy + ly);
        if (s.r) c.rotate(s.r);
        c.scale(s.sx, s.sy);
        drawText(c, w.T, {
          t: 1e6, in: 0, anim: 'none', x: -w.w / 2, y: -w.T.lines[0].base,
          fill: w.gold ? goldFill : (w.color ?? seaFill),
          extrude: o.extrude === false ? undefined : (o.extrude ?? { depth: Math.round(w.size * 0.075), color: PAL.navy900, dx: 0.62, dy: 1 }),
          shadow: o.shadow,
        });
        c.restore();
      }
      if (o.underline && o.underline.line === li) drawUnderline(c, B, o.underline, t, ly);
      c.restore();
    }
  };
  const sw = o.sweep;
  if (sw && t > sw.t0 && t < sw.t0 + (sw.dur ?? 0.5)) {
    const L = layer();
    const lc = L.getContext('2d');
    lc.setTransform(ctx.getTransform());
    paint(lc);
    const p = E.inOutSine((t - sw.t0) / (sw.dur ?? 0.5));
    const { x, y, w, h } = B.box;
    lc.globalCompositeOperation = 'source-atop';
    const bw = w * 0.22;
    const cx = x - bw + (w + bw * 2) * p;
    lc.translate(cx, y + h / 2);
    lc.rotate(-0.38);
    const g = lc.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${sw.alpha ?? 0.75})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.fillStyle = g;
    lc.fillRect(-bw / 2, -h * 3, bw, h * 6);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(L, 0, 0);
    ctx.restore();
  } else {
    paint(ctx);
  }
}

/** Subrayado que crece bajo una línea (u = { line, t0, dur, color, h, off }). Sale con su línea. */
function drawUnderline(c, B, u, t, ly = 0) {
  const p = E.outExpo(clamp((t - u.t0) / (u.dur ?? 0.35)));
  if (p <= 0.003) return;
  const ws = B.words.filter((w) => w.line === u.line);
  const x0 = ws[0].x - 6, x1 = ws[ws.length - 1].x + ws[ws.length - 1].w + 6;
  const y = ws[0].y + (u.off ?? ws[0].size * 0.2) + ly;
  const h = u.h ?? ws[0].size * 0.13;
  const w = (x1 - x0) * p;
  c.save();
  c.fillStyle = PAL.navy900;
  c.beginPath(); rr(c, x0 + 5, y + 6, w, h, h / 2); c.fill();
  c.fillStyle = u.color ?? PAL.coral;
  c.beginPath(); rr(c, x0, y, w, h, h / 2); c.fill();
  c.fillStyle = rgba('#FFFFFF', 0.35);
  c.beginPath(); rr(c, x0 + h * 0.4, y + h * 0.18, Math.max(0, w - h * 0.8), h * 0.22, h * 0.11); c.fill();
  c.restore();
}
