// Banco de pruebas: pared, ciudad, reloj y almanaque con la cámara quieta.
import { initCity, drawCity } from './city.js';
import { initWall, drawWall } from './wall.js';
import { initCalendar, drawCalendar, drawCalendarFly } from './calendar.js';
import { drawClock } from './clock.js';

export async function init() {
  initCity();
  initWall();
  initCalendar();
}
export function draw(ctx, t) {
  drawCity(ctx, t);
  drawWall(ctx);
  drawClock(ctx, t);
  drawCalendar(ctx, t);
  drawCalendarFly(ctx, t);
}
