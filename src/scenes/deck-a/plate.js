// Plato de porcelana con ala de filo dorado (r 200 de mundo), anillo de puntos, timón grabado en oro y la comida.
// El sprite del plato GIRA con el plato; la luz (medialunas y especular del oro) va aparte y NO gira.
import { TAU } from '../../engine/ease.js';
import { sprite, put } from './util.js';
import { drawDish } from './dish.js';

export const PLATE_R = 200;
export const WELL_R = 132;

function wheel(c, x, y, r) {
  // timón de barco grabado en oro
  c.save();
  c.translate(x, y);
  c.strokeStyle = '#C8932F';
  c.fillStyle = '#C8932F';
  c.lineCap = 'round';
  c.lineWidth = 2.2;
  c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.stroke();
  c.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    c.beginPath();
    c.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    c.stroke();
    c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, TAU); c.fill();
  }
  c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); c.fill();
  c.restore();
}

/** Sprite del plato completo (porcelana + oro + comida). L = vector hacia la luz con el plato en reposo. */
export function buildPlate(L) {
  const R = PLATE_R;
  return sprite(R * 2 + 8, R * 2 + 8, (c) => {
    // ala
    const g = c.createRadialGradient(0, 0, WELL_R, 0, 0, R);
    g.addColorStop(0, '#E9DDCA');
    g.addColorStop(0.12, '#FAF4EA');
    g.addColorStop(0.55, '#FCF8F1');
    g.addColorStop(0.9, '#F1E8DA');
    g.addColorStop(1, '#E2D5C1');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    // filo dorado exterior (doble línea)
    c.lineWidth = 6.5;
    c.strokeStyle = '#C38A2C';
    c.beginPath(); c.arc(0, 0, R - 4, 0, TAU); c.stroke();
    c.lineWidth = 1.6;
    c.strokeStyle = '#F2CD78';
    c.beginPath(); c.arc(0, 0, R - 4.5, 0, TAU); c.stroke();
    c.lineWidth = 1.2;
    c.strokeStyle = '#C9963A';
    c.beginPath(); c.arc(0, 0, R - 12, 0, TAU); c.stroke();
    // anillo de puntos dorados (deja ver el giro)
    c.fillStyle = '#D3A245';
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * TAU;
      if (Math.abs(((a + Math.PI / 2 + TAU) % TAU) - 0) < 0.12 || Math.abs(((a + Math.PI / 2 + TAU) % TAU) - TAU) < 0.12) continue;
      c.beginPath(); c.arc(Math.cos(a) * (R - 22), Math.sin(a) * (R - 22), k % 3 ? 1.1 : 1.9, 0, TAU); c.fill();
    }
    // emblema: timón arriba y un ancla chiquita abajo
    wheel(c, 0, -(R - 32), 14);
    c.save();
    c.translate(0, R - 32);
    c.strokeStyle = '#C8932F';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 8); c.stroke();
    c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, -5); c.stroke();
    c.beginPath(); c.arc(0, 1, 8, 0.2, Math.PI - 0.2); c.stroke();
    c.beginPath(); c.arc(0, -11, 2.4, 0, TAU); c.stroke();
    c.restore();
    // hueco del plato
    const w = c.createRadialGradient(-L[0] * 30, -L[1] * 30, 10, 0, 0, WELL_R);
    w.addColorStop(0, '#FFFDF8');
    w.addColorStop(0.75, '#FBF6EC');
    w.addColorStop(1, '#ECE1CF');
    c.fillStyle = w;
    c.beginPath(); c.arc(0, 0, WELL_R, 0, TAU); c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = '#D6AA52';
    c.beginPath(); c.arc(0, 0, WELL_R + 2, 0, TAU); c.stroke();
    drawDish(c, L);
  }, 1.25);
}

/** Capa de luz del plato (no gira): medialunas de sombra y de luz, especular del oro. a = ángulo hacia la vela. */
export function buildPlateLight(a) {
  const R = PLATE_R;
  return sprite(R * 2 + 40, R * 2 + 40, (c) => {
    c.rotate(a); // eje +x apunta a la vela
    // sombra del lado lejano del ala
    c.save();
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
    const sh = c.createLinearGradient(R, 0, -R, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(0.55, 'rgba(60,40,30,0)');
    sh.addColorStop(1, 'rgba(40,25,30,0.22)');
    c.fillStyle = sh;
    c.fillRect(-R, -R, R * 2, R * 2);
    // pared interna del hueco: sombra del lado de la luz, luz del lado opuesto (es cóncavo)
    c.filter = 'blur(4px)';
    for (let k = 0; k < 4; k++) {
      const span = 1.1 - k * 0.22;
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(110,80,50,0.07)';
      c.beginPath(); c.arc(-2, 0, WELL_R - 3, -span, span); c.stroke();
    }
    c.filter = 'blur(1.5px)';
    for (let k = 0; k < 4; k++) {
      const span = 1.0 - k * 0.2;
      c.lineWidth = 2.5;
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.beginPath(); c.arc(1.5, 0, WELL_R + 1, Math.PI - span, Math.PI + span); c.stroke();
    }
    c.filter = 'none';
    // brillo del ala hacia la vela
    const hl = c.createRadialGradient(R * 0.82, 0, 0, R * 0.82, 0, R * 0.55);
    hl.addColorStop(0, 'rgba(255,250,235,0.55)');
    hl.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = hl;
    c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
    // especular del filo dorado: arcos que se afinan
    c.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const span = 0.75 - k * 0.11;
      c.strokeStyle = `rgba(255,${236 - k * 6},${170 - k * 14},${0.16 + k * 0.12})`;
      c.lineWidth = 3.2 - k * 0.35;
      c.beginPath(); c.arc(0, 0, R - 4, -span, span); c.stroke();
    }
    // borde exterior: filo de luz fino y sombra del lado opuesto
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, R - 0.8, -1.2, 1.2); c.stroke();
    c.strokeStyle = 'rgba(30,20,20,0.35)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R - 1, Math.PI - 1.3, Math.PI + 1.3); c.stroke();
  }, 1.25);
}

/**
 * Dibuja el plato en (x, y) del sistema actual (mundo) girado `rot` (cuerpo rígido: ala y comida juntas).
 * smearAng > 0 → desenfoque rotacional tipo cometa: copias hacia atrás del giro con peso que decae y la copia
 * actual encima con más peso (se lee el sentido del giro; el contorno circular no cambia).
 */
export function drawPlate(ctx, P, PL, x, y, rot, smearAng = 0, n = 9) {
  if (smearAng > 0.01) {
    ctx.save();
    for (let k = n - 1; k >= 0; k--) {
      const f = k / (n - 1);
      put(ctx, P, x, y, { r: rot - smearAng * f, alpha: k === n - 1 ? 1 : k === 0 ? 0.45 : 0.3 });
    }
    ctx.restore();
  } else {
    put(ctx, P, x, y, { r: rot });
  }
  put(ctx, PL, x, y, { r: 0 });
}
