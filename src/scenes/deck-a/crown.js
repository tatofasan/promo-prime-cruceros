// SPLASH cenital de corona (pileta). Vista desde arriba, función pura de t:
//   impacto: destello local de 2 cuadros + aplastamiento (nace como un domo blanco ancho y bajo que se estira)
//   corona: lámina de agua en anillo irregular (3 tonos: cuerpo blanco, cara en sombra aqua y filo de sol, vetas
//           de lámina) con dedos que se estiran hacia afuera y sueltan gotas; sube (crece, se engorda y se aclara)
//           y cae (se afina, se abre y se rompe en espuma)
//   gotas en parábola (al azar, no en anillo) con sombra en el agua, rocío fino, chorro central de rebote
//   superficie: cráter revuelto, sombra de la corona, 2–3 anillos que se expanden y un anillo de espuma de encaje
//   que queda flotando con islas sueltas
// La usan el tobogán (grande, alargada en la dirección de la caída) y la zambullida del flotador (chica).
import { TAU, clamp } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { project, onPlane } from './util.js';
import { SUN, WATER_H, inPool, shadowOff } from './pool-geo.js';

const G = 2600;

/** size = radio mayor de la lámina (mundo) · asp = radio menor / mayor · dir = eje mayor (rad). */
function opts(o) {
  return { size: 120, asp: 0.62, dir: 0, seed: 3, drops: 34, fingers: 22, rings: 3, column: 1, ...o };
}

/** Radio de la lámina (fracción de size), alto (0..1) y aspecto en tau (s desde el impacto). */
function crownAt(tau, O) {
  const T = Math.max(0, tau);
  const spread = 0.34 + 0.6 * (1 - Math.exp(-T / 0.018)) + 0.2 * clamp(T / 0.4);
  const H = tau < 0.16 ? Math.sin(Math.PI * clamp(T / 0.16)) : 0;
  // aplastamiento: nace más achatada y rebota hacia su aspecto
  const asp = O.asp * (1 - 0.26 * Math.exp(-T / 0.025) * Math.cos(T * 55));
  return { spread, H, asp };
}

/** Ruido angular suave y determinista (multiplicador alrededor de 1). */
const wob = (th, sd, amp) => 1 + amp * (0.55 * Math.sin(3 * th + hash(sd, 1) * TAU) + 0.3 * Math.sin(7 * th + hash(sd, 2) * TAU) + 0.15 * Math.sin(13 * th + hash(sd, 3) * TAU));
/** Contorno polar (elipse deformada) como Path2D; rFn(th) en unidades del sistema actual. */
function polar(rFn, asp, n = 72, into = null, rev = false) {
  const p = into || new Path2D();
  for (let i = 0; i <= n; i++) {
    const th = ((rev ? n - i : i) / n) * TAU;
    const r = rFn(th);
    const x = Math.cos(th) * r, y = Math.sin(th) * r * asp;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

// ------------------------------------------------------------------ superficie (dentro del agua)
export function crownSurface(ctx, C, t, o) {
  const O = opts(o);
  const tau = t - O.t0;
  if (tau < -0.04 || tau > 1.9) return;
  const { x, y, size: S, dir, seed } = O;
  onPlane(ctx, C, WATER_H, (c) => {
    c.save();
    c.translate(x, y);
    c.rotate(dir);
    if (tau < 0) {
      // sombra de lo que cae, que se achica y se oscurece al llegar
      const q = clamp((tau + 0.04) / 0.04);
      c.fillStyle = `rgba(12,40,80,${0.32 * q})`;
      c.beginPath(); c.ellipse(0, 0, S * 0.32 * (1.4 - 0.4 * q), S * 0.16 * (1.4 - 0.4 * q), 0, 0, TAU); c.fill();
      c.restore();
      return;
    }
    const { spread, H, asp } = crownAt(tau, O);
    const R = S * spread;
    const ls = Math.atan2(SUN[1], SUN[0]) - dir;
    // anillos que viajan (líneas continuas: brillo + sombra debajo); se vuelven redondos al alejarse
    for (let k = 0; k < O.rings; k++) {
      const q = tau - 0.02 - k * 0.1;
      if (q <= 0) continue;
      const r = R + S * (2.7 - k * 0.5) * (1 - Math.exp(-q / 0.6));
      const a = clamp(1.5 - q) * (1 - k * 0.22) * clamp(q / 0.05);
      if (a < 0.02) continue;
      const ry = r * (asp + (1 - asp) * clamp((r - R) / (S * 2.2)));
      c.lineWidth = S * (0.05 - k * 0.01);
      c.strokeStyle = `rgba(8,70,120,${0.26 * a})`;
      c.beginPath(); c.ellipse(-SUN[0] * 4, -SUN[1] * 4 + 3, r, ry, 0, 0, TAU); c.stroke();
      c.lineWidth = S * (0.024 - k * 0.005) + 0.8;
      c.strokeStyle = `rgba(240,253,255,${0.85 * a})`;
      c.beginPath(); c.ellipse(0, 0, r, ry, 0, 0, TAU); c.stroke();
    }
    // sombra de la corona sobre el agua (del lado contrario al sol)
    if (H > 0.02) {
      const off = S * (0.08 + 0.2 * H);
      c.save();
      c.translate(-SUN[0] * off, -SUN[1] * off);
      c.fillStyle = `rgba(6,40,78,${0.3 * H})`;
      const p = polar((th) => R * 1.06 * wob(th, seed + 1, 0.07), asp);
      polar((th) => R * 0.7 * wob(th, seed + 2, 0.1), asp, 72, p, true);
      c.fill(p);
      c.restore();
    }
    // cráter revuelto adentro de la corona
    const cr = clamp(1 - tau / 0.4);
    if (cr > 0) {
      c.save();
      c.scale(1, asp);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
      g.addColorStop(0, `rgba(225,250,255,${0.85 * cr})`);
      g.addColorStop(0.5, `rgba(110,210,238,${0.7 * cr})`);
      g.addColorStop(1, `rgba(30,130,190,${0.5 * cr})`);
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, R * 0.9, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = `rgba(255,255,255,${0.75 * cr})`;
      c.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a0 = hash(i, seed, 40) * TAU + tau * (3 + 3 * hash(i, seed, 44)), rr = R * (0.15 + 0.6 * hash(i, seed, 41));
        c.lineWidth = S * (0.02 + 0.03 * hash(i, seed, 42));
        c.beginPath(); c.ellipse(0, 0, rr, rr * asp, 0, a0, a0 + 0.6 + hash(i, seed, 43) * 1.4); c.stroke();
      }
    }
    // espuma que queda flotando: anillo de encaje (bordes irregulares, ojos que se abren) + islas sueltas
    const fa = clamp((tau - 0.09) / 0.1) * clamp((1.9 - tau) / 1.0);
    if (fa > 0.01) {
      const grow = 1 + 0.4 * clamp((tau - 0.2) / 1.4);
      const Ro = R * 1.04 * grow, Ri = R * (0.55 + 0.25 * clamp((tau - 0.2) / 1.2)) * grow;
      const band = polar((th) => Ro * wob(th, seed + 3, 0.09), asp);
      polar((th) => Ri * wob(th, seed + 4, 0.16), asp, 72, band, true);
      c.fillStyle = `rgba(246,253,255,${0.88 * fa})`;
      c.fill(band);
      // ojos del encaje, dentro del anillo y al azar (no alineados)
      const hole = 0.3 + 0.9 * clamp((tau - 0.18) / 1.0);
      c.fillStyle = `rgba(58,182,222,${0.92 * fa})`;
      for (let i = 0; i < 26; i++) {
        const an = hash(i, seed, 12) * TAU;
        const rr = Ri + (Ro - Ri) * (0.15 + 0.7 * hash(i, seed, 13));
        const hr = S * (0.018 + 0.05 * hash(i, seed, 14) * hash(i, seed, 19)) * hole;
        c.beginPath(); c.ellipse(Math.cos(an) * rr, Math.sin(an) * rr * asp, hr * (1 + 1.2 * hash(i, seed, 18)), hr, an + 1.4, 0, TAU); c.fill();
      }
      // sombra interna y filo del anillo de espuma (volumen)
      c.lineWidth = S * 0.03;
      c.strokeStyle = `rgba(90,170,210,${0.5 * fa})`;
      c.beginPath(); c.ellipse(0, 0, Ri * 1.02, Ri * asp * 1.02, 0, ls - 1.2, ls + 1.2); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.9 * fa})`;
      c.beginPath(); c.ellipse(0, 0, Ro * 0.98, Ro * asp * 0.98, 0, ls - 1.0, ls + 1.0); c.stroke();
      // islas de espuma que se alejan
      c.fillStyle = `rgba(246,253,255,${0.8 * fa})`;
      for (let i = 0; i < 9; i++) {
        const an = hash(i, seed, 20) * TAU;
        const rr = Ro * (1.08 + 0.35 * hash(i, seed, 21)) + S * 0.25 * clamp(tau - 0.2);
        const br = S * (0.03 + 0.05 * hash(i, seed, 22));
        c.beginPath(); c.ellipse(Math.cos(an) * rr, Math.sin(an) * rr * asp, br * 1.5, br, an, 0, TAU); c.fill();
      }
    }
    c.restore();
    // gotas: sombras sobre el agua y anillitos donde caen
    for (let i = 0; i < O.drops; i++) {
      const d = dropAt(O, i, tau);
      if (!d) continue;
      if (!d.landed) {
        const [ox, oy] = shadowOff(d.h, WATER_H);
        if (!inPool(d.x + ox, d.y + oy)) continue;
        c.fillStyle = 'rgba(12,44,84,0.22)';
        c.beginPath(); c.arc(d.x + ox, d.y + oy, d.r * 0.9, 0, TAU); c.fill();
      } else if (tau - d.tl < 0.4 && inPool(d.x, d.y)) {
        const q = (tau - d.tl) / 0.4;
        c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - q)})`;
        c.lineWidth = 1.4;
        c.beginPath(); c.arc(d.x, d.y, d.r * 0.8 + q * S * 0.22, 0, TAU); c.stroke();
      }
    }
  });
}

// gotas que suelta la corona (ángulo y radio al azar: nada de anillos de puntos)
function dropAt(O, i, tau) {
  const sd = O.seed;
  const th = hash(i, sd, 2) * TAU;
  const t0 = 0.04 + 0.1 * hash(i, sd, 3);
  const q = tau - t0;
  if (q < 0) return null;
  const { asp } = crownAt(t0, O);
  const lip = O.size * (0.75 + 0.4 * hash(i, sd, 4));
  const v = O.size * (1.6 + 3.4 * hash(i, sd, 5) * hash(i, sd, 9)) * (0.7 + 0.5 * Math.abs(Math.cos(th)));
  const vz = 300 + 480 * hash(i, sd, 6);
  const h0 = 40 + 60 * hash(i, sd, 7);
  const tl = (vz + Math.sqrt(vz * vz + 2 * G * h0)) / G;
  const tt = Math.min(q, tl);
  const ex = Math.cos(th), ey = Math.sin(th) * asp;
  const ca = Math.cos(O.dir), sa = Math.sin(O.dir);
  const lx = ex * (lip + v * tt), ly = ey * (lip + v * tt);
  return {
    x: O.x + lx * ca - ly * sa, y: O.y + lx * sa + ly * ca, h: Math.max(0, h0 + vz * tt - 0.5 * G * tt * tt),
    r: O.size * (0.02 + 0.032 * hash(i, sd, 8)), landed: q >= tl, tl: t0 + tl,
  };
}

// ------------------------------------------------------------------ lo que vuela (encima de todo lo bajo)
export function crownAir(ctx, C, t, o) {
  const O = opts(o);
  const tau = t - O.t0;
  if (tau < 0 || tau > 1.0) return;
  const { x, y, size: S, dir, seed } = O;
  const { spread, H, asp } = crownAt(tau, O);
  const R = S * spread;
  const Ls = [SUN[0] * Math.cos(C.r) - SUN[1] * Math.sin(C.r), SUN[0] * Math.sin(C.r) + SUN[1] * Math.cos(C.r)];
  const la = Math.atan2(Ls[1], Ls[0]);
  const rot = dir + C.r;
  const ls = la - rot;
  // destello local del impacto (2 cuadros)
  if (tau < 0.034) {
    const [px, py, k] = project(C, x, y, 20);
    const a = 1 - tau / 0.034;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, S * 1.5 * k);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
    g.addColorStop(0.35, `rgba(200,250,255,${0.5 * a})`);
    g.addColorStop(1, 'rgba(200,250,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - S * 1.5 * k, py - S * 1.5 * k, S * 3 * k, S * 3 * k);
    ctx.restore();
  }
  // corona: sube hacia la cámara (crece por perspectiva y se engorda) y cae (se afina y se abre)
  const life = clamp((0.21 - tau) / 0.07);
  if (life > 0.01) {
    const [cx, cy, k] = project(C, x, y, S * 1.0 * H);
    const kk = k * (1 + 0.12 * H);
    const Rk = R * kk;
    const wall = 0.16 + 0.32 * H * (0.6 + 0.4 * life);
    const ro = (th) => Rk * wob(th, seed + 5, 0.05);
    const ri = (th) => Rk * (1 - wall * wob(th, seed + 6, 0.35));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const band = polar(ro, asp);
    polar(ri, asp, 72, band, true);
    // cuerpo blanco
    ctx.fillStyle = `rgba(247,253,255,${life})`;
    ctx.fill(band);
    ctx.save();
    ctx.clip(band);
    // cara interna en sombra del lado del sol (mira hacia afuera de la luz) y vetas de la lámina
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(108,192,226,${0.9 * life})`;
    ctx.lineWidth = Rk * wall * 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const th = ls - 1.6 + (i / 36) * 3.2;
      const r = ri(th);
      const px = Math.cos(th) * r, py = Math.sin(th) * r * asp;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(150,214,236,${0.55 * life})`;
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const th = hash(i, seed, 70) * TAU;
      const r0 = ri(th) * 1.02, r1 = r0 + (ro(th) - r0) * (0.5 + 0.45 * hash(i, seed, 71));
      ctx.lineWidth = S * kk * (0.008 + 0.012 * hash(i, seed, 72));
      ctx.beginPath(); ctx.moveTo(Math.cos(th) * r0, Math.sin(th) * r0 * asp); ctx.lineTo(Math.cos(th) * r1, Math.sin(th) * r1 * asp); ctx.stroke();
    }
    ctx.restore();
    // filo de sol (afuera, del lado de la luz) y sombra propia (afuera, del lado contrario)
    ctx.lineCap = 'round';
    const arcOut = (a0, a1, col, w) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const th = a0 + ((a1 - a0) * i) / 24, r = ro(th) * 0.995;
        const px = Math.cos(th) * r, py = Math.sin(th) * r * asp;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    };
    arcOut(ls + Math.PI - 1.1, ls + Math.PI + 1.1, `rgba(96,178,214,${0.8 * life})`, Math.max(1.5, S * kk * 0.035));
    arcOut(ls - 1.2, ls + 1.2, `rgba(255,255,255,${life})`, Math.max(1.5, S * kk * 0.03));
    // dedos que se estiran hacia afuera con su gota en la punta (largos al azar, sueltan la gota al caer)
    const fl = S * (0.06 + 0.26 * Math.sin(Math.PI * clamp(tau / 0.17))) * kk;
    for (let i = 0; i < O.fingers; i++) {
      const th = ((i + (hash(i, seed, 2) - 0.5) * 0.8) / O.fingers) * TAU;
      const len = fl * (0.35 + 0.95 * hash(i, seed, 9)) * (0.75 + 0.45 * Math.abs(Math.cos(th)));
      if (len < 1) continue;
      const r0 = ro(th) * 0.97;
      const ex = Math.cos(th), ey = Math.sin(th) * asp, en = Math.hypot(ex, ey);
      const ux = ex / en, uy = ey / en;
      const bx0 = ex * r0, by0 = ey * r0;
      const bend = (hash(i, seed, 11) - 0.5) * 0.5;
      const tx = bx0 + (ux - uy * bend) * len, ty = by0 + (uy + ux * bend) * len;
      const w = S * kk * (0.022 + 0.03 * hash(i, seed, 10)) * (0.6 + 0.6 * H);
      const nx = -uy * w, ny = ux * w;
      const lit = Math.cos(th - ls);
      ctx.fillStyle = lit > 0 ? `rgba(255,255,255,${life})` : `rgba(206,238,250,${life})`;
      ctx.beginPath();
      ctx.moveTo(bx0 + nx, by0 + ny);
      ctx.quadraticCurveTo(bx0 + ux * len * 0.55 + nx * 0.3, by0 + uy * len * 0.55 + ny * 0.3, tx, ty);
      ctx.quadraticCurveTo(bx0 + ux * len * 0.55 - nx * 0.3, by0 + uy * len * 0.55 - ny * 0.3, bx0 - nx, by0 - ny);
      ctx.fill();
      if (tau < 0.06 + 0.06 * hash(i, seed, 3)) {
        const dr = w * 0.95;
        ctx.fillStyle = `rgba(118,198,230,${life})`;
        ctx.beginPath(); ctx.arc(tx - Math.cos(ls) * dr * 0.3, ty - Math.sin(ls) * dr * 0.3, dr, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(252,255,255,${life})`;
        ctx.beginPath(); ctx.arc(tx + Math.cos(ls) * dr * 0.15, ty + Math.sin(ls) * dr * 0.15, dr * 0.78, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  // domo del impacto (aplastado y ancho al llegar; se hunde en el cráter)
  const md = clamp(1 - tau / 0.13);
  if (md > 0.01) {
    const [cx, cy, k] = project(C, x, y, S * 0.4 * md);
    const rr = S * k * (0.42 + 0.3 * (1 - md)) * (0.6 + 0.4 * md);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const dome = polar((th) => rr * wob(th, seed + 8, 0.22), asp * (0.85 + 0.3 * (1 - md)));
    ctx.fillStyle = `rgba(136,210,236,${md})`;
    ctx.save(); ctx.translate(-Math.cos(ls) * rr * 0.12, -Math.sin(ls) * rr * 0.12); ctx.fill(dome); ctx.restore();
    ctx.fillStyle = `rgba(250,254,255,${md})`;
    ctx.save(); ctx.translate(Math.cos(ls) * rr * 0.05, Math.sin(ls) * rr * 0.05); ctx.scale(0.88, 0.88); ctx.fill(dome); ctx.restore();
    ctx.restore();
  }
  // rocío fino del impacto (disco al azar, se apaga rápido)
  if (tau < 0.14) {
    const a = 1 - tau / 0.14;
    const [cx, cy, k] = project(C, x, y, 30);
    const ca = Math.cos(rot), sa = Math.sin(rot);
    ctx.fillStyle = `rgba(240,252,255,${0.7 * a})`;
    for (let i = 0; i < 26; i++) {
      const th = hash(i, seed, 30) * TAU, rr = S * k * 1.05 * Math.sqrt(hash(i, seed, 31)) * (0.55 + 0.5 * clamp(tau / 0.08));
      const px = Math.cos(th) * rr, py = Math.sin(th) * rr * asp;
      const s = S * k * (0.006 + 0.02 * hash(i, seed, 32) * hash(i, seed, 33));
      ctx.beginPath(); ctx.arc(cx + px * ca - py * sa, cy + px * sa + py * ca, s, 0, TAU); ctx.fill();
    }
  }
  // chorro central de rebote: racimo de gotas gordas que sube hacia la cámara y se desarma
  const q = clamp((tau - 0.12) / 0.32);
  if (O.column && q > 0 && q < 1) {
    const hc = Math.sin(Math.PI * q) * S * 2.0;
    const [cx, cy, ck] = project(C, x, y, hc);
    const grow = ck * (1 + hc / (S * 5));
    const spreadC = 1 + q * 1.8;
    for (let i = 0; i < 9; i++) {
      const an = hash(i, seed, 51) * TAU, rr = (i ? 0.04 + 0.08 * hash(i, seed, 52) : 0) * S * spreadC * grow;
      const br = (i ? 0.04 + 0.04 * hash(i, seed, 53) : 0.09) * S * grow * (1 - 0.45 * q);
      const px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr;
      ctx.fillStyle = 'rgba(130,208,234,0.95)';
      ctx.beginPath(); ctx.arc(px - Ls[0] * br * 0.3, py - Ls[1] * br * 0.3, br, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(px + Ls[0] * br * 0.12, py + Ls[1] * br * 0.12, br * 0.82, 0, TAU); ctx.fill();
    }
  }
  // gotas en parábola (estiradas según cómo se mueven en pantalla)
  const lateFade = clamp((0.95 - tau) / 0.3);
  for (let i = 0; i < O.drops; i++) {
    const d = dropAt(O, i, tau);
    if (!d || d.landed) continue;
    const d2 = dropAt(O, i, tau + 0.01);
    const [px, py, k] = project(C, d.x, d.y, d.h);
    const [qx, qy] = d2 ? project(C, d2.x, d2.y, d2.h) : [px, py];
    const r = d.r * k * (1 + d.h / 500);
    const vx = qx - px, vy = qy - py, vl = Math.hypot(vx, vy) || 1;
    const st = Math.min(3, 1 + vl / (r * 1.8));
    const an = Math.atan2(vy, vx);
    ctx.globalAlpha = lateFade;
    ctx.fillStyle = 'rgba(126,204,232,0.96)';
    ctx.beginPath(); ctx.ellipse(px - Ls[0] * r * 0.25, py - Ls[1] * r * 0.25, r * st, r, an, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(px + Ls[0] * r * 0.1, py + Ls[1] * r * 0.1, r * st * 0.84, r * 0.76, an, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // brillos en el pico de la corona
  const fl = Math.exp(-Math.pow((tau - 0.08) / 0.05, 2));
  if (fl > 0.04) {
    for (let i = 0; i < 5; i++) {
      const th = ls + (hash(i, seed, 61) - 0.5) * 2.2;
      const ca = Math.cos(dir), sa = Math.sin(dir);
      const lx = Math.cos(th) * R, ly = Math.sin(th) * R * asp;
      const [px, py, k] = project(C, x + lx * ca - ly * sa, y + lx * sa + ly * ca, S * 0.9);
      sparkle(ctx, px, py, S * (0.12 + 0.12 * hash(i, seed, 62)) * k * fl, { alpha: fl, rot: th });
    }
  }
}

/** Manchas mojadas en la cubierta donde cayeron gotas (después de la cubierta horneada). */
export function crownWet(ctx, C, t, o) {
  const O = opts(o);
  const tau = t - O.t0;
  if (tau < 0.1) return;
  onPlane(ctx, C, 0, (c) => {
    for (let i = 0; i < O.drops; i++) {
      const d = dropAt(O, i, tau);
      if (!d || !d.landed || inPool(d.x, d.y, 4)) continue;
      const a = clamp((tau - d.tl) / 0.05);
      c.fillStyle = `rgba(70,40,20,${0.28 * a})`;
      c.beginPath(); c.ellipse(d.x, d.y, d.r * 2.2, d.r * 1.7, i, 0, TAU); c.fill();
    }
  });
}
