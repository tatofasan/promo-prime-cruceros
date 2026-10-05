// Ciudad gris detrás de la ventana: cielo de tormenta, nubes en capas y tres planos de edificios con
// perspectiva atmosférica (lo lejano más claro y con menos contraste). Se hornea desenfocada (el foco está en
// el escritorio) y encima cae la llovizna en vivo.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, circlePath } from '../../engine/draw.js';
import { rng, hash } from '../../engine/noise.js';
import { bake, blurSprite, put } from './util.js';
import { WIN } from './layout.js';
import { cue, BEAT } from '../../engine/time.js';

const BX = WIN.x - 170, BY = WIN.y - 150, BW = WIN.w + 340, BH = WIN.h + 300;
let SPR = null, FLASH = null;
/** Relámpago lejano (vive la mitad izquierda en la apertura): golpe en la corchea entre cal2 y cal3. */
export const LIGHTNING = cue('hook.cal2') + BEAT / 2;
const FLASHES = [[0, 0.035, 1], [0.065, 0.03, 0.75], [0.12, 0.09, 0.45]];

const SKY_TOP = mixHex(PAL.grey900, PAL.navy700, 0.35);
const SKY_MID = mixHex(PAL.grey700, PAL.navy600, 0.12);
const SKY_LOW = mixHex(PAL.grey500, PAL.grey600, 0.35);

export function initCity() {
  SPR = blurSprite(bake(BX, BY, BW, BH, 1, (g) => paintCity(g, false)), 2.4);
  FLASH = blurSprite(bake(BX, BY, BW, BH, 0.6, (g) => paintCity(g, true)), 2.4);
}

/** Rayo ramificado (horneado en la versión iluminada): núcleo blanco, halo frío y ramas finas. */
function bolt(g) {
  const r = rng(5);
  const seg = (x, y, a, n, w) => {
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * (14 + r() * 22); y += Math.sin(a) * (14 + r() * 22);
      pts.push([x, y]);
      if (w > 1.6 && r() < 0.18) seg(x, y, a + (r() < 0.5 ? -0.7 : 0.7), Math.floor(n * 0.4), w * 0.5);
    }
    for (const [lw, col] of [[w * 7, rgba('#CFE6FF', 0.18)], [w * 3, rgba('#E6F2FF', 0.55)], [w, rgba(PAL.white, 1)]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
  };
  seg(WIN.x + 380, BY + 150, Math.PI * 0.52, 20, 6);
}

function paintCity(g, flash) {
  {
    // cielo (con el relámpago: blanco azulado que ilumina las nubes desde atrás)
    fill(g, rrectPath(BX, BY, BW, BH, 0), lin(g, 0, BY, 0, BY + BH, flash
      ? [[0, '#C9D9EA'], [0.45, '#EEF5FC'], [0.78, mixHex(PAL.grey300, '#D9E6F2', 0.5)], [1, PAL.grey300]]
      : [[0, SKY_TOP], [0.45, SKY_MID], [0.78, SKY_LOW], [1, SKY_LOW]]));
    if (flash) { g.save(); g.globalAlpha = 0.55; clouds(g); g.restore(); bolt(g); } else clouds(g);
    buildings(g, 'far', 31);
    crane(g, 700, 520);
    buildings(g, 'mid', 57);
    // bruma de lluvia entre planos
    fill(g, rrectPath(BX, BY + BH * 0.55, BW, BH * 0.45, 0), lin(g, 0, BY + BH * 0.55, 0, BY + BH, [[0, rgba(PAL.grey400, 0)], [1, rgba(PAL.grey400, 0.28)]]));
    buildings(g, 'near', 83);
  }
}

/** Intensidad del relámpago en t (0..1): tres pulsos que se apagan. */
export function lightningAt(t) {
  let v = 0;
  for (const [o, d, a] of FLASHES) { const u = t - LIGHTNING - o; if (u >= 0) v = Math.max(v, a * Math.exp(-u / d)); }
  return v < 0.01 ? 0 : v;
}

function clouds(g) {
  const r = rng(11);
  // tres bandas de nubes: base, panza oscura y filo claro arriba
  for (let band = 0; band < 3; band++) {
    const y0 = 262 + band * 62;
    const base = mixHex(SKY_MID, PAL.grey500, 0.25 + band * 0.18);
    for (let i = 0; i < 9; i++) {
      const cx = BX + (i / 8) * BW + (r() - 0.5) * 120;
      const cy = y0 + (r() - 0.5) * 40;
      const s = 70 + r() * 70;
      const puffs = [[0, 0, 1], [-0.9, 0.25, 0.7], [0.95, 0.2, 0.75], [-0.4, -0.35, 0.65], [0.45, -0.3, 0.7]];
      g.save();
      g.globalAlpha = 0.75 + band * 0.08;
      for (const [dx, dy, k] of puffs) fill(g, circlePath(cx + dx * s, cy + dy * s * 0.6, s * k * 0.75), mixHex(base, PAL.grey500, 0.2));
      for (const [dx, dy, k] of puffs) fill(g, circlePath(cx + dx * s, cy + dy * s * 0.6 + s * 0.16, s * k * 0.68), base);
      fill(g, rrectPath(cx - s * 1.5, cy + s * 0.18, s * 3, s * 0.5, s * 0.25), mixHex(base, PAL.grey900, 0.22));
      g.restore();
    }
  }
}

const LAYERS = {
  far: { top: [440, 560], w: [40, 110], col: mixHex(PAL.grey500, SKY_LOW, 0.6), win: 0.06, rim: 0.04, gap: [0, 8] },
  mid: { top: [360, 500], w: [60, 140], col: mixHex(PAL.grey600, PAL.grey500, 0.35), win: 0.1, rim: 0.08, gap: [4, 30] },
  near: { top: [330, 470], w: [130, 220], col: mixHex(PAL.grey700, PAL.grey600, 0.25), win: 0.14, rim: 0.12, gap: [40, 120] },
};

function buildings(g, kind, seed) {
  const L = LAYERS[kind];
  const r = rng(seed);
  const ground = BY + BH;
  let x = BX - 20 - r() * 60;
  while (x < BX + BW) {
    const w = L.w[0] + r() * (L.w[1] - L.w[0]);
    const top = L.top[0] + r() * (L.top[1] - L.top[0]);
    const col = mixHex(L.col, PAL.grey900, (r() - 0.4) * 0.14);
    const style = ['grid', 'ribbon', 'glass'][Math.floor(r() * 3)];
    const body = rrectPath(x, top, w, ground - top, 0);
    fill(g, body, col);
    g.save();
    g.clip(body);
    if (style === 'grid') {
      const cols = Math.max(2, Math.floor(w / 26));
      const gw = w / cols;
      for (let yy = top + 14, row = 0; yy < ground; yy += 24, row++) {
        for (let c = 0; c < cols; c++) {
          const lit = hash(seed, x + c, row) < 0.06;
          g.fillStyle = lit ? rgba('#D6DCCF', 0.5) : rgba(PAL.grey300, L.win);
          g.fillRect(x + c * gw + gw * 0.28, yy, gw * 0.44, 11);
        }
      }
    } else if (style === 'ribbon') {
      for (let yy = top + 12, row = 0; yy < ground; yy += 22, row++) {
        g.fillStyle = rgba(PAL.ink, 0.22);
        g.fillRect(x + 6, yy, w - 12, 9);
        g.fillStyle = rgba(PAL.grey300, L.win * 0.9);
        g.fillRect(x + 6, yy, w - 12, 1.5);
        if (hash(seed, x, row) < 0.12) { g.fillStyle = rgba('#D6DCCF', 0.35); g.fillRect(x + 6 + hash(row, x) * (w - 50), yy + 2, 36, 6); }
      }
    } else {
      // torre vidriada: parantes verticales y reflejo del cielo
      fill(g, body, lin(g, x, 0, x + w, 0, [rgba(PAL.grey400, L.win * 1.6), rgba(PAL.grey400, 0), rgba(PAL.grey400, L.win)]));
      g.fillStyle = rgba(PAL.ink, 0.25);
      for (let xx = x + 10; xx < x + w; xx += 14) g.fillRect(xx, top, 2, ground - top);
      g.fillStyle = rgba(PAL.ink, 0.12);
      for (let yy = top + 30; yy < ground; yy += 60) g.fillRect(x, yy, w, 3);
    }
    g.restore();
    // filo de luz a la izquierda (cielo) + lado en sombra
    fill(g, rrectPath(x, top, 3, ground - top, 0), rgba(PAL.grey300, L.rim));
    fill(g, rrectPath(x + w * 0.74, top, w * 0.26, ground - top, 0), rgba(PAL.ink, 0.1));
    // remates de techo
    const k = r();
    if (kind !== 'far' && k < 0.3) {
      const tx = x + w * (0.25 + r() * 0.4);
      fill(g, rrectPath(tx - 14, top - 30, 28, 24, 6), mixHex(col, PAL.grey900, 0.15));
      g.fillStyle = col; g.fillRect(tx - 12, top - 8, 3, 8); g.fillRect(tx + 9, top - 8, 3, 8);
      fill(g, rrectPath(tx - 15, top - 33, 30, 6, 3), mixHex(col, PAL.grey400, 0.2));
    } else if (k < 0.55) {
      const ax = x + w * (0.3 + r() * 0.4), ah = 30 + r() * 60;
      g.fillStyle = col; g.fillRect(ax - 1.5, top - ah, 3, ah);
      fill(g, circlePath(ax, top - ah, 3), rgba('#E8EEF2', 0.6));
    } else if (k < 0.75) {
      fill(g, rrectPath(x + w * 0.15, top - 12, w * 0.3, 12, 2), mixHex(col, PAL.grey500, 0.15));
    }
    x += w + L.gap[0] + r() * (L.gap[1] - L.gap[0]);
  }
  // bruma de lluvia delante de cada capa
  fill(g, rrectPath(BX, BY, BW, BH, 0), lin(g, 0, BY + BH * 0.3, 0, BY + BH, [rgba(PAL.grey500, 0), rgba(PAL.grey500, kind === 'near' ? 0.12 : 0.22)]));
}

function crane(g, x, top) {
  const col = mixHex(PAL.grey500, SKY_LOW, 0.3);
  const ground = BY + BH;
  g.save();
  g.strokeStyle = col;
  g.lineWidth = 2;
  // mástil reticulado
  g.strokeRect(x - 7, top, 14, ground - top);
  g.beginPath();
  for (let y = top; y < ground; y += 14) { g.moveTo(x - 7, y); g.lineTo(x + 7, y + 14); }
  g.stroke();
  // pluma y contrapluma
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x - 90, top + 2); g.lineTo(x + 260, top + 2); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, top - 40); g.lineTo(x + 250, top + 2); g.moveTo(x, top - 40); g.lineTo(x - 90, top + 2); g.stroke();
  g.beginPath(); g.moveTo(x, top - 40); g.lineTo(x, top); g.stroke();
  g.fillStyle = col; g.fillRect(x - 92, top - 4, 30, 16);
  // cable con gancho
  g.beginPath(); g.moveTo(x + 190, top + 2); g.lineTo(x + 190, top + 120); g.stroke();
  g.fillRect(x + 185, top + 118, 10, 8);
  g.restore();
}

/** Ciudad horneada + llovizna. Se dibuja en el plano D.city (la pared tapa todo menos el hueco). */
export function drawCity(ctx, t, { wind = 0 } = {}) {
  put(ctx, SPR);
  const fl = lightningAt(t);
  if (fl > 0) { ctx.save(); ctx.globalAlpha = fl; put(ctx, FLASH); ctx.restore(); }
  drawRain(ctx, t, wind);
}

function drawRain(ctx, t, wind) {
  // tres grupos de alfa: un solo trazo por grupo (rápido)
  const N = 120;
  for (let grp = 0; grp < 3; grp++) {
    ctx.beginPath();
    for (let i = grp; i < N; i += 3) {
      const sp = 1500 + hash(i, 2) * 700;
      const len = 26 + hash(i, 3) * 44;
      const x0 = BX + hash(i, 1) * BW;
      const y = BY + ((hash(i, 4) * BH + sp * t) % BH);
      const slant = -0.2 - wind * 0.6;
      const x = x0 + (y - BY) * slant * 0.3;
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * slant, y + len);
    }
    ctx.strokeStyle = rgba(PAL.grey200, [0.1, 0.16, 0.24][grp]);
    ctx.lineWidth = [1, 1.4, 1.8][grp];
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
