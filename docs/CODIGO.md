# El código

Cómo está hecho el video por dentro y cómo cambiar cosas. Para la historia de cómo se produjo, ver
[`PROCESO.md`](PROCESO.md). Para el contrato creativo (storyboard, tiempos, estilo), ver [`PLAN.md`](PLAN.md).

## 1. La idea en una línea

Cada cuadro del video es **una función pura del tiempo `t`**: `dibujar(t)` siempre produce exactamente la misma imagen.
Por eso:
- el mismo código sirve para la vista previa en vivo (navegador) y para el render final (Node);
- el render se reparte en muchos procesos, en cualquier orden;
- un cambio afecta solo lo que se tocó, y se puede comprobar al píxel.

```
src/cues.json ──► tiempos de los 65 golpes ──┬──► escenas (src/scenes) ──► compositor ──► fx + grano ──► cuadro
 (128 BPM, 30 s)                             │        dibujan en t            (máscaras,   (flash, sacudón,
                                             │                                  olas)        punch, viñeta)
                                             └──► audio (audio/*.py): música + efectos que caen en esos mismos t
```

| Dónde corre | Cómo | Para qué |
|---|---|---|
| Navegador | Vite (`npm run dev`, puerto 5181) dibuja en un `<canvas>` con la música | Vista previa en vivo |
| Node | `@napi-rs/canvas` (Skia, el mismo motor gráfico que Chrome); las herramientas de `tools/` piden cuadros y los mandan a ffmpeg | Render final, cuadros sueltos, verificación |

## 2. El motor (`src/engine/`, ~1.600 líneas)

| módulo | qué hace | lo más usado |
|---|---|---|
| `time.js` | Grilla musical y cues; formato 16:9 o 9:16 | `cue('id')`, `b(compás, beat)`, `BEAT`, `beatPulse()`, `W`, `H`, `VERTICAL` |
| `ease.js` | Curvas de movimiento | `E.*` (easings), `kf()` (keyframes), `spring()` (resorte con overshoot), `pop()`, `anticip()`, `seg()`, `prog()` |
| `noise.js` | Azar determinista (prohibido `Math.random`) | `rng(seed)`, `hash()`, `noise1/2`, `fbm`, `drift()` |
| `color.js` | Paleta oficial y mezclas | `PAL`, `rgba()`, `mix()`, `shade()` |
| `draw.js` | Formas, degradés, grupos, efectos de capa | `P()`, `smoothPath()`, `group()`, `lin()`, `rad()`, `glow()`, `blurred()`, `smear()`, `masked()`, `texture()`, `sparkle()`, `lightSweep()`, `lensFlare()`, `bake()` |
| `camera.js` | Cámara 2.5D con parallax por profundidad | `plane(ctx, cam, depth, fn)`, `applyCam()`, `toScreen()`, `handheld()` |
| `text.js` | Tipografía cinética: mide una vez y anima por letra, palabra o línea | `txt()`, `drawText()` (rise, slam, pop, drop, stretch, type, focus; extrusión 3D, degradé, barrido de luz, subrayado), `drawChip()` |
| `fx.js` | Golpes de pantalla leídos de `cues[].fx` | flash, sacudón, punch y RGB; `addFx()` |
| `grade.js` | Grano de película y viñeta | `addGrade()` |
| `layer.js` | Lienzos de trabajo reciclados por cuadro | `layer()`, `layerHalf()` |
| `compositor.js` | Arma el cuadro con las escenas activas | `renderFrame(ctx, t)` |
| `env.js` | Diferencias navegador/Node | `makeCanvas()`, `loadImage()` |

### Contrato de una escena

```js
export default {
  id: 'pool', team: 'DECK-A',
  from: 5.625, to: 7.5, z: 30,        // ventana activa y orden de dibujo
  async init() {},                     // precálculos: caminos, cachés, imágenes (una sola vez)
  draw(ctx, t) {},                     // pinta la escena completa en t
  mask(ctx, t) {},                     // opcional: recorta la escena (iris, ola)
  maskUntil: 5.88,                     // opcional: después de esto no se paga la máscara
  over(ctx, t) {},                     // opcional: se pinta encima (borde del iris, cresta de la ola)
};
```

Las escenas se registran en `src/scenes/index.js`. Ahí también están `OVER_ABOVE`, las escenas cuya cresta se
pinta encima de los titulares, y las ventanas que fija el director.

**Reglas**:
- Nada de `Math.random()` ni `Date`.
- Todo lo fijo se precalcula en `init()`.
- Nunca se leen píxeles en `draw()`.
- El texto se mide en `init()`.

## 3. Escenas

| tiempo | escena (`src/scenes/`) | carpeta de módulos | qué dibuja |
|---|---|---|---|
| 0–3,98 | `hook-office.js` | `hook/` (21 módulos: `calendar`, `clock`, `monitor`, `beach`, `burst`, `leak`, `papers`, `city`, `desk`…) | Oficina gris: calendario que se arranca en cada beat, reloj que acelera y el agua que revienta del monitor |
| 3,5–5,9 | `reveal-sea.js` | `hook/reveal/` (`backdrop`, `ship`, `horn`, `swell`, `birds`, `lens`, `hull`, `zoomblur`…) | La primera ola, mar abierto con el crucero, bocinazo y el viaje al ojo de buey |
| 5,625–7,5 | `pool.js` | `deck-a/pool-*`, `slide`, `float`, `splash`, `crown`, `umbrella`, `lounger`… | Pileta cenital con tobogán y splash. Entra con un iris desde el ojo de buey |
| 7,5–9,375 | `dinner.js` | `deck-a/` (`plate`, `cloche`, `dish`, `bottle`, `glass`, `candle`, `hands`, `steam`…) | Cena gourmet: campana que se levanta, vino que se sirve y brindis |
| 9,375–11,25 | `show.js` | `deck-b/` (`roulette`, `chips`, `cards`, `casino`, `stage`, `curtain`, `dancer`, `beams`, `confetti`, `whip`…) | Ruleta, mesa de casino, látigo al escenario, bailarinas y papelitos |
| 11,25–13,125 | `sunset.js` | `deck-b/ss-*` (`ss-couple`, `ss-drinks`, `ss-rail`, `ss-lights`, `ss-exit`…) | Atardecer en cubierta con la pareja y los tragos; el sol se encoge hasta ser el pin |
| 13,125–20,625 | `map.js` | `map/` (`world`, `terrain`, `route`, `routegeo`, `pins`, `postcard`, `labels`, `lines`, `mapcam`…), `map/art/` (una postal por destino) | Mapamundi, ruta con barquito, pines con postales y navieras. Datos en `src/data/world.json` (`tools/build-map.mjs`) |
| 20,5–26,6 | `value.js` | `value/` (`suitcase`, `stickers`, `ticket`, `stamp`, `specialist`, `bubbles`, `wheel`, `beat-*`…) | Valija con stickers, tarjeta de embarque con contador y sello, especialista con chat |
| 26,0–30 | `close.js` | `close/` (`backdrop`, `lockup`, `pin-drop`, `cta`, `cta-glow`, `look`…) | Segunda ola, atardecer con el barco, logo, URL y botón de WhatsApp |
| 0–5,625 | `type-hook.js` | `type/` (`hook-grey`, `hook-sea`, `wave-clip`, `glyphs`, `style`…) | La pregunta del gancho. La ola se la lleva |
| 5,625–13,125 | `type-exp.js` | `type/` (`exp-title`, `plate`, `chips`, `icons`…) | «EXPERIENCIAS ÚNICAS EN CRUCERO», lockup y chips de escena |

Las **olas** de las transiciones toman su tiempo de `src/scenes/waves.js` (`HOOK_WAVE`, `CLOSE_WAVE`) y su forma de
`src/art/wave.js`. Así la máscara, la cresta y el texto que se lleva el agua coinciden al píxel.

**Kit compartido** (`src/art/`, documentado en `src/art/README.md`):
- `sky`, `sun`, `clouds`, `ocean` y `presets` (día, dorado, atardecer, dusk, noche)
- `ship` (el crucero, con 3 niveles de detalle)
- `wave`, `porthole` y `water` (splash, spray, espuma)
- `gulls`, `tropics`, `figure` y `fxkit`

**Marca** (`src/brand/`):
- `pin.js`: el pin del logo, en vector.
- `logo.js`: el logotipo vectorizado del PNG original, con cada letra animable.
- `whatsapp.js`: el ícono.

## 4. Audio (`audio/`, Python; detalle en `audio/README.md`)

| archivo | qué hace |
|---|---|
| `dsp.py` | Osciladores sin aliasing, filtros, envolventes, saturación, compresor y sidechain, reverb por convolución, delay, limitador true-peak, medición de loudness (BS.1770) |
| `instruments.py` | Bombo, clap, hats, shaker, congas, marimba, steel drum, plucks, pad, bajo, lead (flauta + vocal chop por formantes), risers y campanas |
| `arrangement.py` | El arreglo compás por compás (build filtrado, drop, estribillos, groove final y stinger), sobre la grilla de `cues.json` |
| `sfx.py` | Los 41 tipos de efectos (agua, papel, golpes, pops con altura, sello, bocina…), cada uno con su cresta en el cue |
| `build.py` | Buses, sidechain, reverbs, silencios y master a −14 LUFS → `public/audio/promo.wav` y stems |
| `analyze.py` | Verificación: duración, loudness, true peak (también en AAC), sincronía de cada efecto, silencios, final sin clic, determinismo y gráficos |

## 5. Render (`tools/render.mjs`)

1. La pieza se corta en **tramos de 10 cuadros** y van a una cola.
2. Hasta 10 procesos Node toman tramos. Cada uno arranca el motor, dibuja sus cuadros con **motion blur real** (6
   submuestras por cuadro, obturador de 180° hacia adelante, así los cortes en el beat quedan limpios), codifica un
   segmento H.264 y termina. Los procesos son cortos a propósito: la librería pierde memoria al leer píxeles.
3. ffmpeg une los segmentos sin recodificar y agrega la música con la duración exacta.

| comando | salida | tiempo (CPU de 32 hilos) |
|---|---|---|
| `node tools/render.mjs` | `out/promo-prime-cruceros.mp4` (1920×1080, 60 fps) | ~7 min |
| `node tools/render.mjs --draft [--from=A --to=B]` | `out/draft.mp4` (960×540, 30 fps, sin motion blur) | ~1 min la pieza completa |

## 6. Guía de cambios

Todo se cambia editando una o dos líneas y volviendo a renderizar. Después de cualquier cambio:

```bash
node tools/check.mjs
```

Verifica errores y determinismo de toda la pieza.

```bash
node tools/still.mjs --t=23.5 --out=shots/prueba
```

Muestra cómo quedó un cuadro.

```bash
node tools/render.mjs --draft
```

Arma un borrador rápido para ver el movimiento con música.

```bash
node tools/render.mjs
```

Hace el render final.

### Textos

| texto en pantalla | archivo |
|---|---|
| «¿Y SI / TUS PRÓXIMAS / VACACIONES…» | `src/scenes/type/hook-grey.js` |
| «…FUERAN EN / CRUCERO?» | `src/scenes/type/hook-sea.js` |
| «EXPERIENCIAS / ÚNICAS / EN CRUCERO» | `src/scenes/type/exp-title.js` |
| Chips «PILETAS Y TOBOGANES», «CENAS GOURMET»… | `src/scenes/type/chips.js` |
| LUNES … JUEVES (calendario) | `src/scenes/hook/calendar.js` |
| Destinos (URUGUAY, BRASIL, CARIBE, EUROPA, DUBÁI, ANTÁRTIDA, BUENOS AIRES) | `src/scenes/map.js`: `CARDS` (postales) y `ALL_LABELS` (rótulos de la red) |
| «TRANSATLÁNTICOS» | `src/scenes/map/labels.js` |
| «LAS MEJORES NAVIERAS» y los 6 nombres | `src/scenes/map/lines.js` |
| «HAY UN CRUCERO PARA CADA FORMA DE VIAJAR» | `src/scenes/value/beat-case.js` |
| Stickers «EN PAREJA», «EN FAMILIA», «CON AMIGOS» | `src/scenes/value/stickers.js` |
| «MINICRUCEROS» | `src/scenes/value/beat-pass.js` |
| Campos de la tarjeta (PASAJERO/A: VOS, SALIDA, EMBARQUE) | `src/scenes/value/ticket.js` |
| «ASESORAMIENTO…» y los globos de chat | `src/scenes/value/beat-pro.js` |
| URL «primecruceros.com.ar» | `src/scenes/close/lockup.js` |
| «CONSULTANOS POR WHATSAPP →» | `src/scenes/close/cta.js` |

Si un texto nuevo es mucho más largo, conviene mirar el cuadro: algunos bloques tienen el ancho calculado para el
texto actual.

### Precio

Está en dos lugares:
- **Sello**: `src/scenes/value/stamp.js`, el texto `'USD 355'`.
- **Contador que rueda**: `src/scenes/value/beat-pass.js`, en `odoAt()`. Rueda de 100 a `100 + 255`; para otro
  precio P, cambiar `255` por `P − 100`.

### Colores

- **Paleta global**: `src/engine/color.js` (`PAL`). Por ejemplo, `brandOrange` y `brandCyan` son los de la marca.
- **Botón de WhatsApp**: `src/scenes/close/cta.js`.

### Tiempos y golpes

Los 65 golpes están en **`src/cues.json`** y los leen la imagen y la música. Para mover uno:
1. Cambiar su `t` en `cues.json`.
2. Regenerar la música y verificarla:

   ```bash
   npm run audio
   ```

3. Renderizar.

La sección completa y la duración dependen de la grilla de 128 BPM. Cambiar el tempo implica rehacer las ventanas de
las escenas.

### Música

- **Arreglo, notas e instrumentos por compás**: `audio/arrangement.py`.
- **Volúmenes por instrumento**: `LEVEL` en `audio/build.py`.
- **Cada efecto de sonido**: `audio/sfx.py`.

Después de cualquier cambio de música, `npm run audio` regenera el WAV y falla si algo queda fuera de contrato
(loudness, pico, sincronía).

### Comprobar que un cambio NO tocó la imagen

```bash
node tools/fingerprint.mjs --out=huella.json
```

Guarda la huella antes del cambio: el md5 de 130 cuadros, uno cada medio beat más todos los cues.

```bash
node tools/fingerprint.mjs --compare=huella.json
```

Compara después del cambio. Si dice `ok: true`, los píxeles son idénticos.

### Versión vertical (9:16)

El motor y las herramientas ya aceptan `--format=9x16` (y `?format=9x16` en la vista previa). Para tenerla, cada
escena tiene que agregar su composición vertical (`if (VERTICAL) …`) siguiendo `docs/PLAN.md` §13. Hoy las escenas
solo tienen la composición 16:9.

## 7. Herramientas (`tools/`)

| herramienta | para qué |
|---|---|
| `still.mjs` | Cuadros sueltos y hojas de contactos (`--t`, `--from/--to/--step`, `--cues=prefijo`, `--sheet`, `--mblur`, `--safe`, `--format`) |
| `check.mjs` | Errores en toda la pieza, determinismo y ms por cuadro |
| `render.mjs` + `render-worker.mjs` | Render paralelo por tramos → ffmpeg |
| `energy.mjs` | Energía de movimiento por beat y salto de luz en los cortes, sobre un borrador |
| `fingerprint.mjs` | Huella de píxeles para comprobar que un cambio no alteró la imagen |
| `sandbox.mjs` | Dibuja un componente suelto (un módulo con `draw(ctx, t)`) sin arrancar las escenas |
| `build-map.mjs` | Regenera `src/data/world.json` desde Natural Earth |
| `node-env.mjs` | Arranque del motor en Node (fuentes, Skia, formato) |

Los archivos que empiezan con `_` dentro de `src/` son pruebas y mediciones que usaron los equipos durante la
producción. No forman parte del video.
