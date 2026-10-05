// Plato gourmet (vista cenital, coordenadas locales del plato, centro 0,0, hueco r≈130):
// trazo de puré con espátula, cinta de reducción de malbec, lomo en abanico jugoso, espárragos, zanahorias
// glaseadas, puntos de salsa, gotas de oliva, microverdes, flores comestibles, sal en escamas y pimienta.
// Se pinta UNA vez dentro del sprite del plato. L = vector unitario hacia la vela (luz horneada).
import { rng } from '../../engine/noise.js';
import { TAU } from '../../engine/ease.js';
import { bez, ribbonPts, blob, ellipse, circle, tone3, crescent } from './shape.js';

const C = {
  pure: '#F2DEAE', pureDark: '#D2AE6E', pureLight: '#FFF6DA', pureStreak: 'rgba(196,150,80,0.30)',
  red: '#5C0D1F', redDark: '#36060F', redLight: '#B8394F',
  crust: '#4E2212', crustLight: '#8A4524', band: '#A86A55', pink: '#E3716F', pinkDeep: '#C9505A', pinkLight: '#F4A39A',
  asp: '#74A83E', aspDark: '#4B7B26', aspLight: '#B9DE7C',
  car: '#F2862C', carDark: '#C25A14', carLight: '#FFC27A',
  green: '#7CC043', greenDark: '#4E8E2A', greenLight: '#C3EA8C',
};

function puree(c, L) {
  const center = bez([-104, 22], [-66, 104], [48, 104], [108, 26], 34);
  const wfn = (u) => {
    const head = u < 0.13 ? Math.sqrt(Math.max(0, 1 - ((0.13 - u) / 0.13) ** 2)) : 1;
    return 50 * head * (1 - 0.94 * Math.pow(u, 1.35));
  };
  const pts = ribbonPts(center, wfn);
  const mk = blob(pts);
  // sombra de contacto sobre la porcelana
  c.save();
  c.filter = 'blur(5px)';
  c.fillStyle = 'rgba(90,60,30,0.35)';
  c.fill(mk(-L[0] * 6, -L[1] * 6));
  c.filter = 'none';
  c.restore();
  tone3(c, mk, { base: C.pure, dark: C.pureDark, light: C.pureLight, L, dd: 7, dl: 3.5 });
  // vetas de espátula a lo largo del trazo
  c.save();
  c.clip(mk());
  c.lineCap = 'round';
  const r = rng(77);
  for (let k = 0; k < 9; k++) {
    const off = (r() - 0.5) * 0.8;
    const u0 = 0.08 + r() * 0.25, u1 = 0.65 + r() * 0.35;
    c.beginPath();
    for (let i = 0; i < center.length; i++) {
      const u = i / (center.length - 1);
      if (u < u0 || u > u1) continue;
      const [x, y] = center[i];
      const [xa, ya] = center[Math.max(0, i - 1)], [xb, yb] = center[Math.min(center.length - 1, i + 1)];
      const d = Math.hypot(xb - xa, yb - ya) || 1;
      const nx = -(yb - ya) / d, ny = (xb - xa) / d;
      const w = wfn(u) * off;
      if (u - 1 / (center.length - 1) < u0) c.moveTo(x + nx * w, y + ny * w); else c.lineTo(x + nx * w, y + ny * w);
    }
    c.strokeStyle = k % 3 ? C.pureStreak : 'rgba(255,250,230,0.55)';
    c.lineWidth = 1 + r() * 1.6;
    c.stroke();
  }
  c.restore();
  // cerdas sueltas en la cola
  c.strokeStyle = C.pure;
  c.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = center[26 + k], b = center[31];
    c.beginPath();
    c.moveTo(a[0], a[1] + (k - 1.5) * 3);
    c.quadraticCurveTo(b[0] - 6, b[1] + (k - 1.5) * 5, b[0] + 6 + k * 3, b[1] - 4 + (k - 1.5) * 6);
    c.lineWidth = 2.2 - k * 0.3;
    c.stroke();
  }
}

function reduction(c, L) {
  const center = bez([-64, 92], [-28, 116], [34, 112], [68, 88], 26);
  const wfn = (u) => 3 + 13 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.3);
  const mk = blob(ribbonPts(center, wfn));
  tone3(c, mk, { base: C.red, dark: C.redDark, light: C.redLight, L, dd: 3, dl: 2.2 });
  // brillo especular largo (salsa espejada)
  c.save();
  c.clip(mk());
  c.strokeStyle = 'rgba(255,220,210,0.75)';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  c.beginPath();
  center.slice(6, 17).forEach(([x, y], i) => (i ? c.lineTo(x + L[0] * 3, y + L[1] * 3) : c.moveTo(x + L[0] * 3, y + L[1] * 3)));
  c.stroke();
  c.restore();
  // gotas que siguen al trazo
  const drops = [[80, 80, 6], [90, 70, 4.4], [97, 60, 3.1], [102, 51, 2.1]];
  for (const [x, y, r] of drops) {
    tone3(c, circle(x, y, r), { base: C.red, dark: C.redDark, light: C.redLight, L, dd: r * 0.35, dl: r * 0.25 });
    c.fillStyle = 'rgba(255,235,225,0.9)';
    c.beginPath(); c.arc(x + L[0] * r * 0.4, y + L[1] * r * 0.4, r * 0.28, 0, TAU); c.fill();
  }
}

function asparagus(c, L, x0, y0, ang, len) {
  const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
  const tip = [x0 + d[0] * len, y0 + d[1] * len];
  const w = 7;
  const pts = [
    [x0 + n[0] * w, y0 + n[1] * w], [tip[0] - d[0] * 22 + n[0] * w, tip[1] - d[1] * 22 + n[1] * w],
    [tip[0] - d[0] * 8 + n[0] * w * 1.15, tip[1] - d[1] * 8 + n[1] * w * 1.15], [tip[0] + d[0] * 4, tip[1] + d[1] * 4],
    [tip[0] - d[0] * 8 - n[0] * w * 1.15, tip[1] - d[1] * 8 - n[1] * w * 1.15], [tip[0] - d[0] * 22 - n[0] * w, tip[1] - d[1] * 22 - n[1] * w],
    [x0 - n[0] * w, y0 - n[1] * w], [x0 - d[0] * 3, y0 - d[1] * 3],
  ];
  c.save();
  c.shadowColor = 'rgba(60,40,20,0.35)';
  c.shadowBlur = 6;
  c.shadowOffsetX = -L[0] * 4; c.shadowOffsetY = -L[1] * 4;
  c.fillStyle = C.aspDark;
  c.fill(blob(pts)());
  c.restore();
  tone3(c, blob(pts), { base: C.asp, dark: C.aspDark, light: C.aspLight, L, dd: 4, dl: 2 });
  // escamas de la punta y brácteas del tallo
  c.fillStyle = C.aspDark;
  for (let k = 0; k < 5; k++) {
    const s = len - 4 - k * 5, side = k % 2 ? 1 : -1;
    const bx = x0 + d[0] * s + n[0] * side * 3.5, by = y0 + d[1] * s + n[1] * side * 3.5;
    c.beginPath();
    c.moveTo(bx + d[0] * 5, by + d[1] * 5);
    c.lineTo(bx - d[0] * 3 + n[0] * side * 4, by - d[1] * 3 + n[1] * side * 4);
    c.lineTo(bx - d[0] * 4 - n[0] * side * 2, by - d[1] * 4 - n[1] * side * 2);
    c.closePath();
    c.fill();
  }
  for (const s of [len * 0.25, len * 0.5]) {
    const side = s > len * 0.4 ? 1 : -1;
    const bx = x0 + d[0] * s + n[0] * side * 5.5, by = y0 + d[1] * s + n[1] * side * 5.5;
    c.beginPath();
    c.moveTo(bx + d[0] * 7, by + d[1] * 7);
    c.lineTo(bx - d[0] * 4 + n[0] * side * 2.5, by - d[1] * 4 + n[1] * side * 2.5);
    c.lineTo(bx - d[0] * 4 - n[0] * side * 3, by - d[1] * 4 - n[1] * side * 3);
    c.closePath();
    c.fill();
  }
  // corte del extremo (más claro)
  c.fillStyle = '#C9E59A';
  c.beginPath(); c.ellipse(x0, y0, 2.4, w * 0.9, ang, 0, TAU); c.fill();
}

function carrot(c, L, x0, y0, ang, len) {
  const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
  const P = (s, k) => [x0 + d[0] * s + n[0] * k, y0 + d[1] * s + n[1] * k];
  const pts = [P(0, 9), P(len * 0.35, 8.5), P(len * 0.75, 5), P(len, 1.2), P(len + 2, -0.5), P(len * 0.75, -5.5), P(len * 0.35, -8.5), P(0, -9), P(-3, 0)];
  const mk = blob(pts);
  c.save();
  c.shadowColor = 'rgba(70,35,10,0.4)';
  c.shadowBlur = 6;
  c.shadowOffsetX = -L[0] * 4; c.shadowOffsetY = -L[1] * 4;
  c.fillStyle = C.carDark;
  c.fill(mk());
  c.restore();
  tone3(c, mk, { base: C.car, dark: C.carDark, light: C.carLight, L, dd: 4.5, dl: 2.2 });
  // anillos y glaseado
  c.save();
  c.clip(mk());
  c.strokeStyle = 'rgba(150,60,10,0.45)';
  c.lineWidth = 1.1;
  for (const s of [0.16, 0.3, 0.46, 0.6, 0.74, 0.86]) {
    const [cx, cy] = P(len * s, 0);
    c.beginPath();
    c.moveTo(cx + n[0] * 9 + d[0] * 1.5, cy + n[1] * 9 + d[1] * 1.5);
    c.quadraticCurveTo(cx + d[0] * 3, cy + d[1] * 3, cx - n[0] * 5, cy - n[1] * 5);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,248,230,0.85)';
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  const a = P(len * 0.12, 4 * Math.sign(L[0] * n[0] + L[1] * n[1] || 1)), b = P(len * 0.62, 2.5 * Math.sign(L[0] * n[0] + L[1] * n[1] || 1));
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  c.restore();
  // hojitas verdes en la cabeza
  c.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const aa = ang + Math.PI + (k - 1.5) * 0.28;
    const ex = x0 + Math.cos(aa) * (16 + k * 2), ey = y0 + Math.sin(aa) * (16 + k * 2);
    c.strokeStyle = k % 2 ? C.greenDark : C.green;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(x0 - d[0] * 2, y0 - d[1] * 2);
    c.quadraticCurveTo((x0 + ex) / 2 + n[0] * (k - 1.5) * 2, (y0 + ey) / 2 + n[1] * (k - 1.5) * 2, ex, ey);
    c.stroke();
    c.fillStyle = k % 2 ? C.green : C.greenLight;
    c.beginPath(); c.ellipse(ex, ey, 4.2, 2.4, aa, 0, TAU); c.fill();
  }
}

function slice(c, L, x, y, rot, s = 1) {
  const rx = 33 * s, ry = 45 * s;
  const outer = ellipse(x, y, rx, ry, rot);
  // sombra sobre la feta de abajo (se apoyan unas sobre otras)
  c.save();
  c.shadowColor = 'rgba(45,12,6,0.6)';
  c.shadowBlur = 10;
  c.shadowOffsetX = -L[0] * 6; c.shadowOffsetY = -L[1] * 6;
  c.fillStyle = C.crust;
  c.fill(outer());
  c.restore();
  // costra sellada fina con filo tostado
  tone3(c, outer, { base: '#5B2814', dark: '#2F1007', light: '#A45A2C', L, dd: 3, dl: 2.2 });
  // anillo cocido gris rosado
  c.fillStyle = '#A9735F';
  c.fill(ellipse(x, y, rx - 4.2 * s, ry - 4.2 * s, rot)());
  // centro jugoso (jugoso al centro, más pálido hacia el anillo)
  const inner = ellipse(x, y, rx - 7.5 * s, ry - 7.5 * s, rot);
  const g = c.createRadialGradient(x - L[0] * 3, y - L[1] * 3, 1, x, y, ry - 7);
  g.addColorStop(0, '#CC3F55');
  g.addColorStop(0.45, '#D9596A');
  g.addColorStop(0.8, '#E2827F');
  g.addColorStop(1, '#C98B79');
  c.fillStyle = g;
  c.fill(inner());
  // veta de la carne: trazos cortos paralelos
  c.save();
  c.clip(inner());
  c.strokeStyle = 'rgba(140,25,40,0.16)';
  c.lineWidth = 1.1;
  const ga = rot + 0.35, gd = [Math.cos(ga), Math.sin(ga)], gn = [-gd[1], gd[0]];
  for (let k = -6; k <= 6; k++) {
    const ox = x + gn[0] * k * 5.5, oy = y + gn[1] * k * 5.5;
    const sh = (k % 3) * 4;
    c.beginPath();
    c.moveTo(ox - gd[0] * (30 - sh), oy - gd[1] * (30 - sh));
    c.lineTo(ox + gd[0] * (24 + sh), oy + gd[1] * (24 + sh));
    c.stroke();
  }
  c.restore();
  // brillo de jugo: medialuna del lado de la vela + especular
  crescent(c, inner, -L[0] * 3.5, -L[1] * 3.5, 'rgba(255,214,200,0.6)');
  c.fillStyle = 'rgba(255,250,246,0.95)';
  c.beginPath(); c.ellipse(x + L[0] * rx * 0.42, y + L[1] * ry * 0.36, 5 * s, 2.1 * s, rot + 0.7, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,240,235,0.7)';
  c.beginPath(); c.arc(x + L[0] * rx * 0.05 - 4, y + L[1] * ry * 0.02 + 6, 1.6 * s, 0, TAU); c.fill();
}

function sprout(c, L, x, y, a, s = 1) {
  const d = [Math.cos(a), Math.sin(a)];
  const ex = x + d[0] * 12 * s, ey = y + d[1] * 12 * s;
  c.strokeStyle = '#E8F6D2';
  c.lineWidth = 1.4;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d[0] * 6 + d[1] * 3, y + d[1] * 6 - d[0] * 3, ex, ey); c.stroke();
  for (const side of [-1, 1]) {
    const la = a + side * 0.85;
    const lx = ex + Math.cos(la) * 5.4 * s, ly = ey + Math.sin(la) * 5.4 * s;
    tone3(c, ellipse(lx, ly, 6.6 * s, 3.7 * s, la), { base: C.green, dark: C.greenDark, light: C.greenLight, L, dd: 1.7, dl: 1.2 });
  }
}

function flower(c, L, x, y, r, col, center, s = 1) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + r;
    tone3(c, ellipse(x + Math.cos(a) * 4.8 * s, y + Math.sin(a) * 4.8 * s, 5.2 * s, 3.6 * s, a), { base: col[0], dark: col[1], light: col[2], L, dd: 1.4, dl: 1 });
  }
  c.fillStyle = center;
  c.beginPath(); c.arc(x, y, 2.4 * s, 0, TAU); c.fill();
}

/** Dibuja la comida completa en c (coordenadas del plato). */
export function drawDish(c, L) {
  const r = rng(901);
  c.save();
  c.scale(1.08, 1.08);
  // gotitas de oliva alrededor (la porcelana nunca queda vacía de detalle)
  for (let k = 0; k < 7; k++) {
    const a = r() * TAU, rr = 70 + r() * 42;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr, s = 1.8 + r() * 2.4;
    c.fillStyle = 'rgba(214,160,40,0.55)';
    c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,240,190,0.9)';
    c.beginPath(); c.arc(x + L[0] * s * 0.35, y + L[1] * s * 0.35, s * 0.35, 0, TAU); c.fill();
  }
  reduction(c, L);
  puree(c, L);
  // puntos de salsa (de mayor a menor)
  const dots = [[40, -96, 7.5], [61, -86, 6], [78, -71, 4.6], [90, -55, 3.4], [97, -40, 2.4]];
  for (const [x, y, s] of dots) {
    tone3(c, circle(x, y, s), { base: '#E9A23B', dark: '#B9731E', light: '#FFD98A', L, dd: s * 0.35, dl: s * 0.25 });
    c.fillStyle = 'rgba(255,252,235,0.95)';
    c.beginPath(); c.arc(x + L[0] * s * 0.4, y + L[1] * s * 0.4, s * 0.26, 0, TAU); c.fill();
  }
  // espárragos debajo del lomo
  asparagus(c, L, 4, -6, -2.42, 112);
  asparagus(c, L, 12, 4, -2.6, 124);
  asparagus(c, L, 0, 16, -2.78, 110);
  // zanahorias glaseadas
  carrot(c, L, 22, -30, -0.6, 76);
  carrot(c, L, 30, -14, -0.32, 70);
  // lomo en abanico (de atrás hacia adelante)
  const fan = [[-50, 24, -0.28], [-26, 16, -0.2], [-2, 9, -0.12], [22, 3, -0.04], [46, -2, 0.05]];
  fan.forEach(([x, y, a], i) => slice(c, L, x, y, a, 0.97 + i * 0.012));
  // sal en escamas y pimienta
  for (let k = 0; k < 18; k++) {
    const x = -66 + r() * 130, y = -20 + r() * 48;
    if (k % 2) {
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.save(); c.translate(x, y); c.rotate(r() * TAU);
      c.beginPath(); c.moveTo(-2.4, -1); c.lineTo(1.5, -2.2); c.lineTo(2.6, 1.2); c.lineTo(-1, 2); c.closePath(); c.fill();
      c.restore();
    } else {
      c.fillStyle = 'rgba(25,12,8,0.85)';
      c.beginPath(); c.arc(x, y, 0.9 + r() * 0.9, 0, TAU); c.fill();
    }
  }
  // ramillete de microverdes en el centro del abanico
  const bx = 6, by = -2;
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + (r() - 0.5) * 0.5;
    const d = 3 + r() * 6;
    sprout(c, L, bx + Math.cos(a) * d, by + Math.sin(a) * d, a, 0.95 + r() * 0.35);
  }
  flower(c, L, bx - 2, by - 3, 0.3, ['#FF6B4A', '#D9472B', '#FFB59A'], '#FFD27A', 1.15);
  flower(c, L, bx + 22, by + 12, 1.1, ['#FFD27A', '#E3A43C', '#FFF1C9'], '#C2521E', 0.9);
  // dos brotes sueltos y una flor violeta sobre la cabeza del puré
  sprout(c, L, -58, 36, -2.4, 1);
  sprout(c, L, 52, 12, 0.5, 0.9);
  flower(c, L, -84, 30, 0.7, ['#B78BE3', '#7F58B8', '#E3CCF7'], '#FFE07A', 1);
  // pétalos sueltos
  for (const [x, y, a, col] of [[66, 40, 0.6, '#FF8A6A'], [-80, -44, 2.1, '#FFD27A'], [-10, -66, 1.3, '#B78BE3']]) {
    tone3(c, ellipse(x, y, 4.6, 2.8, a), { base: col, dark: 'rgba(120,40,30,0.6)', light: '#FFF2E6', L, dd: 1.2, dl: 0.9 });
  }
  c.restore();
}
