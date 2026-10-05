// Copas vistas desde arriba con perspectiva real: pie (h 0), tallo, cáliz (más alto → más grande y corrido
// hacia afuera), vino con menisco, remolino y reflejo de la vela; sombra transparente con cáustica roja.
// Vaso de agua con rodaja de limón, hielo y burbujas.
import { TAU, clamp } from '../../engine/ease.js';
import { project, hullPath, onPlane, softCapsule, shadowPt, lightAng, flatten } from './util.js';
import { sparkle, rrectPath } from '../../engine/draw.js';
import { makeCanvas } from '../../engine/env.js';

const BOT = 112, WIDE = 95, RIM = 160; // alturas del cáliz (desde el pie): fondo, panza y borde (relativas al fondo)
const R_WIDE = 64, R_RIM = 56, R_BOT = 12;

/** Radio del cáliz a altura hr sobre el fondo. */
export function bowlR(hr) {
  if (hr <= 0) return R_BOT;
  if (hr < WIDE) return R_BOT + (R_WIDE - R_BOT) * Math.pow(Math.sin((Math.PI / 2) * (hr / WIDE)), 0.75);
  return R_WIDE - (R_WIDE - R_RIM) * Math.pow(clamp((hr - WIDE) / (RIM - WIDE)), 2);
}

/** Sombra en la mesa (en mundo, h 0): suave, transparente y con la cáustica del vino. */
export function wineGlassShadow(ctx, C, o) {
  const { x, y, lift = 0, lean = [0, 0], level = 0, alpha = 1 } = o;
  if (alpha <= 0.01) return;
  const hb = lift + BOT + WIDE;
  const bx = x + lean[0] * 0.6, by = y + lean[1] * 0.6;
  const [sx, sy] = shadowPt(bx, by, hb);
  const k = 470 / Math.max(60, 470 - hb);
  onPlane(ctx, C, 0, (c) => {
    const fade = alpha * clamp(1 - lift / 45);
    softCapsule(c, x, y, sx, sy, 34, 0.32 * fade);
    // panza: sombra tenue del vidrio
    const S = R_WIDE * k * 2.2 / 128;
    c.save();
    c.globalAlpha *= 0.2 * fade;
    c.drawImage(inkS(), sx - 64 * S, sy - 64 * S, 128 * S, 128 * S);
    c.restore();
    if (level > 0.02) {
      // vino: sombra rojiza y cáustica brillante
      const ws = (bowlR(level * 80) * 2 * k) / 128;
      const [wx, wy] = shadowPt(x + lean[0] * 0.45, y + lean[1] * 0.45, lift + BOT + level * 40);
      c.save();
      c.globalAlpha *= 0.55 * fade;
      c.globalCompositeOperation = 'source-over';
      c.drawImage(redS(), wx - 64 * ws, wy - 64 * ws, 128 * ws, 128 * ws);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5 * fade;
      const cs = ws * 0.42;
      const ang = lightAng(x, y);
      c.drawImage(causS(), wx - Math.cos(ang) * 64 * ws * 0.25 - 64 * cs, wy - Math.sin(ang) * 64 * ws * 0.25 - 64 * cs, 128 * cs, 128 * cs);
      c.restore();
    }
  });
}

let _ink = null, _red = null, _caus = null, _gold = null;
function disc(c0, c1) {
  const cv = makeCanvas(128, 128);
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c0);
  g.addColorStop(0.6, c1);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return flatten(cv);
}
const inkS = () => (_ink ??= disc('rgba(2,8,18,0.9)', 'rgba(2,8,18,0.5)'));
const redS = () => (_red ??= disc('rgba(70,4,18,0.9)', 'rgba(60,4,16,0.45)'));
const causS = () => (_caus ??= disc('rgba(255,120,110,1)', 'rgba(220,40,60,0.35)'));
const goldS = () => (_gold ??= disc('rgba(255,230,150,1)', 'rgba(150,230,240,0.35)'));

/**
 * Copa de vino. o = { x, y, lift, lean [dx,dy] (inclinación del cáliz en el borde), level 0..1, swirl (rad),
 * ripple 0..1 (anillos), slosh [dx,dy] (vino corrido), alpha, wine (color), t }
 */
export function drawWineGlass(ctx, C, o) {
  const { x, y, lift = 0, lean = [0, 0], level = 0, swirl = 0, ripple = 0, slosh = [0, 0], alpha = 1, t = 0, seed = 0 } = o;
  if (alpha <= 0.01) return;
  const at = (hr) => {
    const f = clamp(hr / RIM);
    return project(C, x + lean[0] * f, y + lean[1] * f, lift + BOT + hr);
  };
  const [fx, fy, fk] = project(C, x, y, lift);
  const ang = lightAng(x, y) + C.r;
  const lx = Math.cos(ang), ly = Math.sin(ang);
  ctx.save();
  ctx.globalAlpha *= alpha;
  // pie
  ctx.fillStyle = 'rgba(205,225,245,0.13)';
  ctx.beginPath(); ctx.arc(fx, fy, 44 * fk, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(215,235,255,0.28)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(fx, fy, 43 * fk, ang - 0.7, ang + 0.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,10,25,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(fx, fy, 37 * fk, 0, TAU); ctx.stroke();
  // tallo
  const [bx, by, bk] = at(0);
  ctx.fillStyle = 'rgba(220,238,255,0.32)';
  ctx.fill(hullPath(fx, fy, 6 * fk, bx, by, 7 * bk));
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill(hullPath(fx + lx * 2, fy + ly * 2, 1.6 * fk, bx + lx * 2.5, by + ly * 2.5, 1.8 * bk));
  // lo que va entre el tallo y el cáliz (la mano que agarra la copa)
  if (o.mid) { ctx.save(); ctx.globalAlpha = 1; o.mid(ctx); ctx.restore(); }
  // vino: columna en perspectiva + superficie
  if (level > 0.01) {
    const hw = level * 80;
    const [sx0, sy0, sk] = at(hw);
    const sx = sx0 + slosh[0], sy = sy0 + slosh[1];
    const rw = bowlR(hw) * sk;
    const [b2x, b2y, b2k] = at(4);
    ctx.fillStyle = 'rgba(72,6,22,0.92)';
    ctx.fill(hullPath(b2x, b2y, R_BOT * 0.9 * b2k, sx, sy, rw * 0.97));
    const g = ctx.createRadialGradient(sx - lx * rw * 0.2, sy - ly * rw * 0.2, 0, sx, sy, rw);
    g.addColorStop(0, '#5E0A20');
    g.addColorStop(0.7, '#7D1430');
    g.addColorStop(0.92, '#A3243F');
    g.addColorStop(1, '#C5506A');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, rw, 0, TAU); ctx.fill();
    // remolino: brazos de espiral claros que giran
    if (swirl) {
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, rw * 0.94, 0, TAU); ctx.clip();
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(230,110,130,${0.32 - k * 0.07})`;
        ctx.lineWidth = rw * (0.13 - k * 0.025);
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const u = i / 14;
          const a = swirl + k * (TAU / 3) + u * 2.6;
          const rr = rw * (0.15 + 0.75 * u);
          const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // anillos de onda
    if (ripple > 0 && ripple < 1) {
      for (let k = 0; k < 3; k++) {
        const p = ripple * 1.4 - k * 0.2;
        if (p <= 0 || p >= 1) continue;
        ctx.strokeStyle = `rgba(255,190,200,${(1 - p) * 0.55})`;
        ctx.lineWidth = 2.2 * (1 - p) + 0.6;
        ctx.beginPath(); ctx.arc(sx, sy, rw * (0.15 + p * 0.82), 0, TAU); ctx.stroke();
      }
    }
    // menisco y reflejo de la vela sobre el vino
    ctx.strokeStyle = 'rgba(255,170,180,0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(sx, sy, rw - 1.5, ang - 1.4, ang + 1.4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,236,210,0.9)';
    ctx.beginPath(); ctx.ellipse(sx + lx * rw * 0.42, sy + ly * rw * 0.42, rw * 0.16, rw * 0.07, ang + Math.PI / 2, 0, TAU); ctx.fill();
  }
  // panza del cáliz (vidrio)
  const [wx, wy, wk] = at(WIDE);
  const rW = R_WIDE * wk;
  ctx.fillStyle = 'rgba(200,225,250,0.07)';
  ctx.beginPath(); ctx.arc(wx, wy, rW, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(210,232,255,0.22)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // borde
  const [rx, ry, rk] = at(RIM);
  const rR = R_RIM * rk;
  ctx.strokeStyle = 'rgba(235,245,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rx, ry, rR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,12,30,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rx, ry, rR - 2.5, ang + Math.PI - 1.2, ang + Math.PI + 1.2); ctx.stroke();
  // brillos del vidrio (curvos, del lado de la vela)
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(rx, ry, rR, ang - 0.55, ang + 0.35); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(wx, wy, rW - 8, ang - 0.25, ang + 0.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(wx, wy, rW - 6, ang + Math.PI - 0.4, ang + Math.PI + 0.2); ctx.stroke();
  ctx.restore();
  // destello que titila en el borde
  const tw = 0.5 + 0.5 * Math.sin(t * 5.3 + seed * 2.1);
  sparkle(ctx, rx + Math.cos(ang - 0.2) * rR, ry + Math.sin(ang - 0.2) * rR, 9 + 7 * tw, { alpha: alpha * (0.45 + 0.55 * tw), color: '#FFF6E0', rot: 0.2 });
}

/** Vaso de agua con limón, hielo y burbujas. */
export function drawTumbler(ctx, C, o) {
  const { x, y, alpha = 1, t = 0 } = o;
  if (alpha <= 0.01) return;
  const [fx, fy, fk] = project(C, x, y, 0);
  const [wx, wy, wk] = project(C, x, y, 105);
  const [rx, ry, rk] = project(C, x, y, 150);
  const ang = lightAng(x, y) + C.r;
  const lx = Math.cos(ang), ly = Math.sin(ang);
  ctx.save();
  ctx.globalAlpha *= alpha;
  // base gruesa y paredes
  ctx.fillStyle = 'rgba(190,225,245,0.14)';
  ctx.fill(hullPath(fx, fy, 40 * fk, rx, ry, 47 * rk));
  ctx.strokeStyle = 'rgba(220,240,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(fx, fy, 40 * fk, 0, TAU); ctx.stroke();
  // agua
  ctx.fillStyle = 'rgba(169,235,246,0.20)';
  ctx.beginPath(); ctx.arc(wx, wy, 45 * wk, 0, TAU); ctx.fill();
  // hielos
  for (let k = 0; k < 2; k++) {
    const a = 2.2 + k * 2.4 + Math.sin(t * 0.8 + k) * 0.08;
    const cx = wx + Math.cos(a) * 18 * wk, cy = wy + Math.sin(a) * 18 * wk;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a * 1.3);
    ctx.fillStyle = 'rgba(235,250,255,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.3;
    const s = 15 * wk;
    const q = rrectPath(-s, -s, s * 2, s * 2, 5);
    ctx.fill(q); ctx.stroke(q);
    ctx.restore();
  }
  // rodaja de limón
  const la = 0.6 + Math.sin(t * 0.9) * 0.05;
  const lcx = wx - lx * 10 * wk, lcy = wy - ly * 10 * wk, lr = 19 * wk;
  ctx.fillStyle = '#F6D24A';
  ctx.beginPath(); ctx.arc(lcx, lcy, lr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FFF4C2';
  ctx.beginPath(); ctx.arc(lcx, lcy, lr * 0.84, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FBE06A';
  for (let k = 0; k < 8; k++) {
    const a0 = la + (k / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(lcx + Math.cos(a0 + 0.06) * lr * 0.12, lcy + Math.sin(a0 + 0.06) * lr * 0.12);
    ctx.arc(lcx, lcy, lr * 0.74, a0 + 0.08, a0 + TAU / 8 - 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(lcx + lx * lr * 0.4, lcy + ly * lr * 0.4, lr * 0.14, 0, TAU); ctx.fill();
  // burbujas
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    const a = k * 2.39, rr = (12 + (k * 7) % 26) * wk;
    ctx.beginPath(); ctx.arc(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr, 1.6 + (k % 3), 0, TAU); ctx.stroke();
  }
  // borde y brillos
  ctx.strokeStyle = 'rgba(235,248,255,0.55)';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(rx, ry, 47 * rk, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(rx, ry, 47 * rk, ang - 0.5, ang + 0.4); ctx.stroke();
  ctx.restore();
}

/** Sombra del vaso de agua. */
export function tumblerShadow(ctx, C, o) {
  const { x, y, alpha = 1 } = o;
  const [sx, sy] = shadowPt(x, y, 150);
  onPlane(ctx, C, 0, (c) => {
    softCapsule(c, x, y, sx, sy, 92, 0.2 * alpha);
    const ws = 1.1;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= 0.18 * alpha;
    c.drawImage(goldS(), (x + sx) / 2 - 64 * ws, (y + sy) / 2 - 64 * ws, 128 * ws, 128 * ws);
    c.restore();
  });
}
