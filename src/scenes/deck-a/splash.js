// SPLASH cenital cuando quien baja cae al agua (impacto en exp.slide − 1/120):
//   destello + cráter, corona de láminas con gotas en las puntas (sube hacia la cámara: crece y se abre),
//   columna de rebote, gotas en parábola con su sombra en el agua, espuma de encaje que se rompe en burbujas,
//   anillos que viajan por toda la pileta (llegan al flotador en exp.ring) y manchas mojadas en la piedra.
// Después asoma la cabeza (corchea siguiente) y saluda.
import { PAL } from '../../engine/color.js';
import { TAU, clamp, E } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { project, onPlane, wobble } from './util.js';
import { WATER_H, SUN, shadowOff, inPool, POOL } from './pool-geo.js';
import { TI, SPLASH_PT } from './pool-path.js';
import { drawFigure } from './figure.js';
import { SKIN, HAIR } from './pool-pal.js';

const G = 2400;
const ND = 54;
const DROPS = [];
for (let i = 0; i < ND; i++) {
  const a = (i / ND) * TAU + (hash(i, 1) - 0.5) * 0.5;
  // sesgo hacia adelante (venía hacia el oeste) y un poco hacia los lados
  const fwd = Math.cos(a - Math.PI) * 0.35 + 1;
  DROPS.push({ a, v: (260 + 520 * hash(i, 2)) * fwd, vz: 480 + 560 * hash(i, 3), r: 3 + 5 * hash(i, 4) });
}
export const RING_V = 640;

function dropAt(d, tau) {
  const tl = (d.vz + Math.sqrt(d.vz * d.vz + 2 * G * 0)) / G;
  const tt = Math.min(tau, tl);
  const dist = d.v * tt * (1 - 0.25 * tt);
  return { x: SPLASH_PT.x + Math.cos(d.a) * dist, y: SPLASH_PT.y + Math.sin(d.a) * dist, h: Math.max(0, d.vz * tt - 0.5 * G * tt * tt), landed: tau >= tl, tl };
}

/** Lo que va EN la superficie (dentro del recorte de la pileta): cráter, espuma, anillos, sombras de gotas. */
export function splashSurface(ctx, C, t) {
  const tau = t - TI;
  if (tau < -0.03) return;
  onPlane(ctx, C, WATER_H, (c) => {
    const { x, y } = SPLASH_PT;
    // anillos que viajan
    for (let k = 0; k < 4; k++) {
      const q = tau - k * 0.11;
      if (q <= 0) continue;
      const r = RING_V * q * (1 - 0.08 * q);
      const a = Math.min(1, 0.9 / Math.sqrt(1 + r / 90)) * (1 - k * 0.18) * clamp(2.2 - q);
      if (a < 0.02) continue;
      c.lineWidth = 7 - k;
      c.strokeStyle = `rgba(10,90,140,${0.25 * a})`;
      c.beginPath(); c.arc(x - 3, y + 3, r - 5, 0, TAU); c.stroke();
      c.lineWidth = 3.4 - k * 0.5;
      c.strokeStyle = `rgba(240,253,255,${0.75 * a})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    }
    if (tau < 0) {
      // sombra de quien llega, que se achica al caer
      c.fillStyle = `rgba(16,44,82,${0.3 * clamp((tau + 0.03) / 0.03)})`;
      c.beginPath(); c.ellipse(x, y, 40, 18, 0.2, 0, TAU); c.fill();
      return;
    }
    // cráter (agua hundida) al principio
    const cr = clamp(1 - tau / 0.3);
    if (cr > 0) {
      c.fillStyle = `rgba(14,96,150,${0.55 * cr})`;
      c.beginPath(); c.ellipse(x, y, 30 + 40 * E.outCubic(clamp(tau / 0.15)), 26 + 30 * E.outCubic(clamp(tau / 0.15)), 0, 0, TAU); c.fill();
    }
    // espuma de encaje
    const fa = clamp(tau / 0.06) * clamp((1.5 - tau) / 1.1);
    if (fa > 0.01) {
      const R = 36 + 66 * (1 - Math.exp(-3.4 * tau));
      const p = new Path2D();
      for (let i = 0; i < 16; i++) {
        const an = (i / 16) * TAU + hash(i, 9) * 0.4;
        const rr = R * (0.45 + 0.55 * hash(i, 10));
        const br = R * (0.22 + 0.2 * hash(i, 11)) * (1 - 0.35 * clamp(tau - 0.6));
        const bx = x + Math.cos(an) * rr * 0.75, by = y + Math.sin(an) * rr * 0.75;
        p.moveTo(bx + br, by); p.arc(bx, by, br, 0, TAU);
      }
      c.fillStyle = `rgba(250,254,255,${0.92 * fa})`;
      c.fill(p);
      // agujeros del encaje (se abren con el tiempo)
      c.fillStyle = `rgba(60,190,225,${0.85 * fa})`;
      const hole = 0.35 + 0.9 * clamp(tau / 0.9);
      for (let i = 0; i < 26; i++) {
        const an = hash(i, 12) * TAU, rr = R * Math.sqrt(hash(i, 13)) * 0.9;
        const hr = (3 + 9 * hash(i, 14)) * hole;
        c.beginPath(); c.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr, hr, 0, TAU); c.fill();
      }
      // burbujas en el borde
      c.strokeStyle = `rgba(255,255,255,${0.8 * fa})`;
      c.lineWidth = 1.4;
      for (let i = 0; i < 22; i++) {
        const an = hash(i, 15) * TAU, rr = R * (0.95 + 0.4 * hash(i, 16));
        c.beginPath(); c.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr, 2 + 3 * hash(i, 17), 0, TAU); c.stroke();
      }
    }
    // sombras de las gotas en el agua (venden la altura)
    for (const d of DROPS) {
      const q = dropAt(d, tau);
      if (q.landed) continue;
      const [ox, oy] = shadowOff(q.h, WATER_H);
      if (!inPool(q.x + ox, q.y + oy)) continue;
      c.fillStyle = 'rgba(16,44,82,0.22)';
      c.beginPath(); c.arc(q.x + ox, q.y + oy, d.r * 0.9, 0, TAU); c.fill();
    }
    // salpicaduras chicas donde caen gotas al agua
    for (const d of DROPS) {
      const q = dropAt(d, tau);
      const dt = tau - q.tl;
      if (!q.landed || dt > 0.45 || !inPool(q.x, q.y)) continue;
      c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - dt / 0.45)})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(q.x, q.y, 3 + dt * 40, 0, TAU); c.stroke();
    }
  });
}

/** Manchas mojadas en la cubierta/piedra donde cayeron gotas (después del borrador de la cubierta). */
export function splashWet(ctx, C, t) {
  const tau = t - TI;
  if (tau < 0.1) return;
  onPlane(ctx, C, 0, (c) => {
    for (const d of DROPS) {
      const q = dropAt(d, tau);
      if (!q.landed || inPool(q.x, q.y)) continue;
      const a = clamp((tau - q.tl) / 0.05);
      c.fillStyle = `rgba(70,40,20,${0.28 * a})`;
      c.beginPath(); c.ellipse(q.x, q.y, d.r * 2.2, d.r * 1.8, d.a, 0, TAU); c.fill();
    }
    // la corona moja la piedra del borde
    const a = clamp((tau - 0.15) / 0.1);
    c.fillStyle = `rgba(70,50,30,${0.16 * a})`;
    c.beginPath(); c.ellipse(SPLASH_PT.x - 10, POOL.y1 + 22, 150, 26, 0, 0, TAU); c.fill();
  });
}

/** Lo que vuela por encima del agua: destello, corona, columna, gotas, chispas. */
export function splashAir(ctx, C, t) {
  const tau = t - TI;
  if (tau < 0 || tau > 1.2) return;
  const { x, y } = SPLASH_PT;
  // destello del impacto
  if (tau < 0.1) {
    const [px, py, k] = project(C, x, y, 10);
    const a = 1 - tau / 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, (110 + 420 * tau) * k);
    g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
    g.addColorStop(0.4, `rgba(200,250,255,${0.4 * a})`);
    g.addColorStop(1, 'rgba(200,250,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 600, py - 600, 1200, 1200);
    ctx.restore();
  }
  // corona vista desde arriba: anillo de grumos de espuma (3 tonos) que sube hacia la cámara y se abre, con dedos
  // que se estiran hacia afuera y sueltan gotas; adentro, agua revuelta más oscura
  const up = Math.sin(Math.PI * clamp((tau + 0.03) / 0.46));
  if (up > 0.01) {
    const r0 = 30 + 84 * E.outCubic(clamp((tau + 0.02) / 0.38));
    const fade = clamp((0.44 - tau) / 0.16);
    const [bx, by, bk] = project(C, x, y, 4);
    const [tx, ty, tk] = project(C, x, y, 120 * up);
    const rTop = r0 * tk * (1 + 0.2 * up);
    // agua revuelta adentro
    ctx.fillStyle = `rgba(16,110,160,${0.42 * up * fade})`;
    ctx.beginPath(); ctx.arc(bx, by, rTop * 0.78, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(230,250,255,${0.6 * up * fade})`;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a0 = hash(i, 40) * TAU + tau * 3, rr = rTop * (0.25 + 0.4 * hash(i, 41));
      ctx.lineWidth = (2 + 3 * hash(i, 42)) * bk;
      ctx.beginPath(); ctx.arc(bx, by, rr, a0, a0 + 1 + hash(i, 43) * 1.5); ctx.stroke();
    }
    // dedos (detrás de los grumos)
    const la = Math.atan2(SUN[1], SUN[0]);
    for (let i = 0; i < 14; i++) {
      const an = hash(i, 44) * TAU;
      const r1 = rTop * 0.95, r2 = rTop * (1.15 + 0.25 * hash(i, 45)) * (0.75 + 0.35 * up);
      const w = (6 + 6 * hash(i, 46)) * tk * (0.5 + up * 0.7);
      const c0 = [tx + Math.cos(an) * r1, ty + Math.sin(an) * r1], c1 = [tx + Math.cos(an) * r2, ty + Math.sin(an) * r2];
      const nx = -Math.sin(an) * w, ny = Math.cos(an) * w;
      ctx.fillStyle = `rgba(236,251,255,${fade})`;
      ctx.beginPath();
      ctx.moveTo(c0[0] + nx, c0[1] + ny);
      ctx.quadraticCurveTo((c0[0] + c1[0]) / 2 + nx * 0.3, (c0[1] + c1[1]) / 2 + ny * 0.3, c1[0], c1[1]);
      ctx.quadraticCurveTo((c0[0] + c1[0]) / 2 - nx * 0.3, (c0[1] + c1[1]) / 2 - ny * 0.3, c0[0] - nx, c0[1] - ny);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath(); ctx.arc(c1[0] + Math.cos(an) * w * 0.9, c1[1] + Math.sin(an) * w * 0.9, w * 0.85, 0, TAU); ctx.fill();
    }
    // grumos del anillo: cuerpo blanco, sombra aqua del lado opuesto al sol y brillo
    const n = 26;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        const an = (i / n) * TAU + hash(i, 47) * 0.2;
        const rr = rTop * (0.9 + 0.14 * hash(i, 48));
        const br = rTop * (0.09 + 0.1 * hash(i, 49)) * (0.6 + 0.6 * up);
        const cx = tx + Math.cos(an) * rr, cy = ty + Math.sin(an) * rr;
        if (pass === 0) { ctx.fillStyle = `rgba(120,205,232,${fade})`; ctx.beginPath(); ctx.arc(cx - SUN[0] * br * 0.25, cy - SUN[1] * br * 0.25, br, 0, TAU); ctx.fill(); }
        else if (pass === 1) { ctx.fillStyle = `rgba(250,254,255,${fade})`; ctx.beginPath(); ctx.arc(cx + SUN[0] * br * 0.12, cy + SUN[1] * br * 0.12, br * 0.86, 0, TAU); ctx.fill(); }
        else if (hash(i, 50) > 0.45) { ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.beginPath(); ctx.arc(cx + Math.cos(la) * br * 0.4, cy + Math.sin(la) * br * 0.4, br * 0.28, 0, TAU); ctx.fill(); }
      }
    }
  }
  // rayas de velocidad del impacto (solo los primeros cuadros)
  if (tau < 0.12) {
    const a = 1 - tau / 0.12;
    const [cx, cy, ck] = project(C, x, y, 0);
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * TAU + hash(i, 28) * 0.3;
      const r1 = (90 + 520 * tau) * ck, r2 = r1 + (60 + 80 * hash(i, 29)) * ck * a;
      ctx.lineWidth = (3 + 3 * hash(i, 30)) * a;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); ctx.stroke();
    }
  }
  // columna de rebote: racimo de gotas gordas que sube hacia la cámara (crece) y se desarma
  const q = clamp((tau - 0.12) / 0.36);
  if (q > 0 && q < 1) {
    const hc = Math.sin(Math.PI * q) * 300;
    const [cx, cy, ck] = project(C, x, y, hc);
    const grow = ck * (1 + hc / 380);
    const spread = 1 + q * 1.6;
    for (let i = 0; i < 9; i++) {
      const an = hash(i, 51) * TAU, rr = (i ? 6 + 10 * hash(i, 52) : 0) * spread * grow;
      const br = (i ? 6 + 6 * hash(i, 53) : 13) * grow * (1 - 0.45 * q);
      const bx = cx + Math.cos(an) * rr, by = cy + Math.sin(an) * rr;
      ctx.fillStyle = 'rgba(150,222,242,0.95)';
      ctx.beginPath(); ctx.arc(bx - SUN[0] * br * 0.3, by - SUN[1] * br * 0.3, br, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(bx + SUN[0] * br * 0.12, by + SUN[1] * br * 0.12, br * 0.82, 0, TAU); ctx.fill();
    }
  }
  // gotas en parábola: estiradas en la dirección en que vuelan (pantalla), cuerpo blanco con panza aqua
  const lateFade = clamp((0.75 - tau) / 0.3);
  if (lateFade > 0.01) {
    for (const d of DROPS) {
      const p = dropAt(d, tau);
      if (p.landed) continue;
      const p2 = dropAt(d, tau + 0.012);
      const [px, py, k] = project(C, p.x, p.y, p.h);
      const [qx, qy] = project(C, p2.x, p2.y, p2.h);
      const r = d.r * 0.8 * k * (1 + p.h / 450);
      const vx = qx - px, vy = qy - py, vl = Math.hypot(vx, vy) || 1;
      const st = Math.min(3.2, 1 + vl / (r * 1.6));
      const ang = Math.atan2(vy, vx);
      ctx.globalAlpha = lateFade;
      ctx.fillStyle = 'rgba(150,222,242,0.95)';
      ctx.beginPath(); ctx.ellipse(px - SUN[0] * r * 0.25, py - SUN[1] * r * 0.25, r * st, r, ang, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(px + SUN[0] * r * 0.1, py + SUN[1] * r * 0.1, r * st * 0.85, r * 0.78, ang, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  const fl = Math.exp(-Math.pow((tau - 0.1) / 0.07, 2));
  if (fl > 0.03) {
    for (let i = 0; i < 6; i++) {
      const an = hash(i, 31) * TAU, rr = 60 + 90 * hash(i, 32);
      const [px, py, k] = project(C, x + Math.cos(an) * rr, y + Math.sin(an) * rr, 80);
      sparkle(ctx, px, py, (14 + 16 * hash(i, 33)) * k * fl, { alpha: fl, rot: an });
    }
  }
}

// ------------------------------------------------------------------ quien cayó asoma y saluda
export function drawSwimmer(ctx, C, t, T_SURF) {
  const d = t - T_SURF;
  if (d < -0.02) return;
  const sx = SPLASH_PT.x - 30 - 40 * E.outCubic(clamp(d / 0.8)), sy = SPLASH_PT.y - 18 - 10 * clamp(d / 0.8);
  const pop = d < 0 ? 0 : clamp(1 + 0.25 * wobble(d, { freq: 3, damp: 7 }) - Math.exp(-d / 0.05));
  onPlane(ctx, C, WATER_H, (c) => {
    // estela y anillos alrededor
    for (let k = 0; k < 3; k++) {
      const q = ((d * 0.9 + k / 3) % 1);
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q) * clamp(d / 0.1)})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(sx, sy - 4, 26 + q * 50, 0, TAU); c.stroke();
    }
    if (d < 0.25) {
      c.fillStyle = `rgba(255,255,255,${0.8 * (1 - d / 0.25)})`;
      for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU; c.beginPath(); c.arc(sx + Math.cos(an) * (20 + d * 120), sy + Math.sin(an) * (20 + d * 120), 3.5, 0, TAU); c.fill(); }
    }
    // cuerpo bajo el agua (azulado) + cabeza, hombros y brazo que saluda
    c.save();
    c.translate(sx, sy);
    c.rotate(-0.5);
    c.scale(0.9 * pop, 0.9 * pop);
    const wave = Math.sin(d * 14) * 0.35;
    c.globalAlpha *= 0.45;
    c.fillStyle = 'rgba(30,110,150,0.5)';
    c.beginPath(); c.ellipse(0, 0, 16, 40, 0, 0, TAU); c.fill();
    c.globalAlpha /= 0.45;
    c.save();
    c.beginPath(); c.rect(-80, -140, 160, 96); c.clip();
    drawFigure(c, {
      L: [SUN[0] * Math.cos(0.5) - SUN[1] * Math.sin(0.5), SUN[0] * Math.sin(0.5) + SUN[1] * Math.cos(0.5)],
      skin: SKIN[1], hair: HAIR[1], hairStyle: 'short', kind: 'trunks', suit: PAL.coral, glasses: false, smile: 2,
      pose: { aL: [0.6, 0.8], aR: [2.4 + wave, 0.5], lL: [0, 0], lR: [0, 0] },
    });
    c.restore();
    c.restore();
  });
}
