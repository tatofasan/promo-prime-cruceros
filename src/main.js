// Vista previa en vivo (navegador): el mismo motor que el render en Node, dibujando en un <canvas> 1920×1080,
// sincronizado con public/audio/promo.wav. Teclas: espacio = play/pausa · ←/→ = un cuadro · Shift+←/→ = un beat
// · Inicio = volver a 0. URL: ?t=12.5 arranca en ese tiempo.
import { setEnv } from './engine/env.js';
import { DUR, FPS, BAR, BEAT, CUES, SECTIONS, W, H, VERTICAL } from './engine/time.js';

// Las escenas se importan DESPUÉS de cargar las fuentes: si una mide texto al cargar el módulo,
// tiene que medir con Outfit y no con la fuente de reserva.
let renderFrame = null, errors = [];

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
window.__errors = [];
addEventListener('error', (e) => window.__errors.push(String(e.message)));
addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason?.stack || e.reason)));

async function loadFonts() {
  const m = await (await fetch('/fonts/fonts.json')).json();
  await Promise.all(m.fonts.map(async (f) => {
    const face = new FontFace(f.family, `url(/fonts/${f.file})`, { weight: String(f.weight), style: f.style });
    document.fonts.add(await face.load());
  }));
}

async function boot() {
  setEnv({ platform: 'browser' });
  await loadFonts();
  const comp = await import('./engine/compositor.js');
  renderFrame = comp.renderFrame;
  errors = comp.errors;
  await comp.initScenes();
  const view = $('#view');
  view.width = W;
  view.height = H;
  $('#frame').style.aspectRatio = `${W} / ${H}`;
  $('#frame').style.width = VERTICAL ? 'min(100%, calc((100vh - 96px) * 9 / 16))' : '';
  const ctx = view.getContext('2d');
  const draw = (t) => renderFrame(ctx, t, { strict: false });
  window.__seek = (t) => { draw(t); return errors.slice(); };
  setupTransport(draw, params.has('t') ? Number(params.get('t')) : 0);
  window.__ready = true;
}

function setupTransport(draw, t0) {
  const colors = { hook: '#9AA0A8', reveal: '#2FB3DD', experience: '#6FD6EC', destinations: '#FFB938', value: '#FF9273', close: '#25D366' };
  $('#sections').innerHTML = SECTIONS.map((s) => `<span style="width:${((s.to - s.from) / DUR) * 100}%;background:${colors[s.id] ?? '#888'}">${s.label}</span>`).join('');
  $('#cuemarks').innerHTML = CUES.map((c) => `<i title="${c.id}" style="left:${(c.t / DUR) * 100}%"></i>`).join('');
  $('#safeToggle').onchange = (e) => document.body.classList.toggle('safe', e.target.checked);
  const scrub = $('#scrub'), clock = $('#clock'), status = $('#status'), playBtn = $('#play');
  let t = t0, playing = false, actx = null, src = null, buf = null, startCtx = 0, startT = 0, startPerf = 0;
  const fmt = (x) => {
    const bar = Math.floor(x / BAR + 1e-6), beat = Math.floor((x % BAR) / BEAT + 1e-6) + 1;
    return `${x.toFixed(3).padStart(6, '0')} · c${bar} b${beat}`;
  };
  const show = (x) => {
    draw(x);
    scrub.value = String(x);
    clock.textContent = fmt(x);
    status.textContent = errors.length ? `⚠ ${errors.length} error(es), ver consola` : (buf ? '' : status.textContent);
  };
  fetch(`/audio/promo.wav?v=${Date.now()}`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((ab) => new AudioContext().decodeAudioData(ab))
    .then((b) => { buf = b; status.textContent = ''; })
    .catch(() => { status.textContent = 'sin música todavía'; });
  const now = () => (src && actx ? startT + (actx.currentTime - startCtx) - (actx.outputLatency || 0) : startT + (performance.now() - startPerf) / 1000);
  function loop() {
    if (!playing) return;
    t = now();
    if (t >= DUR) { stop(); t = DUR; show(t); return; }
    show(Math.max(0, t));
    requestAnimationFrame(loop);
  }
  function play() {
    if (t >= DUR - 0.01) t = 0;
    startT = t;
    if (buf) {
      actx ??= new AudioContext({ sampleRate: buf.sampleRate, latencyHint: 'playback' });
      actx.resume();
      src = actx.createBufferSource();
      src.buffer = buf;
      src.connect(actx.destination);
      startCtx = actx.currentTime + 0.05;
      src.start(startCtx, t);
    } else startPerf = performance.now();
    playing = true;
    playBtn.textContent = '❚❚';
    requestAnimationFrame(loop);
  }
  function stop() {
    playing = false;
    playBtn.textContent = '▶';
    if (src) { try { src.stop(); } catch { /* ya parado */ } src.disconnect(); src = null; }
  }
  playBtn.onclick = () => (playing ? stop() : play());
  scrub.oninput = () => { if (playing) stop(); t = Number(scrub.value); show(t); };
  addEventListener('keydown', (e) => {
    const step = e.shiftKey ? BEAT : 1 / FPS;
    if (e.code === 'Space') { e.preventDefault(); if (playing) stop(); else play(); }
    else if (e.code === 'ArrowRight') { if (playing) stop(); t = Math.min(DUR, t + step); show(t); }
    else if (e.code === 'ArrowLeft') { if (playing) stop(); t = Math.max(0, t - step); show(t); }
    else if (e.code === 'Home') { if (playing) stop(); t = 0; show(t); }
  });
  show(t);
}

boot().catch((e) => {
  console.error(e);
  window.__errors.push(String(e?.stack || e));
  $('#status').textContent = 'error de arranque: ' + e.message;
});
