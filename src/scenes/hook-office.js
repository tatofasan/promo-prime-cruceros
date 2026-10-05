// Gancho: la oficina gris (0–3,75; la ola la barre hasta 3,98). Equipo HOOK. Contrato: docs/PLAN.md §6.1.
// Planos: ciudad (0,3) · pared con ventana, reloj y almanaque (0,7) · escritorio y monitor (1) · primer plano
// desenfocado (1,45). La pantalla es la única fuente cálida: se satura, se filtra el mar y revienta.
import { plane, toScreen, applyCam } from '../engine/camera.js';
import { D, T, MON, WIN } from './hook/layout.js';
import { camAt, openBlur } from './hook/camera.js';
import { initCity, drawCity, lightningAt } from './hook/city.js';
import { initWall, drawWall, drawCord } from './hook/wall.js';
import { initGlass, drawGlass } from './hook/glass.js';
import { drawClock } from './hook/clock.js';
import { initCalendar, drawCalendar, drawCalendarFly, drawSheetsToCamera } from './hook/calendar.js';
import { initDesk, drawDesk } from './hook/desk.js';
import { initMonitor, drawMonitor, drawPostits } from './hook/monitor.js';
import { initScreen, drawScreen } from './hook/screen.js';
import { initMug, drawMug, drawSteam } from './hook/mug.js';
import { initPapers, drawStack, drawPaperStorm } from './hook/papers.js';
import { initLeak, drawLeak } from './hook/leak.js';
import { initBurst, drawBurst, burstCenter } from './hook/burst.js';
import { initForeground, drawForeground, drawDust } from './hook/foreground.js';
import { tube, drawTube, drawDim, drawSpill, drawBurstGlow, drawTunnel, drawDeskRims, drawWallRims } from './hook/light.js';
import { hit } from './hook/util.js';
import { BEAT, W, H } from '../engine/time.js';
import { noise1 } from '../engine/noise.js';
import { clamp } from '../engine/ease.js';
import { rad } from '../engine/draw.js';
import { rgba } from '../engine/color.js';
import { HOOK_WAVE } from './waves.js';
import { zoomBlur, initZoomBlur } from './hook/reveal/zoomblur.js';
import { waveFrontX } from '../art/index.js';

/** El relámpago entra por la ventana: luz fría que barre la pared y el escritorio desde la izquierda. */
function drawLightningSpill(ctx, t, cam) {
  const fl = lightningAt(t);
  if (fl <= 0) return;
  const [wx, wy] = toScreen(cam, D.wall, WIN.x + WIN.w * 0.6, WIN.y + WIN.h * 0.5);
  const r = 1700 * Math.pow(cam.z, D.wall);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rad(ctx, wx, wy, r, [[0, rgba('#D9E8FF', 0.58 * fl)], [0.5, rgba('#B8CCE4', 0.26 * fl)], [1, rgba('#B8CCE4', 0)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** La oficina completa con la cámara cam (todo lo que pasa por el desenfoque de zoom del destape). */
function paintOffice(ctx, t, cam) {
  const wind = t > T.surge ? clamp((t - T.surge) / 0.3) : 0;
  // temblor del monitor: presión del agua antes del estallido
  const pre = clamp((t - T.leak) / (T.surge - T.leak));
  const mShake = t > T.leak && t < T.surge + 0.05 ? 2.2 * pre * pre : 0;
  const mdx = mShake * noise1(t * 40, 2), mdy = mShake * noise1(t * 43, 9);
  // el monitor late con el bombo en c1 (más fuerte en los golpes de la pregunta)
  let pulse = 0;
  for (const q of T.q) pulse += 0.014 * hit(t, q, 0.11);
  if (t > T.q[0] && t < T.surge) pulse += 0.006 * hit((t - T.q[0]) % (BEAT / 2), 0, 0.08);
  const mon = (c) => { c.translate(MON.cx + mdx, MON.cy + mdy); c.scale(1 + pulse, 1 + pulse); c.translate(-MON.cx, -MON.cy); };

  // ciudad: solo se rasteriza dentro del hueco de la ventana (la pared tapa el resto)
  ctx.save();
  applyCam(ctx, cam, D.wall);
  ctx.beginPath();
  ctx.rect(WIN.x - 4, WIN.blind - 4, WIN.w + 8, WIN.y + WIN.h - WIN.blind + 8);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  plane(ctx, cam, D.city, (c) => drawCity(c, t, { wind }));
  ctx.restore();
  plane(ctx, cam, D.wall, (c) => {
    drawGlass(c, t);
    drawWall(c);
    drawCord(c, t);
    drawTube(c, t);
    drawClock(c, t);
    drawWallRims(c, t);
    drawCalendar(c, t);
  });
  plane(ctx, cam, D.desk, (c) => {
    drawDesk(c);
    c.save();
    mon(c);
    drawMonitor(c);
    drawPostits(c, t);
    c.restore();
    drawMug(c);
    drawDeskRims(c, t);
    drawSteam(c, t);
    drawStack(c, t);
  });
  drawDim(ctx, t);
  drawLightningSpill(ctx, t, cam);
  // la luz de la pantalla baña la oficina (antes del contenido, para no lavarlo)
  const [sx, sy] = toScreen(cam, D.desk, MON.cx, MON.cy);
  drawSpill(ctx, t, sx, sy, cam.z);
  drawTunnel(ctx, t, sx, sy, cam.z);
  plane(ctx, cam, D.desk, (c) => {
    mon(c);
    drawScreen(c, t);
    drawLeak(c, t);
  });
  plane(ctx, cam, D.wall, (c) => drawCalendarFly(c, t));
  plane(ctx, cam, D.desk, (c) => {
    drawBurst(c, t);
    drawPaperStorm(c, t);
  });
  const [bx, by] = toScreen(cam, D.desk, burstCenter[0], burstCenter[1]);
  drawBurstGlow(ctx, t, bx, by, cam.z);
  plane(ctx, cam, D.fg, (c) => drawForeground(c, t));
  plane(ctx, cam, 1.15, (c) => drawDust(c, t, tube(t)));
}

const scene = {
  id: 'hook-office',
  team: 'HOOK',
  from: 0.0,
  to: 3.98,
  z: 10,
  async init() {
    initCity();
    initWall();
    initGlass();
    initCalendar();
    initDesk();
    initMonitor();
    initScreen();
    initMug();
    initPapers();
    initLeak();
    initBurst();
    initForeground();
    initZoomBlur();
  },
  draw(ctx, t) {
    // la ola ya cubrió todo el cuadro: no hace falta pintar la oficina debajo
    const wp = HOOK_WAVE.p(t);
    if (wp >= 1) return;
    // lo que ya pasó el frente de la ola lo tapa el mar: solo se pinta la parte de adelante
    const cut = wp > 0 ? waveFrontX(wp, HOOK_WAVE.dir) + 180 : W + 1;
    if (cut < W) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cut, H); ctx.clip(); }
    const cam = camAt(t);
    // destape de hook.q1: desenfoque de zoom en los 2–3 cuadros más rápidos
    const ob = openBlur(t);
    zoomBlur(ctx, 1240, 470, 0.16 * ob, (g) => paintOffice(g, t, cam));
    drawSheetsToCamera(ctx, t, cam);
    if (cut < W) ctx.restore();
  },
};
export default scene;
