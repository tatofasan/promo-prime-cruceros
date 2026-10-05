// Cubiertos de plata y servilleta de lino doblada, vistos desde arriba. Sprites estáticos con la luz de la vela
// horneada (filo de luz del lado de la llama, sombra del otro) + su sombra suave aparte.
import { TAU } from '../../engine/ease.js';
import { sprite, shadowSprite } from './util.js';
import { blob, tone3, ellipse } from './shape.js';

const SILVER = { base: '#BFC9D4', dark: '#727F92', light: '#F7FAFD' };

const mirror = (half) => [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];

// mitad derecha de cada contorno (y crece hacia el mango)
const FORK_HALF = [[0, 152], [11, 148], [13, 128], [10, 70], [6.5, 8], [4.6, -40], [8, -70], [16, -96], [17.5, -118], [17, -150]];
const KNIFE_HALF = [[0, 152], [10, 148], [11.5, 120], [10, 40], [8.5, -12]];
const SPOON_HALF = [[0, 152], [11, 148], [13, 126], [10, 66], [6.5, 6], [4.2, -60], [7, -80]];

function streak(c, L, x0, y0, x1, y1, w = 2.4) {
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = w;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0 + L[0] * 3, y0); c.lineTo(x1 + L[0] * 3, y1); c.stroke();
}

function forkShape(c, L) {
  const pts = mirror(FORK_HALF);
  const mk = blob(pts);
  tone3(c, mk, { ...SILVER, L, dd: 3.5, dl: 2 });
  // ranuras entre dientes
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const sx of [-8.6, 0, 8.6]) {
    c.beginPath();
    c.moveTo(sx - 1.7, -160);
    c.lineTo(sx - 1.7, -104);
    c.arc(sx, -104, 1.7, Math.PI, 0, true);
    c.lineTo(sx + 1.7, -160);
    c.closePath();
    c.fill();
  }
  c.restore();
  // brillo de dientes y mango
  for (const sx of [-12.9, -4.3, 4.3, 12.9]) streak(c, L, sx, -146, sx, -110, 1.4);
  streak(c, L, 0, 140, 0, 20, 2.6);
  // grabado del mango
  c.strokeStyle = 'rgba(80,92,110,0.45)';
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(-7, 132); c.quadraticCurveTo(0, 122, 7, 132); c.stroke();
}

function knifeShape(c, L) {
  const handle = blob(mirror(KNIFE_HALF));
  tone3(c, handle, { ...SILVER, L, dd: 3.5, dl: 2 });
  // hoja: lomo recto a la derecha, filo curvo a la izquierda (hacia el plato)
  const blade = blob([[9, -14], [10.5, -60], [10, -120], [4, -152], [-6, -150], [-12.5, -118], [-13, -60], [-10, -14], [0, -8]]);
  tone3(c, blade, { base: '#D7DFE7', dark: '#8794A6', light: '#FFFFFF', L, dd: 4, dl: 2 });
  c.save();
  c.clip(blade());
  const g = c.createLinearGradient(-13, 0, 11, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.62, 'rgba(120,135,155,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(-14, -160, 28, 150);
  c.restore();
  // virola
  c.fillStyle = '#9AA6B6';
  c.fillRect(-9.5, -16, 19, 6);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fillRect(-9.5, -16, 19, 1.6);
  streak(c, L, 0, 140, 0, 6, 2.6);
}

function spoonShape(c, L) {
  const handle = blob(mirror(SPOON_HALF));
  tone3(c, handle, { ...SILVER, L, dd: 3.5, dl: 2 });
  const bowl = ellipse(0, -114, 22, 34);
  tone3(c, bowl, { ...SILVER, L, dd: 3, dl: 2 });
  // cuenco cóncavo: la luz cae del lado lejano adentro
  const g = c.createRadialGradient(-L[0] * 9, -114 - L[1] * 12, 2, 0, -114, 34);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.45, '#C9D2DC');
  g.addColorStop(1, '#6E7B8E');
  c.fillStyle = g;
  c.fill(ellipse(0, -114, 18, 29)());
  c.fillStyle = 'rgba(255,230,180,0.6)';
  c.beginPath(); c.ellipse(-L[0] * 7, -114 - L[1] * 10, 4, 7, 0, 0, TAU); c.fill();
  streak(c, L, 0, 140, 0, 10, 2.6);
}

function napkinShape(c, L) {
  const w = 88, h = 178;
  const body = blob([[-w, -h + 6], [-w + 8, -h], [w - 6, -h + 2], [w, -h + 10], [w + 2, 0], [w, h - 8], [w - 8, h], [-w + 6, h - 1], [-w, h - 8], [-w - 1, 0]]);
  tone3(c, body, { base: '#F2EADD', dark: '#CDBFAA', light: '#FFFBF4', L, dd: 6, dl: 3 });
  // pliegues de planchado: uno vertical al centro y uno horizontal a un tercio
  c.save();
  c.clip(body());
  for (const [x0, y0, x1, y1] of [[0, -h, 0, h], [-w, -h * 0.34, w, -h * 0.34]]) {
    const vx = x1 - x0, vy = y1 - y0, d = Math.hypot(vx, vy), nx = -vy / d, ny = vx / d;
    const side = nx * L[0] + ny * L[1] > 0 ? 1 : -1;
    c.strokeStyle = 'rgba(150,125,95,0.32)';
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(x0 - nx * side * 4, y0 - ny * side * 4); c.lineTo(x1 - nx * side * 4, y1 - ny * side * 4); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x0 + nx * side * 1.5, y0 + ny * side * 1.5); c.lineTo(x1 + nx * side * 1.5, y1 + ny * side * 1.5); c.stroke();
  }
  c.restore();
  // guarda bordada en hilo dorado
  c.save();
  c.clip(body());
  c.strokeStyle = 'rgba(205,155,60,0.7)';
  c.lineWidth = 2;
  c.strokeRect(-w + 16, -h + 16, w * 2 - 32, h * 2 - 32);
  c.restore();
  // dobladillo pespunteado
  c.save();
  c.clip(body());
  c.setLineDash([5, 4]);
  c.strokeStyle = 'rgba(170,150,120,0.6)';
  c.lineWidth = 1.2;
  c.strokeRect(-w + 9, -h + 9, w * 2 - 18, h * 2 - 18);
  c.setLineDash([]);
  // arrugas suaves
  c.lineCap = 'round';
  for (const [x0, y0, x1, y1, a] of [[-60, 40, -20, 120, 0.18], [30, 60, 70, 150, 0.14], [-40, -20, 10, 30, 0.1]]) {
    c.strokeStyle = `rgba(150,125,95,${a})`;
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 14, (y0 + y1) / 2, x1, y1); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${a * 2.2})`;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0 + 4, y0 - 2); c.quadraticCurveTo((x0 + x1) / 2 + 18, (y0 + y1) / 2 - 2, x1 + 4, y1 - 2); c.stroke();
  }
  // monograma bordado en hilo dorado
  c.strokeStyle = 'rgba(205,155,60,0.85)';
  c.lineWidth = 1.6;
  c.beginPath(); c.arc(30, 120, 13, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(24, 127); c.lineTo(24, 113); c.quadraticCurveTo(36, 112, 34, 120); c.quadraticCurveTo(30, 124, 24, 121); c.stroke();
  c.restore();
}

/** Arma los sprites de cubiertos y servilleta. L(x, y) da el vector hacia la luz en cada lugar. */
export function buildCutlery(Lat) {
  const S = {};
  const mk = (name, w, h, x, y, rot, draw, shadowFn) => {
    const a = Math.atan2(Lat(x, y)[1], Lat(x, y)[0]) - rot;
    const L = [Math.cos(a), Math.sin(a)];
    S[name] = { img: sprite(w, h, (c) => draw(c, L), 1.5), sh: shadowSprite(w, h, 5, shadowFn), x, y, rot, L };
  };
  mk('napkin', 190, 370, 640, 562, -0.06, napkinShape, (c) => c.fillRect(-88, -178, 176, 356));
  mk('fork', 40, 312, 662, 560, -0.035, forkShape, (c) => c.fill(blob(mirror(FORK_HALF))()));
  mk('fork2', 40, 312, 612, 572, -0.07, forkShape, (c) => c.fill(blob(mirror(FORK_HALF))()));
  mk('knife', 36, 312, 1262, 636, 0.02, knifeShape, (c) => { c.fill(blob(mirror(KNIFE_HALF))()); c.fillRect(-12, -150, 24, 140); });
  mk('spoon', 50, 312, 1322, 644, 0.04, spoonShape, (c) => { c.fill(blob(mirror(SPOON_HALF))()); c.beginPath(); c.ellipse(0, -114, 22, 34, 0, 0, TAU); c.fill(); });
  return S;
}
