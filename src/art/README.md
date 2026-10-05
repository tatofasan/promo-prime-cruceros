# Kit de ilustración de ART

Cielo, sol, nubes, mar, **crucero**, **ola**, **agua** (encaje, gotas, spray, splash), ojo de buey, gaviotas, trópico,
**figura humana** y efectos. Lo usan HOOK, DECK-A,
DECK-B, CLOSE y TYPE. Todo es **función pura de `t`** (sin `Math.random` ni `Date`) y corre igual en el
navegador y en Node.

```js
import { initArt, drawSky, skyPoint, drawSun, drawClouds, drawOcean, drawShip, SHIP, shipZoom, drawHorn,
  drawWaveMask, drawWaveCrest, drawPorthole, drawGulls, drawPalm, drawIsland,
  drawGlitter, drawConfetti, mixPreset, waveColors, drawFoamLace, drawDroplets, drawSpray, drawSplash } from '../art/index.js';

async init() { await initArt({ clouds: ['golden'] }); } // opcional: precalcula barco, estrellas y nubes
```

Hojas de muestras en `shots/art/` (ver al final cómo regenerarlas).

---

## 0. Convenciones (leelas, te ahorran sustos)

| | |
|---|---|
| **Pantalla vs. mundo** | `drawSky`, `drawOcean` y `drawClouds` se llaman en **pantalla** (transformación identidad) y reciben la cámara por `cam` ( `{ x, y, z, r }` de `engine/camera.js`). Hacen su propio parallax por profundidad. El resto (`drawSun`, `drawShip`, `drawPorthole`, `drawGulls`, `drawPalm`…) dibuja **donde esté parado el ctx**: si querés parallax, metelos en `plane(ctx, cam, depth, …)`. |
| **Horizonte** | `horizonY` es el mismo número para cielo y mar (def. 620). El cielo y el horizonte viven en el plano `SKY_DEPTH = 0.08`. Para ubicar el sol coherente con el cielo: `const [sx, sy] = skyPoint(cam, sunX, sunY)`. |
| **Sol** | `sunX/sunY` se pasan IGUALES a `drawSky` (resplandor y rayos) y a `drawOcean` (columna y destellos), y `drawSun` va en `skyPoint(cam, sunX, sunY)`. |
| **Algo apoyado en el agua** | Profundidad de su plano: `seaDepth(yAgua, horizonY)` (un barco en el horizonte ≈ 0.1–0.2). |
| **Presets** | `'day' \| 'golden' \| 'sunset' \| 'dusk' \| 'night'` o una mezcla `mixPreset('golden', 'sunset', p)` (se cachea, se puede pedir en cada cuadro). Todos los componentes aceptan `preset`. |
| **Luz** | Cada preset trae `light.dir` (vector hacia la luz). El barco, el ojo de buey y las nubes ponen el filo de luz de ese lado. |

---

## 1. `presets.js`

- `SKY_PRESETS[name]`: `{ stops, glow, haze, rays, stars, streak, sun:{core,disc,edge,glow,ray,flare,ghost}, cloud:{base,shadow,rim,deep}, light:{dir,key,rim,shade,ambient,ambientA,white,whiteShade,lights} }`
- `SEA_PRESETS[name]`: `{ far, mid, near, deep, lit, trough, line, lineA, foam, glitter, glow, glowA, horizonLine, reflect }`
- `mixPreset(a, b, p)` → `{ sky, sea, name, from, to, q }` · `resolve(preset)` · `skyOf` · `seaOf` · `lightOf`
- `litColor(hex, preset, k)` tiñe un color de marca con el ambiente del preset (para que el naranja no quede pegado).

```js
// atardecer que avanza: de dorado a sunset en 1,5 s
const P = mixPreset('golden', 'sunset', prog(t, 11.25, 12.75));
drawSky(ctx, t, { preset: P, horizonY: 640, sunX, sunY });
```

## 2. `sky.js` — `drawSky(ctx, t, { preset, horizonY, sunX, sunY, cam, stars, rays, haze, streaks, glow, depth })`

Degradé del preset, resplandor alrededor del sol, rayos suaves que giran (a baja resolución, bordes blandos),
nubecitas finas del horizonte que derivan, bruma y estrellas que titilan (night/dusk). Devuelve `{ hy, top, sun, zf }`
(`hy` = horizonte en pantalla). Ayudas: `skyPoint(cam, x, y)`, `horizonScreen(cam, horizonY)`.

| opción | def. | |
|---|---|---|
| `stars` | del preset | 0..1 |
| `rays` / `haze` / `glow` | 1 | multiplicadores (0 apaga) |
| `streaks` | 1 | nubecitas finas del horizonte |

## 3. `sun.js` — `drawSun(ctx, t, x, y, r, { preset, glow, rays, flare, flat, flatColor, horizon, corona, star, ghosts, pulse })`

Resplandor, corona, dos ruedas de rayos finos que giran en sentidos opuestos, disco con núcleo blanco que
«quema» el borde, estrellita de difracción y **flare anamórfico** (estría cálida + estría azul + fantasmas hacia el
centro del cuadro).

- `flare` 0..1.5 (def 0.5): subilo en los golpes (bocinazo, `close.final`).
- `flat` 0..1 + `flatColor`: lo lleva a un **disco liso** (match cut sol → pin: `flat: 1, flatColor: PAL.brandOrange`).
- `horizon`: y en pantalla; recorta el DISCO debajo (sol que se hunde). El resplandor sigue.
- `pulse` 0..1: latido (usá `beatPulse`).
- `drawFlare(ctx, t, x, y, r, k, preset)`: el flare suelto (barridos de luz).

## 4. `clouds.js` — `drawClouds(ctx, t, { preset, cam, depth, seed, y, density, scale, speed, spread, alpha, x0, x1, cluster, bands, cirrus })`

Una **capa** de nubes que deriva y da la vuelta. Lóbulos con panza **despareja** (la base ondula y deja asomar
lóbulos: no es una regla); 3 tonos (filo de luz del lado del sol, cuerpo, panza festoneada en sombra) + franja
profunda + grano. Cada forma se pinta una vez como sprite.

v2 (ronda de correcciones): nada de «papel tapiz».
- **Escala variada**: cada nube va de 0,5 a 1,6 × `scale` (las líderes 0,85–1,6; las acompañantes 0,5–0,9).
- **Grupos** (`cluster` def 1): una nube líder y 1–2 acompañantes solapadas detrás, más lavadas (perspectiva
  atmosférica); posiciones despares. `cluster: 0` = sueltas.
- **Densidad por banda** (`bands: [w0, w1, …]`): reparte las nubes en franjas horizontales con esos pesos (p. ej.
  `[1, 0.2, 0.6]` = muchas a la izquierda, casi nada en el medio, algunas a la derecha: deja aire para el sol o un
  titular).
- **Cirros** (`cirrus` 0..1): estelas finas detrás de la capa.

Parámetros recomendados (3 capas, de lejos a cerca):

| preset | lejos (horizonte) | medio | cerca (arriba) |
|---|---|---|---|
| `day` / `golden` | `depth 0.1, y 560, scale 0.4, alpha 0.7, density 1.4, spread 50, cirrus 0.5` | `depth 0.16, y 420, scale 0.7, alpha 0.9, density 0.9, bands [1, 0.3, 1]` | `depth 0.24, y 230, scale 1.1, density 0.5, spread 140, bands [1, 0, 0.8]` |
| `sunset` / `dusk` | `depth 0.1, y 600, scale 0.45, alpha 0.8, density 1.6, cirrus 0.8` (estiradas, finas) | `depth 0.16, y 470, scale 0.8, density 0.8, bands [1, 0.15, 1]` (el sol en el medio) | `depth 0.24, y 200, scale 1.3, density 0.4, alpha 0.95` |
| `night` | `depth 0.1, y 560, scale 0.5, alpha 0.5, density 0.8` | `depth 0.18, y 380, scale 0.9, alpha 0.6, density 0.5` | — |

```js
drawClouds(ctx, t, { preset, cam, depth: 0.1,  seed: 3, y: 560, scale: 0.4, alpha: 0.7, density: 1.4, spread: 50, cirrus: 0.5 });
drawClouds(ctx, t, { preset, cam, depth: 0.16, seed: 2, y: 420, scale: 0.7, alpha: 0.92, density: 0.9, bands: [1, 0.3, 1] });
drawClouds(ctx, t, { preset, cam, depth: 0.24, seed: 1, y: 230, scale: 1.1, density: 0.5, spread: 140, bands: [1, 0, 0.8] });
```
`density` 1 ≈ 4 nubes por capa. Con `mixPreset` funde los sprites de los dos presets. `initClouds(seeds, presets)`
los precalcula (o `initArt({ clouds: [...] })`). Muestras en contexto: `shots/art/clouds-v2/` (3,9 · 11,35 · 29,9).

## 5. `ocean.js` — `drawOcean(ctx, t, { preset, horizonY, cam, glitter, sunX, sunY, swell, foam, rows, speed, lines })`

Mar del horizonte para abajo: ~22 filas de oleaje en perspectiva, **cada una en su plano** (parallax de suelo: las
de adelante se mueven y crecen más en un push-in). Por fila: cara iluminada en degradé, crestas en punta, filos de
brillo afinados que viajan, espuma en las crestas cercanas, columna de luz del sol y destellos que titilan (con
estrellitas en los más fuertes). Más chico, junto y claro hacia el horizonte.

| opción | def. | |
|---|---|---|
| `swell` | 1 | alto de las olas (0,5 calmo · 1,5 picado) |
| `glitter` | 1 | destellos + columna de luz (necesita `sunX`) |
| `foam` / `lines` | 1 | espuma de crestas / filos de brillo |
| `speed` | 1 | velocidad del mar |

Ayudas: `seaDepth(y, horizonY)` (profundidad de algo que flota en y), `seaFrac(y, horizonY)`.

## 6. `ship.js` — EL CRUCERO

`drawShip(ctx, t, { x, y, scale, dir, wake, bowWave, reflect, smoke, horn, lights, preset, detail, speed, bob, wind, wakeLen })`

Crucero moderno de perfil: casco navy con **línea de flotación cian**, librea de marca (ola cian + filete naranja),
ojos de buey y ventanas, ancla; 10 cubiertas blancas con popa en terrazas y frente redondeado, balcones en hileras
(vidrio, baranda, aletas, columnas), ventanales, puente con alerones; galería con **botes salvavidas naranjas**;
**chimenea naranja de marca con banda cian** y el pin; cúpula de vidrio, sombrillas, **toboganes de colores**,
mástil con radares que giran. Reflejo cortado por ondas, sombra de contacto, **estela en V** con espuma que se
queda en el agua, **ola de proa** con spray, humo y **soplo de bocinazo**.

- `(x, y)`: **medio del barco sobre la línea de flotación**. `scale` 1 = 1000 px de eslora. `dir` 1 = proa a la derecha.
- `detail`: automático (0 lejos < 480 px · 1 medio · 2 cerca). De cerca los ojos de buey se dibujan con `drawPorthole`.
- `horn: tDelBocinazo` → **bocinazo** (ver abajo); `hornDir` (rad, coordenadas locales; def −2,0 = arriba y hacia
  popa) y `hornCurl` (±1). `smoke` 0..1: humo continuo en **bocanadas encadenadas** pegadas a la boca de la chimenea
  (3 tonos: sombra fría, base, filo cálido), que crecen, derivan con el viento (`wind`) y se desvanecen.
- **`drawHorn(ctx, t, tHorn, { x, y, scale, dir, curl, wind, light, preset, alpha })`**: el bocinazo suelto, donde esté
  parado el ctx. Mini flash en el silbato (pico tHorn + 0,02), dos anillos de presión y un **chorro blanco con rulo**
  que llega a su largo en tHorn + 0,06 (≈ 2,2 × el alto de la chimenea con `scale` = escala del barco), se corta del
  silbato desde + 0,32 y se abre en nube que se lleva el viento hasta + 1,55. `dir` en rad (0 = derecha, −π/2 = arriba).
  ```js
  // HOOK · reveal.horn: el soplo hacia la derecha y arriba, lejos del titular (en pantalla, con la pose del barco o)
  const [hx, hy] = shipPoint(o, SHIP.horn.x, SHIP.horn.y, t);
  drawHorn(ctx, t, cue('reveal.horn'), { x: hx, y: hy, scale: o.scale, dir: -1.1, curl: -1, preset: 'golden', light: [0.76, -0.64] });
  ```
  Muestras: `shots/art/smoke-v2/sheet.jpg` (4,6–5,0, golden y day) y `t04.760-960.png` (el pico a 960×540).
- `drawSmoke(ctx, t, { x, y, amt, wind, light, preset })`: el humo suelto (unidades del barco).
- `lights` 0..1 (def. del preset: dusk/night 1, **sunset 0,8**) → cabinas y ojos de buey encendidos.
- v2: **pin de marca** grande en la chimenea (cabeza ~40 unidades: ≥ 22 px con el barco de 550 px; contorno blanco,
  cielo, mar cian y crucero como el favicon); **filo cálido** (`warmRim`) en la roda y en los frentes/bordes que miran
  a la luz; **estela en V** de 1,5 esloras por defecto (`wakeLen` 1500) que se abre más y se tiñe con el mar del
  preset; **tobogán** simplificado a 2 lazos claros en `detail` 0–1; casco de cerca con **soldaduras** (línea oscura
  de 1 px + canto claro, chapas trabadas como ladrillos) y remaches solo en las uniones. Muestras: `shots/art/ship-v2/`.
- `bob` cabeceo (def 1). `speed` del agua (unidades/s, def 60) mueve la estela y la espuma.

**`SHIP`** (coordenadas locales: eslora 1000, x −500 popa → +500 proa, flotación y = 0, arriba negativo):
`length`, `height` (~263, a los caños), `airDraft` (al mástil), `bbox`, `bow`, `stern`, `stemWaterline`, `deckTop`,
`funnel {x, y, top, x0, x1, base}`, `horn`, `smoke`, `mast`, `boats`, **`portholes: [{x, y, r}]`** y **`hero`** (índice
del ojo de buey recomendado: a proa, sobre casco navy limpio).

Ayudas:
- `shipPoint(o, lx, ly, t?)` → punto local en pantalla (con `t` incluye el cabeceo).
- `shipPorthole(o, i, t?)` → `{ x, y, r }` del ojo de buey i.
- `shipPoseFor(i, cx, cy, r, dir)` → `{ x, y, scale }` para que el ojo de buey i quede en (cx, cy) con radio r.
- **`shipZoom(o0, k, { i, cx, cy, r })`** → opciones de drawShip para el push-in en el progreso k (escala en log, el ojo
  de buey viaja recto al centro, el cabeceo se apaga). **Con k = 1 el vidrio queda exacto en (960, 540) r = 300.**

```js
// HOOK · reveal.push (5,156 → 5,625): empuje al ojo de buey
const START = { x: 1150, y: 662, scale: 0.34, preset: 'golden', horn: cue('reveal.horn') };
const k = E.inExpo(prog(t, cue('reveal.push'), 5.625));   // o tu curva con anticipación
drawShip(ctx, t, shipZoom(START, k));
// en 5,625 rematá con el ojo de buey limpio (idéntico al del casco):
drawPorthole(ctx, t, 960, 540, 300, { preset: 'golden' });
```
Ver `shots/art/pushin/sheet.jpg`.

## 7. `porthole.js` — `drawPorthole(ctx, t, cx, cy, r, { preset, glass, rimOnly, inside, ring, spin, hull, drops, sweep, lit, shadow, lightDir })`

v2: el vidrio refleja **nubes con silueta** y el brillo del sol en diagonal; las gotas son **pares brillo + sombra**
(lente de agua), sin discos grises. Aro blanco/plateado con bisel (filo de luz y sombra según la luz), ranura maquinada, burlete, **8 bulones** con
brillo, sombra del aro sobre el casco; vidrio que refleja cielo y mar (horizonte curvo), nubes reflejadas, **brillo
diagonal**, sombra interior, gotitas (una resbala) y destello que late.

- `r` = **radio del vidrio**; el aro llega a `r·(1 + ring)` (ring def 0.3 → 390 px con r = 300).
- `rimOnly: true` → solo el aro (para el borde del iris de DECK-A). `spin` rota el aro (bulones).
- `inside(ctx)` → lo que se ve a través (recortado al vidrio); `glass` 0..1 opacidad del reflejo encima.
- `sweep` 0..1 pasa un brillo extra · `lit` 0..1 luz cálida de adentro (noche) · `hull: color` placa alrededor.

```js
// DECK-A · iris de 5,625: máscara = círculo R(t); over = el aro
mask(ctx, t) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(960, 540, R(t), 0, Math.PI * 2); ctx.fill(); }
over(ctx, t) { drawPorthole(ctx, t, 960, 540, R(t), { preset: 'golden', rimOnly: true, spin: -0.4 * (t - 5.625) }); }
```

## 8. `wave.js` — LA OLA (las dos transiciones) · v3 (barril que rompe)

El CUÁNDO está en `src/scenes/waves.js` (`HOOK_WAVE`, `CLOSE_WAVE`: `p(t)`, `dir`). Acá vive la FORMA:

- **`drawWaveMask(ctx, p, { dir, seed, inverse, color })`**: pinta la región **ya cubierta** (lo que la ola pasó =
  escena nueva). `inverse: true` pinta lo contrario (lo que todavía no tapó el agua).
- **`drawWaveCrest(ctx, t, p, { dir, seed, preset, spray, foam, shadow })`**: el cuerpo de la ola encima de todo.
- Con el mismo `p`, `dir` y `seed`, **el borde de la máscara y el frente del agua son el mismo trazo** (el mismo
  Path2D): en la zona del frente, máx(alfa máscara − alfa agua) = 7/255 y 0 píxeles > 8/255
  (`node src/art/_tools/wcheck.mjs`).
- `dir`: `'rtl'` (entra por la derecha) · `'ltr'` · `'up'` (sube desde abajo).
- `preset`: el de la escena NUEVA (la luz viene de atrás de la ola: labio a contraluz; tiñe filos y la espalda).

**Forma v3** (pulido final). Alto transversal `Hc = 0,9 × cuadro`, corrida 0,04 hacia abajo (cresta en y ≈ 115).
El frente es UN trazo: base → pie (rampa) → **cara cóncava** → garganta → **panza** (techo del tubo) → **punta**
enroscada → nariz → **lomo** → cresta; atrás, la **loma**.

| pieza | cómo es |
|---|---|
| labio | se LANZA hacia adelante con vuelo (`thr` 0,72 → 1,04 con p: arranca recogido y en p ≈ 0,45 ya voló entero); lengua que se afina hacia la punta, que se curva hacia abajo y se **enrosca hacia adentro** (rulo). Lomo aqua a contraluz, cara ocean400, **panza oscura** que se afina en la garganta; filo brillante, encaje que rompe en la punta, **espuma que se desprende** (manchas que vuelan y caen girando), hilos que cuelgan, cortina de hilos de spray y gotas que caen al hueco |
| tubo | **hueco ABIERTO** bajo el labio: ahí todavía se ve la escena vieja (no la cubre la máscara), en la sombra del labio (penumbra ink) y con bruma de spray. Penumbra teal en la garganta (bajo la panza y en lo alto de la cara) |
| cara | **cóncava** (rampa desde el pie → pared casi vertical → se mete bajo el labio), degradé **teal sin navy** (`faceHi` aqua → `face1` → `face2` ocean500 → `faceLo` ocean600) + bandas concéntricas al hueco; brillo fino en el borde, vetas y estrías de encaje que suben |
| espalda | **loma inclinada** (≈50°, hombro redondo, pie cóncavo) que baja desde la cresta hasta el horizonte (v ≈ 0,62) con filo de contraluz y líneas de oleaje; se tiñe al mar del preset entrante |
| cuerpo | **OPACO**: nada se ve a través. El fundido (alfa 1 → 0) es una banda INCLINADA `s = 0,966·u + 0,258·v` entre 0,49 y 0,575: la loma queda opaca contra el cielo y abajo el cuerpo se funde antes con el mar entrante. Nada visible pasa de u ≈ 0,41 (sale entera en p = 1) |
| base | espuma de **encaje** (water.js) en dos filas que se abren hacia adelante con el labio, spray direccional y bruma |
| cresta | penacho de spray que el viento levanta: tapa la costura de la máscara arriba de la cresta |

- `waveGeom(p, { dir, seed })` devuelve `{ X, Hc, Y0, front, mask, inverse, water, face, belly, lomo, back, nose, curl, T, B, crest, hollow, toC, prof }` (coordenadas canónicas). `front` sigue siendo la polilínea del borde (de abajo hacia arriba), como la usa TYPE. **v3 sacó `wall` y `curtain`** (nadie fuera de ART los usaba) y sumó `face` (garganta → pie) y `hollow` (centro del hueco).
- `waveFrontX(p, dir)` **no cambió** (mismos px que v1): los tiempos de HOOK, TYPE y CLOSE siguen valiendo. Lo más
  adelantado (la nariz) llega a X − 0,51·Hc ≈ X − 496 px (dentro del recorte X − 500 de reveal-sea); lo más atrasado del
  frente (cresta) queda en X − 97 px (dentro del recorte X + 180 de hook-office). Escena nueva visible en el drop:
  **75,2 %** en 3,75 y **82,3 %** en 26,25 (v2: 72,6 % y 79,7 %).
- `waveColors(preset)` (paleta de la ola) vive en `water.js` y se re-exporta acá. v3 sumó `faceHi` y `faceLo`; `face3`
  (navy) queda para el reventón de HOOK, la ola ya no lo usa.

```js
import { HOOK_WAVE } from '../scenes/waves.js';
// reveal-sea (escena nueva):
mask(ctx, t) { drawWaveMask(ctx, HOOK_WAVE.p(t), { dir: HOOK_WAVE.dir }); },
over(ctx, t) { drawWaveCrest(ctx, t, HOOK_WAVE.p(t), { dir: HOOK_WAVE.dir, preset: 'golden' }); },
// type-hook (el agua se lleva el texto): recortá tu texto con la máscara INVERSA
masked(ctx, (c) => drawMyText(c, t), (c) => drawWaveMask(c, HOOK_WAVE.p(t), { dir: HOOK_WAVE.dir, inverse: true }));
// close (segunda ola, sentido contrario, luz de atardecer):
over(ctx, t) { drawWaveCrest(ctx, t, CLOSE_WAVE.p(t), { dir: CLOSE_WAVE.dir, preset: 'sunset' }); }
```
Muestras v3: `shots/art/wave-v3/` (`before/` = v2 · `r1/` y `r2/` a 1920 · `fr-hook/` y `fr-close/` cuadro a cuadro a
60 fps, con grillas `g*.jpg`). Banco aislado a p fijo (ART_WMODE=dbg dibuja las polilíneas):
`node src/art/_tools/sbx.mjs --module=src/art/_wave3.js --t=0.3,0.5,0.62,0.76 --out=shots/art/wave-v3/iso` (ART_WAVE=close).

## 9. `gulls.js` — `drawGulls(ctx, t, { count, area, seed, scale, preset, silhouette, dir, speed, alpha })`

Gaviotas en «M» de 3/4 con brazo y mano articulados, ráfagas de aleteo y planeos, pico dorado, puntas oscuras,
filo de luz. En sunset/dusk/night pasan a **silueta** navy con filo cálido. `area = { x, y, w, h }`; `scale` 1 ≈ 110
px de envergadura; `dir` 1/−1/0. `gull(ctx, x, y, R, flap, dir, col, sil)` dibuja una suelta.

## 10. `tropics.js`

- `drawPalm(ctx, t, x, y, h, { lean, sway, seed, fronds, coconuts, preset, silhouette })`: pie del tronco en (x, y),
  alto h. Tronco curvo anillado (3 tonos), hojas plumosas que se balancean con la punta atrasada, cocos.
- `drawIsland(ctx, t, x, y, s, { preset, palms, seed, hut })`: centro sobre la línea de agua; s = 1 ≈ 560 px. Bajío
  turquesa con espuma que respira, arena con orilla mojada, morro verde, 1–4 palmeras, choza opcional.
- `TROPIC`: verdes y marrones del kit (únicos tonos fuera de `PAL`, derivados para armonizar con el mar).

## 11. `water.js` — VOCABULARIO DE AGUA (lo comparten la ola, HOOK y DECK-A)

Un solo idioma para toda el agua de la pieza: **espuma = encaje** (manchas irregulares con agujeros reales, sombra
plana, sin contornos), **gota = cuerpo + medialuna de sombra + brillo + especular**, **spray = abanico direccional de
gotitas estiradas + bruma**, **splash = cráter → lámina en anillo (corona) → chorro central → anillos → espuma que
queda flotando**. Nada de dientes de sierra, facetas, anillos de puntos ni burbujas con contorno.

```js
import { waveColors, drawFoamLace, drawDroplets, drawDrop, drawSpray, drawSplash } from '../../art/index.js';
// (también: import { … } from '../../art/water.js' o '../../art/fxkit.js')
```

| función | qué hace |
|---|---|
| `waveColors(preset)` | Paleta del agua (la de la ola) teñida por la luz del preset: `lipBack lipFace lipBelly edge face1 face2 face3 throat wall back backDeep foam foamShade foamDeep hole drop dropShade glow rim spark light` (`light` = [x,y] hacia la luz). Cacheada. |
| `drawFoamLace(ctx, t, path, o)` | Banda de **encaje** a lo largo de la polilínea `path` ([[x,y]…]). `o = { width 60, seed, density 1, holes 0.55, rag 1, side 0, taper [0.12,0.12], flow 0 (px/s), boil 1, closed, preset, color, shade, deep, light, alpha, shadow 1 }`. Es la MISMA espuma de la base y el labio de la ola. |
| `drawDrop(ctx, x, y, r, vx, vy, o)` | Una gota (lágrima estirada por la velocidad, 3 tonos + especular). `o = { preset, light, color, shade, alpha, stretch }`. |
| `drawDroplets(ctx, t, area, p, o)` | Gotas que salen de `area` `{x,y,w,h}` y vuelan en parábola mientras `p` 0 → 1. `o = { count 24, seed, angle -π/2, spread 0.9, speed 900, gravity 1800, size 7, sizeVar 0.7, delay 0.25, life 0.75, preset, light, alpha, stretch }`. |
| `drawSpray(ctx, t, x, y, dir, p, o)` | Spray direccional desde (x, y) hacia `dir` (rad). `o = { spread 0.55, count 60, speed 700, gravity 900, size 3.2, seed, mist 0.6, big 0.15, life 0.8, preset, color, alpha }`. |
| `drawSplash(ctx, t, x, y, p, o)` | Salpicadura de impacto en (x, y). `p` 0..1 = vida (0,9–1,4 s). `o = { size 120 (radio de la corona; probado 60–450), tilt 0.38 (1 = cenital), seed, preset, drops 26, ring, crown, column, foam, flash, color, shade }`. |

```js
// HOOK · el monitor revienta (3,28): spray hacia adelante + gotas + encaje en el borde de la pantalla
const p = prog(t, T.surge, T.surge + 0.6);
drawSpray(ctx, t, 1500, 520, Math.PI * 1.08, p, { preset: 'golden', count: 90, speed: 1200, size: 4, mist: 0.8 });
drawDroplets(ctx, t, { x: 1380, y: 600, w: 260, h: 20 }, p, { angle: -2.2, spread: 1.2, size: 10, preset: 'golden' });
drawFoamLace(ctx, t, [[1300, 690], [1450, 700], [1620, 688]], { width: 46, seed: 4, flow: 60, preset: 'golden' });

// DECK-A · splash del tobogán (exp.slide 6,56) en vista cenital (tilt alto), escala 180 px
drawSplash(ctx, t, sx, sy, prog(t, cue('exp.slide'), cue('exp.slide') + 1.1), { size: 180, tilt: 0.8, preset: 'day', seed: 4 });
```
Hoja: `shots/art/water-kit/sheet.jpg` (encaje, gotas, spray y splash 80 / 200 / 450 con `day` y `golden`).
Regenerar: `node tools/sandbox.mjs --module=src/art/_water-kit.js --t=0.12,0.3,0.55,0.85,10.25,10.5,100.12,100.3,100.55,100.85,110.25,110.5 --sheet --cols=3 --thumb=640 --out=shots/art/water-kit`.

## 12. `fxkit.js`

- `drawGlitter(ctx, t, area, { density, seed, color, size, rate, alpha })`: destellos que titilan.
- `drawConfetti(ctx, t, area, p, { count, colors, seed, gravity, size, spin })`: papelitos con giro 3D falso.
- `drawHalo(ctx, x, y, r, color, a)`: halo aditivo (velas, reflectores, guirnaldas).
- Re-exporta el agua de `water.js` (`drawSplash`, `drawFoamLace`, `drawDroplets`, `drawSpray`, `drawDrop`, `waveColors`).

Son genéricos: si tu escena necesita uno mejor, avisá y ART lo adopta en el pulido.

## 13. `figure.js` — HOJA DE FIGURA HUMANA (la siguen DECK-A, DECK-B y VALUE)

Toda la gente de la pieza sale del mismo estudio. Reglas (aunque dibujes tu propia figura, respetalas):

| regla | valor |
|---|---|
| proporción cabeza / alto total | **adulto 1:6,5** · **personaje-ícono 1:3** (`FIG.adult`, `FIG.icon`, en altos de cabeza H) |
| miembros | con forma: **muslo más ancho que la pantorrilla** (0,66 → 0,37 → 0,21 H), **brazo más ancho que el antebrazo** (0,38 → 0,28 → 0,19 H), panza en gemelo / antebrazo / bíceps, **rodilla y codo insinuados** (cintura en la articulación + arquito de sombra desde 300 px) |
| manos | **pulgar separado** ~40°: adulto = mitón + pulgar (separación de dedos insinuada); ícono = **4 dedos + pulgar** |
| piel | **3 tonos**: base, sombra ~20 % del ancho del lado opuesto a la luz (`skinTones(base)`: 24 % más oscura y cálida), filo de luz 2–3 px |
| pelo | gorro + **3–4 mechones** afinados + **brillo** en arco (`HAIRS`: base, dark, light) |
| contraluz | base **navy800** (ropa hacia ink) y **filo dorado de 2–4 px** del lado del sol; sin cara ni sombra interna |
| ropa | la misma regla de 3 tonos (`clothTones`) |

API (todo en coordenadas de pantalla, pies en (x, y)):
- **`drawFigure(ctx, t, { type 'adult'|'icon', x, y, h, skin, hair, hairStyle 'short'|'long'|'bun', top, bottom, skirt, swim, shoes, pose: { armL:[hombro,codo], armR, legL:[cadera,rodilla], legR }, backlit, preset | L, face, glasses, armsFront, rimW, sway })`** → `{ hands, head }`. Ángulos en rad: 0 = colgando, + = hacia afuera.
- **`limbRing(pts, widths, { bulge, waist })`**: miembro afinado (articulaciones + anchos) como anillo de puntos.
- **`drawHand(ctx, x, y, ang, size, { icon, side, tones, L, backlit })`**: mano desde la muñeca hacia `ang`.
- **`paint3(ctx, ring, tones, { L, shadeW, rimW, backlit })`**: pinta cualquier anillo en 3 tonos (base, sombra, filo).
- `ringPath`, `ellipseRing`, `skinTones`, `clothTones`, `SKINS`, `HAIRS`, `FIG`.

```js
import { drawFigure, SKINS, HAIRS } from '../../art/figure.js';
// DECK-B · pareja del atardecer a contraluz (el sol a la derecha)
drawFigure(ctx, t, { x: 700, y: 900, h: 300, backlit: true, L: [0.95, -0.3], hairStyle: 'long', skirt: true });
// VALUE · especialista personaje-ícono, 1:3, saludando
drawFigure(ctx, t, { type: 'icon', x: 960, y: 1000, h: 520, skin: SKINS[1], hair: HAIRS[0], top: '#FFFFFF', bottom: '#0F3157', pose: { armR: [2.6, 0.5] }, preset: 'day' });
```
Hoja: `shots/art/figure-sheet/sheet.jpg` (adulto a la luz, adulto a contraluz y personaje-ícono, en 3 tamaños, más
manos en detalle). Regenerar: `node tools/sandbox.mjs --module=src/art/_figure-sheet.js --t=0,1,2 --sheet --cols=1 --thumb=1280 --out=shots/art/figure-sheet`.

---

## Rendimiento (Node, 1920×1080, dibujo + rasterizado)

| pieza | ms aprox. |
|---|---|
| cielo (con rayos) | 12–15 |
| sol con flare | 5–7 |
| 3 capas de nubes (sprites armados) | 8–12 |
| mar | 20–25 |
| barco lejos (~340 px) | 12–15 |
| barco mediano (~1000 px, con reflejo, estela y bocinazo) | 30–38 |
| barco de cerca ×6,5 | 55–60 (solo procesa los tramos en cuadro) |
| macro ojo de buey (shipZoom k = 1) | 30–35 |
| ola v3 (máscara + cresta, foam 1,2 · spray 1,35) | máscara ≈ 3 · cresta ≈ 45 (mediana, `wprof.mjs`) |
| encaje (una banda de ~700 px) | 3–4 |
| splash 200 px | 4–6 |
| gaviotas ×6 | 2–3 |
| isla con 3 palmeras | 12–16 |
| ojo de buey r = 300 | 10–12 |

El primer cuadro que usa un preset de nubes arma sus sprites (~40 ms): llamá `initArt({ clouds: [...] })` en `init()`.
Medí con `ART_PROF=<pieza> node src/art/_tools/sbx.mjs --module=src/art/_prof.js --from=0 --to=1 --step=0.1 --only-sheet --quiet`.

## Muestras

`src/art/_tools/sbx.mjs` es el banco de pruebas de ART (igual a `tools/sandbox.mjs` pero sin arrancar las escenas de
los demás, para que un archivo ajeno roto no frene las muestras):

```
node src/art/_tools/sbx.mjs --module=src/art/_sheet-sea.js --t=1 --out=shots/art/sea
node src/art/_tools/sbx.mjs --module=src/art/_wave.js --from=3.5 --to=3.875 --step=0.016667 --sheet --cols=6 --out=shots/art/wave-sheet
ART_WAVE=close node src/art/_tools/sbx.mjs --module=src/art/_wave.js --from=25.98 --to=26.36 --step=0.016667 --sheet --cols=6 --out=shots/art/wave-close
ART_SHOT=mid node src/art/_tools/sbx.mjs --module=src/art/_ship.js --t=1 --out=shots/art/ship-mid   (far | close | macro | dusk | sunset)
node src/art/_tools/sbx.mjs --module=src/art/_pushin.js --from=0 --to=1 --step=0.0909 --sheet --cols=4 --out=shots/art/pushin
node src/art/_tools/sbx.mjs --module=src/art/_porthole.js --t=1 --out=shots/art/porthole
node src/art/_tools/sbx.mjs --module=src/art/_clouds.js --t=2 --out=shots/art/clouds
node src/art/_tools/sbx.mjs --module=src/art/_gulls.js --t=1.3 --out=shots/art/gulls
node src/art/_tools/sbx.mjs --module=src/art/_tropics.js --t=1.7 --out=shots/art/tropics
node src/art/_tools/sbx.mjs --module=src/art/_cuts.js --t=1.2 --out=shots/art/cuts          (ola 'up', máscara inversa, iris, sol → disco)
ART_SC=reveal node src/art/_tools/sbx.mjs --module=src/art/_showcase.js --t=2 --out=shots/art/show-reveal   (sunset | close | dusk)
node src/art/_tools/sbx.mjs --module=src/art/_horn.js --from=0.2 --to=1.8 --step=0.2 --sheet --cols=3 --out=shots/art/horn
# v2 (ronda de correcciones)
node tools/sandbox.mjs --module=src/art/_water-kit.js --t=0.12,0.3,0.55,0.85,10.25,10.5,100.12,100.3,100.55,100.85,110.25,110.5 --sheet --cols=3 --thumb=640 --out=shots/art/water-kit
node src/art/_tools/sbx.mjs --module=src/art/_wave2.js --t=0.2,0.35,0.5,0.62,0.76,0.9 --sheet --cols=3 --out=shots/art/wave-v2/iso   (ART_WAVE=close | up)
node tools/sandbox.mjs --module=src/art/_horn2.js --t=4.6,4.69,4.72,4.76,4.8,4.9,5.0,104.6,104.72,104.76,104.8,105.0 --sheet --cols=4 --thumb=480 --out=shots/art/smoke-v2
node tools/sandbox.mjs --module=src/art/_figure-sheet.js --t=0,1,2 --sheet --cols=1 --thumb=1280 --out=shots/art/figure-sheet
node tools/sandbox.mjs --module=src/art/_ship2.js --t=0,1,2,3 --sheet --cols=2 --thumb=960 --out=shots/art/ship-v2
node src/art/_tools/wprof.mjs        (costo de la ola por piezas)   ·   node src/art/_tools/lprof.mjs   (costo del encaje)
node src/art/_tools/wcheck.mjs       (ola: máscara = agua al píxel + % de escena nueva visible en cada drop)
```
