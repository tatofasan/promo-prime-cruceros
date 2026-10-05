// Ojo de buey en primer plano: aro blanco/plateado con bisel (filo de luz y sombra), ranura maquinada,
// 8 bulones con brillo, sombra del aro sobre el casco, vidrio que refleja el cielo y el mar con brillo
// diagonal, sombra interior y gotitas de agua. Es el MISMO dibujo que usa el barco de cerca (ship.js),
// así el push-in de HOOK y el iris de DECK-A empalman sin salto.
import { lin, rad, sparkle } from '../engine/draw.js';
import { TAU } from '../engine/ease.js';
import { hash } from '../engine/noise.js';
import { mixHex } from '../engine/color.js';
import { resolve } from './presets.js';
import { ca, unit } from './util.js';

export const PORTHOLE = { ring: 0.3, boltR: 1.15, bolts: 8 };

/**
 * drawPorthole(ctx, t, cx, cy, r, { preset, glass, rimOnly, inside, ring, spin, hull, drops, sweep, lit, shadow, detail })
 *  r = radio del VIDRIO (el aro va de r a r·(1+ring); ring def 0.3).
 *  - glass 0..1: opacidad del reflejo (0 = vidrio transparente, se ve solo `inside`)
 *  - rimOnly: solo el aro (para el borde del iris) · inside(ctx): lo que se ve a través (se dibuja recortado)
 *  - spin: rotación del aro (rad) · hull: color de una placa de casco alrededor (null = nada)
 *  - drops: gotitas sobre el vidrio (def true) · sweep 0..1: pasa un brillo extra por el vidrio
 *  - lit 0..1: luz cálida de adentro (noche) · shadow 0..1: sombra del aro sobre el casco (def 1)
 */
export function drawPorthole(ctx, t, cx, cy, r, o = {}) {
  if (r <= 0.3) return;
  const P = resolve(o.preset ?? 'golden');
  const L = P.sky.light;
  const [lx, ly] = unit(o.lightDir ?? L.dir);
  const ringW = o.ring ?? PORTHOLE.ring;
  const R1 = r * (1 + ringW);
  const m = ctx.getTransform();
  const mw = 0.6 / (Math.hypot(m.a, m.b) || 1); // 0,6 px de pantalla en unidades locales
  const detail = o.detail ?? (r / mw * 0.6 > 18 ? 2 : r / mw * 0.6 > 5 ? 1 : 0);

  ctx.save();
  // placa del casco alrededor (opcional)
  if (o.hull) {
    ctx.fillStyle = o.hull;
    ctx.beginPath(); ctx.arc(cx, cy, R1 * 2.4, 0, TAU); ctx.fill();
  }
  // sombra del aro sobre el casco (hacia el lado contrario a la luz)
  const sh = o.shadow ?? 1;
  const lite = !!o.lite; // versión liviana (muchos ojos de buey chicos a la vez)
  if (sh > 0.01 && detail > 0 && lite) {
    ctx.fillStyle = `rgba(2,8,18,${0.3 * sh})`;
    ctx.beginPath(); ctx.arc(cx - lx * r * 0.1, cy - ly * r * 0.1, R1 * 1.04, 0, TAU); ctx.fill();
  } else if (sh > 0.01 && detail > 0) {
    const ox = -lx * r * 0.1, oy = -ly * r * 0.1;
    ctx.fillStyle = rad(ctx, cx + ox, cy + oy, R1 * 0.9, cx + ox, cy + oy, R1 * 1.14, [[0, `rgba(2,8,18,${0.5 * sh})`], [1, 'rgba(2,8,18,0)']]);
    ctx.beginPath(); ctx.arc(cx + ox, cy + oy, R1 * 1.14, 0, TAU); ctx.fill();
  }

  // vidrio
  if (!o.rimOnly) drawGlass(ctx, t, cx, cy, r, o, P, lx, ly, detail, mw);

  // aro: cuerpo con degradé a lo largo de la luz
  const metalHi = mixHex('#FFFFFF', L.key, 0.25), metal = mixHex('#DCE6EE', L.ambient, L.ambientA * 0.6), metalLo = mixHex('#7F95A8', L.shade, 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, R1, 0, TAU);
  ctx.arc(cx, cy, r, 0, TAU, true);
  ctx.fillStyle = lin(ctx, cx + lx * R1, cy + ly * R1, cx - lx * R1, cy - ly * R1, [[0, metalHi], [0.45, metal], [1, metalLo]]);
  ctx.fill();
  if (detail > 0 && !lite) {
    // ranura maquinada a mitad del aro
    const rg = r * (1 + ringW * 0.56);
    ctx.lineWidth = Math.max(mw, r * 0.012);
    ctx.strokeStyle = lin(ctx, cx + lx * rg, cy + ly * rg, cx - lx * rg, cy - ly * rg, [[0, ca(metalLo, 0.55)], [1, ca(metalLo, 0.25)]]);
    ctx.beginPath(); ctx.arc(cx, cy, rg, 0, TAU); ctx.stroke();
    ctx.strokeStyle = lin(ctx, cx - lx * rg, cy - ly * rg, cx + lx * rg, cy + ly * rg, [[0, ca('#ffffff', 0.7)], [1, ca('#ffffff', 0.1)]]);
    ctx.beginPath(); ctx.arc(cx, cy, rg + Math.max(mw, r * 0.012), 0, TAU); ctx.stroke();
    // bisel exterior: filo de luz del lado de la luz, sombra del otro
    bevel(ctx, cx, cy, R1 - r * 0.018, r * 0.04, lx, ly, ca('#ffffff', 0.95), ca(metalLo, 0.85));
    // bisel interior (cóncavo: al revés)
    bevel(ctx, cx, cy, r + r * 0.02, r * 0.045, -lx, -ly, ca('#ffffff', 0.9), ca(mixHex(metalLo, '#0A2340', 0.4), 0.9));
  }

  // burlete oscuro entre vidrio y aro
  if (detail > 0 && !o.rimOnly) {
    ctx.strokeStyle = 'rgba(4,16,31,0.55)';
    ctx.lineWidth = Math.max(mw, r * 0.016);
    ctx.beginPath(); ctx.arc(cx, cy, r + r * 0.006, 0, TAU); ctx.stroke();
  }
  // bulones
  const nb = o.bolts ?? PORTHOLE.bolts;
  if (detail > 0 && nb > 0) {
    const br = r * 0.05, rr = r * (1 + ringW * 0.5);
    const spin = o.spin ?? 0;
    for (let k = 0; k < nb; k++) {
      const a = spin + Math.PI / nb + (k * TAU) / nb;
      const bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr;
      bolt(ctx, bx, by, br, lx, ly, metalHi, metal, metalLo, detail);
    }
  }
  ctx.restore();
}

function bevel(ctx, cx, cy, rr, w, lx, ly, hi, lo) {
  ctx.lineWidth = w;
  ctx.strokeStyle = lin(ctx, cx + lx * rr, cy + ly * rr, cx - lx * rr, cy - ly * rr, [[0, hi], [0.42, 'rgba(255,255,255,0)'], [0.58, 'rgba(0,0,0,0)'], [1, lo]]);
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
}

function bolt(ctx, x, y, br, lx, ly, hi, mid, lo, detail) {
  // sombrita, cuerpo en degradé, filo y punto de brillo
  ctx.fillStyle = 'rgba(2,8,18,0.35)';
  ctx.beginPath(); ctx.arc(x - lx * br * 0.45, y - ly * br * 0.45, br * 1.12, 0, TAU); ctx.fill();
  ctx.fillStyle = lin(ctx, x + lx * br, y + ly * br, x - lx * br, y - ly * br, [[0, hi], [0.5, mid], [1, lo]]);
  ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
  if (detail > 1) {
    ctx.strokeStyle = ca(lo, 0.7);
    ctx.lineWidth = br * 0.16;
    ctx.beginPath(); ctx.arc(x, y, br * 0.55, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x + lx * br * 0.42, y + ly * br * 0.42, br * 0.24, 0, TAU); ctx.fill();
  }
}

function drawGlass(ctx, t, cx, cy, r, o, P, lx, ly, detail, mw) {
  const S = P.sky, SEA = P.sea;
  const gA = o.glass ?? 1;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (o.inside) { ctx.save(); o.inside(ctx); ctx.restore(); } else {
    ctx.fillStyle = SEA.deep;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  if (gA > 0.003) {
    ctx.save();
    ctx.globalAlpha *= gA;
    // reflejo del cielo (degradé del preset) con el horizonte curvado por el vidrio
    const top = cy - r, hz = cy + r * 0.28;
    const stops = S.stops.map(([p, c]) => [p * 0.999, c]);
    ctx.fillStyle = lin(ctx, 0, top - r * 0.1, 0, hz, stops);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (detail > 0 && !o.lite) {
      // nubes reflejadas (manchas suaves)
      // nubes reflejadas: siluetas de nube de verdad (lóbulos + base), espejadas y estiradas por el vidrio
      for (let k = 0; k < 3; k++) {
        const nx = cx + (hash(k, 11) - 0.5) * r * 1.3 + Math.sin(t * 0.3 + k) * r * 0.04;
        const ny = cy - r * (0.12 + 0.45 * hash(k, 12));
        const cw = r * (0.28 + 0.2 * hash(k, 13));
        const cl = new Path2D();
        for (const [ox, oy, rr] of [[-0.55, 0, 0.32], [-0.15, -0.22, 0.42], [0.3, -0.12, 0.36], [0.62, 0.02, 0.24]]) {
          cl.moveTo(nx + ox * cw + rr * cw, ny + oy * cw); cl.arc(nx + ox * cw, ny + oy * cw, rr * cw, 0, TAU);
        }
        cl.rect(nx - cw * 0.85, ny - cw * 0.05, cw * 1.7, cw * 0.18);
        ctx.save();
        ctx.translate(nx, ny); ctx.scale(1.35, 0.7); ctx.translate(-nx, -ny);
        ctx.fillStyle = ca(S.cloud.shadow, 0.35);
        ctx.save(); ctx.translate(0, cw * 0.08); ctx.fill(cl); ctx.restore();
        ctx.fillStyle = ca(S.cloud.base, 0.6);
        ctx.fill(cl);
        ctx.restore();
      }
    }
    // mar reflejado debajo de un horizonte curvo
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.1, hz + r * 0.06);
    ctx.quadraticCurveTo(cx, hz - r * 0.1, cx + r * 1.1, hz + r * 0.06);
    ctx.lineTo(cx + r * 1.1, cy + r * 1.1);
    ctx.lineTo(cx - r * 1.1, cy + r * 1.1);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, hz, 0, cy + r, [[0, SEA.far], [0.35, SEA.mid], [1, SEA.near]]);
    ctx.fill();
    ctx.strokeStyle = ca(SEA.horizonLine, 0.7);
    ctx.lineWidth = Math.max(mw, r * 0.012);
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.1, hz + r * 0.06);
    ctx.quadraticCurveTo(cx, hz - r * 0.1, cx + r * 1.1, hz + r * 0.06);
    ctx.stroke();
    ctx.restore();
  }
  if (o.lit) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rad(ctx, cx, cy + r * 0.2, r * 1.1, [[0, ca('#FFE9B8', 0.85 * o.lit)], [0.6, ca('#FFB938', 0.45 * o.lit)], [1, ca('#FF6B4A', 0.15 * o.lit)]]);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  // espesor del vidrio: borde levemente aqua y sombra interior del aro del lado de la luz
  ctx.fillStyle = rad(ctx, cx, cy, r * 0.7, cx, cy, r, [[0, ca('#A9EBF6', 0)], [1, ca('#A9EBF6', 0.22)]]);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = rad(ctx, cx - lx * r * 0.22, cy - ly * r * 0.22, r * 0.86, cx - lx * r * 0.22, cy - ly * r * 0.22, r * 1.18, [[0, 'rgba(4,16,31,0)'], [1, 'rgba(4,16,31,0.55)']]);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // brillos diagonales (banda ancha + banda fina), con barrido opcional
  const sw = o.sweep ?? 0;
  ctx.globalCompositeOperation = 'screen';
  const off = -r * 0.25 + sw * r * 2.2;
  diagBand(ctx, cx, cy, r, off, r * 0.5, 0.26);
  diagBand(ctx, cx, cy, r, off + r * 0.36, r * 0.07, 0.7);
  diagBand(ctx, cx, cy, r, off - r * 0.9, r * 0.05, 0.28);
  ctx.globalCompositeOperation = 'source-over';
  // reflejo en arco del lado de la luz (vidrio abombado)
  if (detail > 0) {
    ctx.strokeStyle = ca('#ffffff', 0.5);
    ctx.lineWidth = r * 0.035;
    ctx.lineCap = 'round';
    const a0 = Math.atan2(ly, lx);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, a0 - 0.55, a0 + 0.2); ctx.stroke();
  }
  // gotitas
  if (detail > 1 && o.drops !== false) drops(ctx, t, cx, cy, r, lx, ly);
  // destello que late sobre el brillo
  const tw = 0.5 + 0.5 * Math.sin(t * 2.4);
  if (detail > 0 && !o.lite) {
    const d = off + r * 0.36;
    sparkle(ctx, cx + d * 0.707 + r * 0.42, cy + d * 0.707 - r * 0.42, r * (0.055 + 0.035 * tw), { alpha: 0.85, rot: 0.2 });
  }
  ctx.restore();
}

function diagBand(ctx, cx, cy, r, off, w, a) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = lin(ctx, off - w / 2, 0, off + w / 2, 0, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(off - w / 2, -r * 1.5, w, r * 3);
  ctx.restore();
}

function drops(ctx, t, cx, cy, r, lx, ly) {
  // cada gota es un PAR brillo + sombra (lente de agua sobre el vidrio): medialuna oscura del lado de la luz,
  // medialuna clara del lado opuesto (la luz que la gota concentra) y un punto especular. Sin disco gris.
  const a0 = Math.atan2(ly, lx);
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const a = hash(k, 31) * TAU, d = Math.sqrt(hash(k, 32)) * r * 0.8;
    const slide = k === 2 ? ((t * 0.08) % 0.4) * r : 0;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d + slide;
    const s = r * (0.022 + 0.03 * hash(k, 33));
    // estela de la gota que resbala
    if (k === 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x - s * 0.35, y - slide - s, s * 0.7, slide + s);
    }
    ctx.fillStyle = 'rgba(221,248,252,0.16)';
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.95, s * 1.05, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = s * 0.34;
    ctx.strokeStyle = 'rgba(4,16,31,0.38)';
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.82, s * 0.92, 0, a0 - 1.0, a0 + 1.0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.78, s * 0.88, 0, a0 + Math.PI - 0.9, a0 + Math.PI + 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x + lx * s * 0.35, y + ly * s * 0.4, s * 0.22, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
