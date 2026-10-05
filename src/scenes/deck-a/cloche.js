// Campana plateada (cloche) vista desde arriba: labio pulido, domo cromado con reflejos de corte duro
// (la sala oscura, el mantel navy, el plato y la vela), botón central y asa de lazo que gira con el plato.
import { TAU } from '../../engine/ease.js';
import { sprite, shadowSprite } from './util.js';
import { circle, crescent } from './shape.js';

export const CLOCHE_R = 160;

/** Cuerpo del domo (no gira: su luz sigue a la vela). a = ángulo hacia la vela. */
export function buildCloche(a) {
  const R = CLOCHE_R;
  return sprite(R * 2 + 16, R * 2 + 16, (c) => {
    c.rotate(a); // +x → vela
    // labio
    const lip = c.createLinearGradient(R, 0, -R, 0);
    lip.addColorStop(0, '#F2F6FA');
    lip.addColorStop(0.45, '#A9B5C3');
    lip.addColorStop(1, '#4E5B6E');
    c.fillStyle = lip;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, R - 0.8, -1.3, 1.3); c.stroke();
    // domo
    const r = R - 9;
    const g = c.createRadialGradient(r * 0.34, 0, 0, r * 0.1, 0, r * 1.05);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.1, '#F1F5F9');
    g.addColorStop(0.42, '#BCC7D3');
    g.addColorStop(0.78, '#7E8C9E');
    g.addColorStop(1, '#4F5D72');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    // reflejo de la sala/mantel (medialuna oscura del lado lejano)
    crescent(c, circle(0, 0, r), r * 0.42, 0, 'rgba(18,34,58,0.72)');
    crescent(c, circle(0, 0, r), r * 0.16, 0, 'rgba(10,24,44,0.55)');
    // reflejo del plato blanco con filo de oro rodeando la base
    c.lineWidth = 7;
    c.strokeStyle = 'rgba(255,246,228,0.32)';
    c.beginPath(); c.arc(0, 0, r - 6, 0, TAU); c.stroke();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(232,184,90,0.55)';
    c.beginPath(); c.arc(0, 0, r - 2.5, Math.PI * 0.55, Math.PI * 1.45); c.stroke();
    // costura del domo
    c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(40,52,70,0.45)';
    c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.arc(0, 0, r * 0.86 + 1.4, -1.2, 1.2); c.stroke();
    // ventana de luz: banda curva de corte duro del lado de la vela
    c.save();
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.88)';
    c.beginPath();
    c.arc(0, 0, r * 0.83, -0.95, 0.55);
    c.arc(0, 0, r * 0.66, 0.5, -0.9, true);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.arc(0, 0, r * 0.6, -0.7, 0.05);
    c.arc(0, 0, r * 0.52, 0.02, -0.66, true);
    c.closePath();
    c.fill();
    // reflejo cálido de la vela
    const w = c.createRadialGradient(r * 0.47, -r * 0.08, 0, r * 0.47, -r * 0.08, r * 0.3);
    w.addColorStop(0, 'rgba(255,236,190,0.95)');
    w.addColorStop(0.25, 'rgba(255,200,110,0.55)');
    w.addColorStop(1, 'rgba(255,180,80,0)');
    c.fillStyle = w;
    c.fillRect(-r, -r, r * 2, r * 2);
    c.fillStyle = '#FFFDF6';
    c.beginPath(); c.ellipse(r * 0.47, -r * 0.08, 7, 4.5, 0.4, 0, TAU); c.fill();
    // reflejo de las copas: dos manchas rojizas suaves
    c.fillStyle = 'rgba(150,30,50,0.07)';
    c.beginPath(); c.ellipse(r * 0.28, -r * 0.5, 16, 9, -0.6, 0, TAU); c.fill();
    c.restore();
    // botón central
    const b = c.createRadialGradient(6, 0, 0, 0, 0, 26);
    b.addColorStop(0, '#FFFFFF');
    b.addColorStop(0.5, '#C9D2DC');
    b.addColorStop(1, '#6A788B');
    c.fillStyle = 'rgba(20,30,45,0.35)';
    c.beginPath(); c.arc(-4, 0, 27, 0, TAU); c.fill();
    c.fillStyle = b;
    c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.fill();
  }, 1.4);
}

/** Asa de lazo (gira con el plato). */
export function buildHandle() {
  return sprite(130, 50, (c) => {
    const L = 46, w = 11;
    for (const sx of [-1, 1]) {
      const g = c.createRadialGradient(sx * L + 3, -3, 0, sx * L, 0, 15);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.6, '#AEB9C6');
      g.addColorStop(1, '#5D6A7C');
      c.fillStyle = g;
      c.beginPath(); c.arc(sx * L, 0, 14, 0, TAU); c.fill();
    }
    const g = c.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.3, '#E1E7EE');
    g.addColorStop(0.7, '#8D9AAB');
    g.addColorStop(1, '#4B586B');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-L, -w); c.lineTo(L, -w);
    c.arc(L, 0, w, -Math.PI / 2, Math.PI / 2);
    c.lineTo(-L, w);
    c.arc(-L, 0, w, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-L + 4, -w * 0.45); c.lineTo(L - 4, -w * 0.45); c.stroke();
  }, 1.6);
}

/** Sombra del asa sobre el domo. */
export const buildHandleShadow = () => shadowSprite(124, 34, 6, (c) => {
  c.beginPath();
  c.moveTo(-46, -12); c.lineTo(46, -12); c.arc(46, 0, 12, -Math.PI / 2, Math.PI / 2);
  c.lineTo(-46, 12); c.arc(-46, 0, 12, Math.PI / 2, Math.PI * 1.5);
  c.fill();
});
