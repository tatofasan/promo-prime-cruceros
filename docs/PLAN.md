# Prime Cruceros — promo 30 s · contrato de producción

Este documento manda. Si algo no alcanza o está mal, se reporta al director; no se toca lo que es de otro equipo.

## 0. El encargo

Video promocional de **30 s** con motion graphics para **Prime Cruceros** (agencia argentina especializada en
cruceros, https://primecruceros.com.ar/). El objetivo es **vender la experiencia del crucero y generar consultas**,
no mostrar la web.

- **Nada de capturas de la web**: toda la pieza se construye con motion graphics originales. Por ejemplo:
  - un crucero estilizado cortando el océano, olas, sol, atardeceres y un ojo de buey
  - una ruta que se dibuja sola sobre un mapa, con pines
  - tarjeta de embarque y valija
  - pileta y tobogán, tragos
  - skylines de ciudades e islas tropicales
  - tipografía cinética contundente
- **Paleta**: navy profundo y azules océano, blanco, con acentos cálidos dorado y coral de atardecer.
- **Todo el texto en pantalla en español rioplatense** (voseo: «consultanos», «querés», «viajá»).
- **Música**: tropical house luminosa, alegre y con beat claro. El movimiento va con la música: los cortes, los
  pops, los barridos de ola y los pines caen en el beat. Se construye tensión durante el gancho y hay un **drop
  cuando aparece el barco**.
- **Calidad de producción profesional real, no demo ni prototipo.** El movimiento tiene que ser jugoso:
  - anticipación y overshoot
  - apariciones escalonadas
  - match cuts entre escenas
  - transiciones líquidas y de ola
  - profundidad con parallax
  - barridos de luz y flares de sol
  - push-ins de cámara y paneos suaves

**La vara**: cada cuadro congelado tiene que poder ir a un reel de motion design. Si una ilustración se ve «hecha así
no más» (formas simples sin sombreado, líneas uniformes, sin textura, sin capas), no está terminada. Para piezas de
venta en redes, «prolijo y tranquilo» se lee como flojo: tiene que haber energía, densidad de detalle y golpes
visibles en cada beat.

**Reglas de independencia (no negociables)**:
- Todo se hace **de cero dentro de esta carpeta** (`promo-prime-cruceros/`).
- **Prohibido abrir, leer o copiar archivos de otras carpetas de `Inspiracion/`** (promo-arcana, promo-electronica,
  latinecom-reel, etc.). Las librerías de npm/pip están permitidas.

## 1. Formato y grilla

| | |
|---|---|
| Cuadro | **1920×1080** (16:9) · 60 fps · **30,000 s** exactos (1800 cuadros) |
| Música | **128 BPM**: beat = **0,46875 s**, compás = **1,875 s** y 16 compases = 30 s |
| Grilla | `b(bar, beat)` en `src/engine/time.js`. El compás va desde 0 y el beat desde 1; admite fracciones (2.5 = corchea del 2) |
| Cues | `src/cues.json` es la **fuente única** de tiempos para imagen Y sonido. No se edita: lo cambia solo el director |

**Regla de sincronía**: el **cuadro de impacto** de cada golpe visual (aterrizaje, corte, pop en su pico, palabra
que pega) cae en el `t` de su cue (`cue('id')`). Las anticipaciones van ANTES del cue y los rebotes, DESPUÉS.

| Sección | Compases | Tiempo |
|---|---|---|
| Gancho (build) | c0–c1 | 0–3,75 |
| Ola / revelación (DROP) | c2 | 3,75–5,625 |
| Experiencia | c3–c6 | 5,625–13,125 |
| Destinos + navieras | c7–c10 | 13,125–20,625 |
| Valor | c11–c13 | 20,625–26,25 |
| Cierre | c14–c15 | 26,25–30 |

## 2. Motor (código del director: `src/engine/**`)

La pieza se dibuja con **Canvas 2D**. El mismo código corre en el navegador (vista previa en vivo con música,
`npm run dev`, puerto 5181) y en Node (render cuadro a cuadro con Skia vía `@napi-rs/canvas`). Antes de escribir,
leé los módulos del motor, que son cortos y están comentados:

| Módulo | Qué hay |
|---|---|
| `time.js` | `W H DUR FPS BPM BEAT BAR`, `b()`, `cue(id)`, `beatPulse()`, `barPos()`, `lastCue()` |
| `ease.js` | `E.*` (easings; `E.backOut(s)`, `E.elasticOut(a,p)`), `prog`, `seg`, `kf` (keyframes con easing por tramo), `spring` (resorte con overshoot), `pop` (0 → overshoot → 1), `anticip` (anticipación + acción), `stagger`, `clamp`, `lerp`, `remap`, `smoothstep`, `osc` |
| `noise.js` | `rng(seed)`, `hash`, `hr`, `noise1/2`, `fbm1/2`, `drift` (TODO lo «aleatorio» sale de acá) |
| `color.js` | `PAL` (paleta oficial), `rgba`, `mix`, `mixHex`, `shade`, `ramp` |
| `draw.js` | Paths: `P` (Path2D cacheado), `rrectPath`, `circlePath`, `ellipsePath`, `polyPath`, `smoothPath` (curvas Catmull-Rom), `starPath`. Grupos: `tf`, `group`. Pintura: `lin`, `rad`, `fill`, `stroke`. Capas: `toLayer`, `blit`, `glow` (bloom local), `blurred` (profundidad de campo), `dropShadow`, `masked`, `smear` (desenfoque direccional de látigos). Textura y luz: `texture` (grano dentro de formas), `sparkle`, `lightSweep`, `lensFlare` |
| `camera.js` | Cámara 2.5D con parallax: `applyCam`, `plane(ctx, cam, depth, fn)`, `toScreen`, `handheld` |
| `text.js` | Tipografía cinética: `txt()` (medir, cacheado), `drawText()` (8 entradas, 5 salidas, extrusión 3D, degradé, barrido de luz, subrayado, flotación), `drawChip()`, `fmtInt` |
| `fx.js` | Golpes globales leídos de `cues[].fx`: flash, sacudón, punch y RGB. `addFx(fn)` para sumar uno propio |
| `grade.js` | Grano de película y viñeta finales. `addGrade(fn)` para ajustar por tramo |
| `layer.js` | `layer()`: capa W×H reciclada por cuadro (no se guarda entre cuadros) |
| `compositor.js` | Arma el cuadro desde las escenas (contrato §7) |
| `env.js` | `makeCanvas`, `loadImage` (en `init`), plataforma |

Marca: `src/brand/pin.js` → `drawPin(ctx, x, y, size, o)` (punta en x,y), `pinHead()` y `PIN` (geometría).

### 2.1 Reglas técnicas
1. **Todo es función pura de t.** `draw(ctx, t)` no guarda estado entre cuadros. El render corre en 14 procesos,
   en cualquier orden y con submuestras de motion blur.
   - Prohibido `Math.random()` y `Date`.
   - El azar sale de `rng(seed)` en `init()` o de `hash()`.
2. **Precomputá en `init()`** todo lo que no depende de t: paths, posiciones, siluetas pesadas.
   - Para cachear dibujos estáticos complejos usá `makeCanvas()` en `init()`.
   - `layer()` es solo para el cuadro en curso.
3. **Rendimiento**: medido con `tools/check.mjs` o `tools/still.mjs`, que imprimen los ms.
   - Tu escena compuesta: promedio ≤ **120 ms/cuadro** y pico ≤ 300 ms en Node.
   - Los `blur()` grandes y las capas cuestan: usalos donde se noten.
4. `draw` recibe un contexto con transformación identidad y el compositor lo envuelve en save/restore. No dejes
   `filter` ni `globalCompositeOperation` cambiados dentro de tus propios grupos.
5. Nada de `document`, `window`, `Image` ni `fetch` en escenas (`env.js` resuelve la plataforma).
6. **Errores**: cualquier excepción rompe el render. Antes de entregar, `node tools/check.mjs --from=A --to=B`
   tiene que dar `ok: true`, incluido el determinismo.
7. **Lecciones de Skia en Node (@napi-rs/canvas 1.0.10)**, aprendidas en la primera ronda:
   - Un lienzo armado con muchas operaciones se re-rasteriza cada vez que se usa en `drawImage`. Las cachés de
     `init()` se hornean con `bake(canvas)` de draw.js.
   - Cada lectura de píxeles (`getImageData`, `canvas.data()`) pierde ~8 MB nativos que el GC no devuelve.
     - En escenas: nunca leer píxeles en `draw`.
     - Las herramientas ya lo manejan: PNG en still/check y procesos reciclados en render.
   - Rellenos con patrón a pantalla completa y blur chicos (< 2 px) son caros.
     - `smear`, `blurred` y `glow` del motor ya trabajan a media resolución.
     - `texture()` pega azulejos.
   - `createConicGradient` arranca a otro ángulo que en Chrome: no usarlo.
   - `Path2D.addPath` une subcaminos: armar el path con un solo string SVG o con `moveTo` propio.
   - `shadowBlur` por glifo (texto rotado/escalado) es caro.
   - `drawImage` escalado o rotado cuesta ~6× más que a 1:1.
   - Medir texto (`txt()`) en `init()`, no al cargar el módulo: en el navegador las fuentes cargan antes de `init`.
   - Una escena con `mask` puede declarar `maskFrom` / `maskUntil` para no pagar la máscara fuera de la transición.
   - Los ms de `check.mjs` se inflan mucho si hay otros renders corriendo: medir con la máquina libre.

### 2.2 Herramientas (Node, sin navegador ni GPU)
- `node tools/still.mjs`: cuadros y hojas de contactos de la pieza COMPLETA (tu escena con las demás). Ejemplos:
  - `--scene=pool --step=0.1172 --sheet`
  - `--from=3.4 --to=4.2 --step=0.0333 --sheet --cols=8 --thumb=240`: movimiento cuadro a cuadro
  - `--cues=map. --offsets=-0.1,0,0.1 --sheet`
  - `--t=5.625,6.0`
  - `--mblur=6`: con el motion blur del render final
  - `--safe`: márgenes de seguridad
  - Guardá en `--out=shots/<equipo>/<lo-que-sea>`.
- `node tools/sandbox.mjs --module=ruta.js --t=… --sheet`: dibuja un módulo suelto que exporta `draw(ctx, t)`,
  ideal para componentes e ilustraciones aisladas. Tus módulos de prueba van en tu carpeta, con nombre `_algo.js`.
- `node tools/check.mjs --from=A --to=B`: excepciones, determinismo y ms por cuadro.
- `node tools/render.mjs --draft --from=A --to=B --out=out/draft-<equipo>.mp4`: video borrador de tu tramo
  (30 fps, 960×540, con la música si existe). Para mirarlo, armá mosaicos con ffmpeg:
  `ffmpeg -ss A -t 1.2 -i out/draft-x.mp4 -vf "fps=12,scale=240:-1,tile=8x2" -frames:v 1 shots/<equipo>/mosaico.jpg`.
  **No corras el render final**: eso lo hace el director.
- `node tools/energy.mjs --video=out/draft-x.mp4 [--from=A --to=B] --out=shots/<equipo>/energy`: **energía por
  beat** (|Δ luma| medio entre cuadros a 30 fps, calibrado con la crítica de la ronda 1; barra roja si < 3) y
  **salto de luz en los cortes** (Δ luma y MAD entre el cuadro anterior y el del corte). Criterio v2: ningún beat
  < 4 entre 3,75 y 26,72 ni < 3 entre 26,72 y 30, y Δ luma ≤ 25 en los cortes 7,5 · 13,125 · 20,625.
- **Mirá tus imágenes** (con la herramienta de lectura de imágenes). Un reporte sin haber mirado los cuadros no sirve.

## 3. Marca

- **Logo**:
  - `docs/ref/logo-principal.png`: 2651×334, fondo transparente. «prime» en naranja-rojo y «cruceros» en cian.
    La **«o» de cruceros es un PIN de ubicación** con un crucero adentro.
  - `logo-white1.png`: versión blanca.
  - `favicon-logo.png`: el pin solo.
  - El logotipo es una geométrica redondeada fina con terminaciones cortadas. **No se redibuja «a ojo»**: se vectoriza
    o se usa el PNG, y se respetan sus proporciones y colores.
- **Pin**: `src/brand/pin.js`, vector fiel al favicon. Es el **hilo conductor** de la pieza:
  - match cut sol → pin en Buenos Aires
  - los pines de todos los destinos
  - el pin que cae y se convierte en la «o» del logo en el cierre
- **Colores de marca** (`PAL`): naranja `#FF3D00` (`brandOrange`), cian `#00A7CE` (`brandCyan`), cielo del pin
  `#6BBFD2`.
- **Tipografía**: **Outfit** (la de la web), pesos 300–900 en `public/fonts/` (ya cargada en los dos entornos).
  Si un equipo necesita otra fuente, agrega el TTF en `public/fonts/` y su entrada en `public/fonts/fonts.json`, y
  lo reporta. Tiene que ser de licencia libre.
- **WhatsApp**: solo en el CTA del cierre. Píldora verde `#25D366` con el ícono de WhatsApp en blanco (glifo
  vectorial propio, fiel al ícono oficial: globo con el auricular).

## 4. Dirección de arte

**Estilo**: ilustración vectorial «flat 2.5D» de estudio de motion. Inspiración: Buck, Ordinary Folk, Kurzgesagt.
Formas geométricas redondeadas y siluetas seguras, pero con **profundidad y oficio**:
- **Sombreado en 3 tonos por superficie**: base, sombra plana dura (15–25 % más oscura) y luz o filo
  (rim light de 2–4 px más claro en los bordes que dan a la luz). Nada de formas de un solo color plano.
- **Degradés suaves** solo en cielos, agua, vidrio y metal. Las superficies sólidas llevan tonos planos más sombra.
- **Textura**: grano sutil dentro de las formas grandes (`texture()`, alpha 0,05–0,12). El grano global ya lo pone
  `grade.js`.
- **Profundidad**: 3 a 6 planos por escena con parallax.
  - Perspectiva atmosférica: lo lejano es más claro, más azul y con menos contraste.
  - Profundidad de campo con `blurred()` en primeros planos y fondos durante los movimientos de cámara.
- **Luz**: cada escena tiene una fuente de luz clara y consistente. Las sombras proyectadas son suaves y largas.
  Hay destellos (`sparkle`) en agua, vidrio y metal, y al menos un **barrido de luz o flare** por escena.
- **Detalle**: densidad suficiente para que el ojo descubra cosas en una segunda mirada, pero con jerarquía clara
  (una figura protagonista por plano).
- **Líneas**: casi nunca contornos. Si hay trazos, que tengan grosores variados y terminaciones redondeadas.

**Paleta** (`PAL` en `src/engine/color.js`; no inventar azules nuevos sin motivo):
- **Navy**: `ink #04101F`, `navy900–500`.
- **Océano**: `ocean700–400`, `aqua300–100`, `foam`.
- **Blancos**: `white`, `warmWhite`.
- **Atardecer**: `gold #FFB938`, `goldLight`, `goldPale`, `coral #FF6B4A`, `coralLight`, `peach`, `sunsetPink`,
  `dusk`.
- **Rutina gris (solo el gancho)**: `grey900–200`.
- **WhatsApp**: `wa` (solo el CTA).

**Proporción**: navy y azules dominan, el blanco da aire y los cálidos (dorado/coral) son ACENTOS: brillos, sol,
palabras clave, tragos, flotadores. El naranja de marca aparece en los pines, en el logo y en la chimenea del barco.

## 5. Lenguaje de movimiento (para todos)

- **Anticipación**: antes de un movimiento grande, 3–8 cuadros de retroceso o aplastamiento.
- **Overshoot y asentamiento**: `spring`, `pop`, `E.backOut`. Nada llega lineal ni se frena en seco.
- **Escalonado**: elementos hermanos con 2–4 cuadros de diferencia (`stagger`).
- **Squash & stretch** en lo que rebota: pines, valija, gotas y stickers.
- **Acción secundaria**: lo que cuelga sigue moviéndose (banderines, sombrillas, flecos, vapor).
- **Cámara siempre viva**: deriva `handheld` suave; push-ins con easing expo/cubic y paneos con aceleración y
  desaceleración. En los **látigos** va `smear` direccional.
- **Golpe en el beat**: cada beat del drop en adelante tiene que tener ALGO que pase:
  - un pop, un corte o un acento de luz
  - un sacudón leve en los golpes grandes
  - pulso de bombo sutil en elementos vivos (`beatPulse`)
- **Transiciones**: sin crossfades planos. Las que valen son:
  - match cut por forma (círculos: ojo de buey → flotador → plato → ruleta → reflector → sol → pin)
  - barrido de ola o líquido
  - iris
  - látigo
  - zoom a través de un objeto
  - corte duro en el beat
- **Legibilidad**: cada texto queda **completo y quieto al menos 0,8 s** (los chips cortos, 0,6 s). Ningún texto
  importante va sobre una zona de mucho detalle sin un velo, sombra o extrusión que lo separe.
- **Área segura**: textos dentro de x 96–1824 e y 54–1026.

## 6. Storyboard (tiempos exactos en `src/cues.json`)

### 6.1 GANCHO 0–3,75: «la rutina gris» (build-up)
**Escena `hook-office` (HOOK).**
- **Mundo gris**: oficina desaturada (`grey*`, con un tinte frío de tubo fluorescente). Todo un poco apagado y
  monótono.
- **Encuadre** a la altura del escritorio. La **mitad izquierda (x 96–1000) queda LIBRE** para la pregunta (TYPE);
  la acción va en la mitad derecha y al fondo.
- **Elementos**:
  - Escritorio con teclado, mouse, taza de café con vapor, pila de papeles y post-its.
  - **Monitor** con una planilla y, en el fondo de pantalla, una **playa tropical**: lo ÚNICO con color, apagado,
    como una ventana a otra vida.
  - En la pared: **calendario de arrancar hojas** grande («LUNES», «MARTES»…) y **reloj** redondo.
  - Detrás, **ventana** con una ciudad gris (skyline de edificios, quizás llovizna).
  - Al menos 4 planos de profundidad.
- **Coreografía**:
  - 0–3,28: push-in lento de cámara (z 1 → ~1,1) con deriva.
  - `hook.cal1/2/3` (0,47 · 0,94 · 1,41): la hoja del calendario se arranca en cada beat (LUNES → MARTES →
    MIÉRCOLES → JUEVES). La hoja anticipa levantando la esquina, se despega con rotación y cae fuera de cuadro.
  - **El reloj avanza** acelerado: el minutero gira cada vez más rápido durante el build.
  - En c1 (1,875–3,75) el ritmo se aprieta:
    - la planilla parpadea
    - los papeles crecen en la pila (pop por beat)
    - el vapor sube
  - `hook.leak` (3,05): el fondo de playa del monitor **se satura y se ilumina**, y el agua empieza a **filtrarse**
    por el borde inferior de la pantalla (gotas con brillo y un bulto de agua que se hincha).
  - `hook.surge` (3,28): ANTICIPACIÓN.
    - La cámara retrocede un poco y todo tiembla levemente.
    - Los papeles se vuelan.
    - El agua **revienta** desde el monitor y se levanta la **OLA** (componente de ART).
- **3,52–3,86**: la ola barre el cuadro de derecha a izquierda (desde el monitor). Su máscara la dibuja
  `reveal-sea` (§7). `hook-office` sigue dibujándose debajo hasta 3,98.
- **En 3,75 (el drop)** la ola ya pasó el centro: el mar nuevo se ve en ≥ 70 % del cuadro. La cresta sale de
  cuadro en ~3,86. El impacto del drop es el mar revelado, no una pared de agua.

### 6.2 OLA / REVELACIÓN 3,75–5,625: «mar abierto» (DROP)
**Escena `reveal-sea` (HOOK).**
- `reveal.drop` (3,75): detrás de la ola aparece **mar abierto**:
  - cielo luminoso de día dorado
  - sol arriba a la derecha con flare
  - el **crucero en el horizonte** (y≈620–700), avanzando con estela
  - gaviotas
  - agua viva con destellos
  - Flash frío y sacudón (los pone el cue).
- 3,75–5,156: **push-in** con parallax hacia el barco (las olas del primer plano se mueven más rápido que el
  horizonte).
- `reveal.horn` (4,69): bocinazo del barco (soplo de vapor de la chimenea) y un **flare que barre** el cuadro.
- `reveal.push` (5,156–5,625): ANTICIPACIÓN breve y **aceleración**: la cámara se dispara al casco y entra por un
  **OJO DE BUEY**. **En 5,625** el vidrio del ojo de buey está centrado en **(960, 540) con radio 300**.
  - El vidrio refleja el cielo y lleva un brillo diagonal.
  - El aro es blanco/plateado con 8 bulones.
  - Hasta 5,9 sigue un push lento debajo del iris de `pool`.

### 6.3 EXPERIENCIA 5,625–13,125: tour a bordo con match cuts circulares
- **`pool` (DECK-A) 5,625–7,5**: PILETA EN CUBIERTA, vista **cenital**.
  - **Entrada (iris)**: el círculo se abre desde (960, 540) r=300 hasta cubrir el cuadro en ~5,86 (expo). El aro
    del ojo de buey se dibuja en el borde (`over`) y sale de cuadro creciendo.
  - **Ilustración**:
    - agua turquesa con cáusticas animadas
    - borde de venecitas, deck de teca
    - reposeras con toallas, sombrillas a rayas
    - plantas en macetas, borde de la cubierta con baranda
  - **Tobogán en espiral** de colores (vista cenital) que desemboca en la pileta. Alguien baja (figura estilizada)
    y cae con **SPLASH** en `exp.slide` (6,56): corona de gotas, salpicadura, anillos y espuma.
  - **Flotador** redondo a rayas coral/blancas con una persona que flota.
  - Cámara con deriva y leve rotación. Primeros planos (hojas, sombrillas) que pasan más rápido.
  - **Salida (match cut)**: desde `exp.ring` (7,27) el flotador se centra y crece (empuje + rotación horaria). En
    **7,5** queda centrado en **(960, 540), radio exterior 210 e interior 95**, girando horario a ~120°/s y
    creciendo.
- **`dinner` (DECK-A) 7,5–9,375**: CENA GOURMET, vista cenital.
  - **Entrada**: el **plato** en (960, 540) con radio exterior 210 (ala con filo dorado), girando horario y
    creciendo (continúa el movimiento del flotador), con el asentamiento con overshoot.
  - **Mesa**: mantel navy, cubiertos, copas de vino (cenital: círculos con el vino y reflejos), vela con halo que
    titila, flores.
  - `exp.cloche` (7,97): **se levanta la campana** plateada (cenital: domo con reflejo; sale volando hacia arriba a
    la derecha con sombra y smear) y revela un **plato gourmet** con salsa en trazo, guarnición, microverdes, vapor
    y brillo.
  - `exp.pour` (8,44): se sirve vino (el nivel sube con remolino).
  - `exp.clink` (8,91): **brindis**: dos copas se juntan con un destello estrella.
  - Grade cálido a la luz de la vela sobre el navy.
  - **Salida**: desde 9,14 el plato gira cada vez más rápido (smear rotacional). En **9,375** está centrado en
    **(960, 540) r=230**, girando horario a ~360°/s.
- **`show` (DECK-B) 9,375–11,25**: CASINO y SHOW.
  - **Entrada**: **ruleta** cenital en (960, 540) r=230 girando horario a ~360°/s (que desacelera), con la bolita.
    Casilleros en coral/navy/teal y dorado.
  - **Casino**: la cámara se aleja y se inclina para mostrar la mesa:
    - paño teal con luces bokeh doradas
    - `exp.chips` (9,84): pilas de **fichas** que caen y se apilan con rebote, y cartas que se abren en abanico
  - `exp.show` (10,31): **LÁTIGO horizontal** (smear) al **ESCENARIO**:
    - telón que se abre
    - **reflectores** con haces volumétricos que barren
    - bailarines en silueta que cambian de pose en cada beat
    - piso que refleja
    - cabezas del público en primer plano (parallax)
  - `exp.confetti` (10,78): lluvia de papelitos dorados, coral y cian con rotación 3D falsa.
  - **Salida**: desde ~11,0 un reflector gira hacia cámara y su lente se vuelve un **disco cálido enceguecedor**. En
    **11,25** está centrado en **(960, 430) r=160**.
- **`sunset` (DECK-B) 11,25–13,125**: ATARDECER EN CUBIERTA.
  - **Entrada**: el **sol** en (960, 430) r=160 (núcleo blanco-dorado). La cámara se aleja (z ~2,2 → 1) y revela el
    atardecer sobre el mar desde la cubierta:
    - **baranda** en primer plano (navy en contraluz con filo dorado)
    - dos reposeras y una **pareja en silueta**
    - mesita con **dos tragos tropicales** (sombrillita, rodaja de cítrico, brillos)
    - salvavidas naranja en la baranda, guirnalda de luces y gaviotas
    - camino de destellos en el agua
    - cielo en degradé de dusk a coral a dorado
  - El sol baja hacia el horizonte.
  - `exp.cheers` (12,19): la pareja **brinda**: chin-chin, destello y el flare crece.
  - **Salida**: desde `exp.out` (12,66) el sol se encoge, se satura a naranja y la cámara empuja hacia él. En
    **13,125** es un **disco naranja liso centrado en (960, 520), r=120** (de `PAL.coral` a `PAL.brandOrange`).

### 6.4 DESTINOS 13,125–20,625
**Escena `map` (MAP).**
- `map.in` (13,125): **match**. Es el **pin de marca** con la cabeza en (960, 520) r=120, o sea
  `drawPin(ctx, 960, 685, 285)`. Hace squash al «aterrizar», y la cámara se aleja rápido hasta revelar el
  **mapamundi** con el pin sobre **Buenos Aires** (rótulo chico «BUENOS AIRES»).
- **Mapa estilizado**:
  - océano navy (`navy800 → navy700`) con grilla sutil de meridianos y paralelos
  - continentes en **puntitos** (halftone) o planos con filo de luz y textura, en aqua/teal sobre navy
  - rosa de los vientos sutil
  - nubes en un plano superior (parallax)
  - Datos: Natural Earth de `world-atlas` y `d3-geo`, precomputados en `src/data/world.json` con
    `tools/build-map.mjs`.
- **Ruta**: línea que se dibuja sola desde BA:
  - punteada blanca/dorada con un **barquito en la punta** y una estela de luz
  - arcos curvos (estilo gran círculo)
  - la cámara sigue la punta con paneos anticipados
- **Pines** (`drawPin`): caen con squash, rebote y un anillo de «ping». Cada uno lleva su rótulo (chip) y una
  **mini viñeta ilustrada** tipo postal:

  | t | cue | rótulo | viñeta |
  |---|---|---|---|
  | 13,594 | `map.route` | | arranca la ruta |
  | 14,063 | `map.uy` | URUGUAY | Punta del Este: faro o Los Dedos |
  | 14,531 | `map.br` | BRASIL | Pan de Azúcar con teleférico |
  | 15,000 | `map.car` | CARIBE | isla con palmeras, agua turquesa |
  | 15,469 | `map.trans` | TRANSATLÁNTICOS | rótulo que viaja sobre el arco que cruza el Atlántico |
  | 15,938 | `map.eu` | EUROPA | casitas blancas con cúpulas azules del Mediterráneo |
  | 16,406 | `map.dxb` | DUBÁI | skyline con el Burj Khalifa |
  | 16,875 | `map.whip` | | **LÁTIGO al sur** (smear) |
  | 17,344 | `map.ant` | ANTÁRTIDA | iceberg y pingüino; destello helado |
  | 17,813 | `map.all` | | la cámara se aleja: TODA la red de rutas brilla y los pines laten |
  | 18,281 | `map.hold` | | anticipación |

- **NAVIERAS** 18,75–20,625:
  - El mapa se oscurece y desenfoca.
  - Kicker «LAS MEJORES NAVIERAS».
  - **6 chips de texto limpios** (sin logos) que hacen pop en corcheas: `lines.in` (18,75) **MSC** · `lines.c2`
    **Costa** · `lines.c3` **Royal Caribbean** · `lines.c4` **Norwegian** · `lines.c5` **Celebrity** · `lines.c6`
    **Princess**.
  - En `lines.out` (20,39) todo sale con un **LÁTIGO HACIA ARRIBA**.

### 6.5 VALOR 20,625–26,25: golpes rápidos, uno por compás
**Escena `value` (VALUE).** Fondos de color plano y contundentes que cambian en cada compás (por ejemplo cian →
coral → navy, con barrido circular desde el objeto), con formas y patrones geométricos sutiles.
- **c11** (20,625–22,5):
  - **Entrada**: continúa el látigo hacia arriba (el contenido entra desde abajo y frena).
  - `val.in`: cae una **VALIJA** rígida vintage (coral/naranja, correas, esquineros), con squash & stretch, sombra
    y polvito.
  - Titular «HAY UN CRUCERO PARA CADA FORMA DE VIAJAR».
  - En `val.s1` / `s2` / `s3` (21,09 · 21,56 · 22,03) se **pegan stickers** de viaje en la valija con rotación,
    overshoot, bamboleo y una curvita de papel:
    - «EN PAREJA» (ícono de dos corazones o pareja)
    - «EN FAMILIA» (dos adultos y un chico)
    - «CON AMIGOS» (brindis o grupo)
- **c12** (22,5–24,375):
  - `val.pass`: la valija gira o se abre y entra la **TARJETA DE EMBARQUE** grande, levemente inclinada, con
    troquel y talón. Titular «MINICRUCEROS».
  - Campos con humor rioplatense: «PASAJERO/A: VOS» · «SALIDA: BUENOS AIRES» · «EMBARQUE: ¡YA!», más el código
    de barras.
  - Desde 22,97 un contador rueda hasta **USD 355**.
  - `val.price` (23,44): **SELLO** «DESDE USD 355» (tinta con textura, rotado ~−8°, sacudón).
  - `val.tear` (23,91): el **talón se arranca** por el troquel y sale girando.
- **c13** (24,375–26,25):
  - `val.pro`: «ASESORAMIENTO DE ESPECIALISTAS EN CRUCEROS» con un personaje-ícono amable (especialista con
    vincha y micrófono, o gorra de capitán) y un timón o brújula que gira detrás.
  - `val.b1` (24,84): globo de chat del cliente, «¿Qué crucero me conviene?».
  - `val.b2` (25,31): globo de Prime, «¡Te ayudamos a elegir!», con un check.
  - `val.surge` (25,78): ANTICIPACIÓN (todo se inclina o se aplasta) para la segunda ola. `value` sigue
    dibujándose hasta 26,6 debajo de la ola.

### 6.6 CIERRE 26,25–30: la marca
**Escena `close` (CLOSE).**
- `close.in` (26,25): la **segunda OLA** (componente de ART, rima con el gancho) barre el cuadro (26,0–26,35,
  con la misma regla que la primera: en 26,25 ya se ve ≥ 70 % de la escena nueva) y revela el
  **atardecer dorado sobre el mar**: sol bajo con flare, el crucero navegando en el horizonte con estela, destellos
  y gaviotas.
- El **pin de marca cae** con squash & stretch y rebote. Se forma el **logo**: «prime» y «cruceros» aparecen
  escalonados y el pin **se convierte en la «o» de cruceros** (posición y tamaño exactos del logo).
- El logo va en sus colores originales (naranja y cian) sobre una **placa blanca** redondeada con sombra suave
  (tipo tarjeta o postal), para máxima fidelidad y lectura. Alternativa: versión blanca sobre navy, si queda más
  premium. La decide CLOSE mostrando las dos.
- `close.word` (26,72): logo completo y **barrido de luz**.
- `close.url` (27,19): «primecruceros.com.ar» se tipea debajo.
- `close.cta` (27,66): la píldora verde **«CONSULTANOS POR WHATSAPP →»** con el ícono de WhatsApp hace POP. La
  flecha empuja a la derecha en cada beat.
- `close.final` (28,13): golpe final.
  - La píldora late y sale un anillo expansivo con destellos; el flare del sol llega a su pico.
- Hasta 30,0 el cuadro queda **VIVO**: mar, barco, destellos, la flecha y la deriva. **Sin fundido a negro**: el CTA
  se lee hasta el último cuadro.

### 6.7 TIPOGRAFÍA de titulares (TYPE)
Estilo:
- Titulares en Outfit 900 en MAYÚSCULAS, tracking −0,01 a −0,02 em, de 110–200 px.
- Blanco con **extrusión navy** (`extrude`, profundidad 6–12) o sombra larga.
- Palabra clave en **degradé dorado** (`goldPale → gold`) o con subrayado coral/dorado que crece.
- Secundarios en Outfit 600–700 de 44–64 px.
- Chips en Outfit 700, 34–40 px, mayúsculas, tracking 0,06 em.

**Escena `type-hook` (0–5,625)**:
- Antes de la ola, zona izquierda (x 110–1000, y 260–800), una palabra por cue:
  - `hook.q1` «¿Y SI»
  - `hook.q2` «TUS PRÓXIMAS»
  - `hook.q3` «VACACIONES…» (en dorado: lo único cálido del mundo gris, con un brillo que late)
- Color hielo (`grey200`/blanco) con sombra navy. Caen o golpean (`drop`/`slam`).
- En 3,52–3,86 **la ola se lleva el texto**: recortalo con la máscara inversa de la ola de ART, para que quede
  tapado exactamente por el agua.
- Después de la ola, arriba y centrado (y 120–470), sobre el cielo y lejos del barco:
  - `reveal.drop` (3,75) «…FUERAN EN»
  - `reveal.q5` (4,22) «CRUCERO?» ENORME (≥190 px), con extrusión, subrayado dorado y barrido de luz en ~4,69
    (junto al flare del bocinazo)
- **Salida** 5,16–5,5: se va hacia la cámara (escala, desenfoque y fundido) acompañando el empuje al ojo de buey.

**Escena `type-exp` (5,625–13,125)**:
- 5,625 «EXPERIENCIAS» (slam, centrado) · `exp.w2` 5,86 «ÚNICAS» · `exp.w3` 6,09 «EN CRUCERO» (dorado). Las tres
  líneas, centradas y GRANDES.
- Desde ~6,85 el bloque se achica y viaja a un **lockup** arriba a la izquierda (x 96, y 70; ~36 % de escala), con
  un velo o placa sutil para leerse sobre cualquier escena. Ahí queda hasta `exp.out`.
- En cada corte (7,5 · 9,375 · 11,25) el lockup da un micro-pulso.
- **Chip de escena** abajo a la izquierda (ancla x 96, y 1000), que entra 1/8 de beat después de cada corte y sale
  antes del siguiente:
  - «PILETAS Y TOBOGANES» (≈6,4–7,35)
  - «CENAS GOURMET» (≈7,6–9,25)
  - «SHOWS Y CASINO» (≈9,5–11,1)
  - «ATARDECERES EN CUBIERTA» (≈11,4–12,6)
- Salida del lockup en `exp.out` (12,66).
- **Las escenas de experiencia dejan libres esas dos zonas** (arriba a la izquierda y abajo a la izquierda) de
  detalles clave.

Los textos de mapa, navieras, valor y cierre los hace cada equipo dentro de su escena, con el mismo estilo.

## 7. Contratos entre escenas

**Ventanas** (en `src/scenes/index.js`; las cambia solo el director):

| escena | equipo | from | to | z | notas |
|---|---|---|---|---|---|
| hook-office | HOOK | 0 | 3,98 | 10 | |
| reveal-sea | HOOK | 3,5 | 5,9 | 20 | `mask` = región ya cubierta por la ola; `over` = la cresta de la ola |
| pool | DECK-A | 5,625 | 7,5 | 30 | `mask` = iris; `over` = aro del ojo de buey |
| dinner | DECK-A | 7,5 | 9,375 | 40 | |
| show | DECK-B | 9,375 | 11,25 | 50 | |
| sunset | DECK-B | 11,25 | 13,125 | 60 | |
| map | MAP | 13,125 | 20,625 | 70 | |
| value | VALUE | 20,625 | 26,6 | 80 | |
| close | CLOSE | 26,0 | 30 | 90 | `mask` = segunda ola; `over` = cresta |
| type-hook | TYPE | 0 | 5,625 | 200 | |
| type-exp | TYPE | 5,625 | 13,125 | 200 | |

**Reglas**:
- **La escena ENTRANTE es dueña de la transición** (máscara y borde). La saliente solo garantiza la geometría de su
  último cuadro y, si hay solapamiento, sigue dibujándose debajo.
- Match cuts (posición, tamaño y dirección de giro o movimiento en el cuadro del corte):

  | t | de → a | geometría en el corte |
  |---|---|---|
  | 5,625 | ojo de buey → iris de pileta | (960, 540), r = 300 |
  | 7,5 | flotador → plato | (960, 540), r ext 210, giro horario |
  | 9,375 | plato → ruleta | (960, 540), r 230, horario ~360°/s |
  | 11,25 | reflector → sol | (960, 430), r 160, disco cálido |
  | 13,125 | sol → cabeza del pin | (960, 520), r 120, naranja |
  | 20,625 | mapa → valor | movimiento hacia ARRIBA (látigo continuo) |

- **Antes de entregar**, mirá tus cortes a cuadro completo con los vecinos: `still.mjs --t=corte−0.017,corte`.

## 8. Equipos, archivos y dependencias

| equipo | archivos propios | depende de |
|---|---|---|
| **ART** (kit compartido) | `src/art/**` | (arranca primero) |
| **HOOK** | `src/scenes/hook-office.js`, `src/scenes/reveal-sea.js`, `src/scenes/hook/**` | `reveal-sea` necesita ART |
| **DECK-A** | `src/scenes/pool.js`, `src/scenes/dinner.js`, `src/scenes/deck-a/**` | `pool` usa el cielo y el agua de ART si le sirven |
| **DECK-B** | `src/scenes/show.js`, `src/scenes/sunset.js`, `src/scenes/deck-b/**` | `sunset` necesita ART |
| **MAP** | `src/scenes/map.js`, `src/scenes/map/**`, `src/data/**`, `tools/build-map.mjs` | pin de marca |
| **VALUE** | `src/scenes/value.js`, `src/scenes/value/**` | |
| **CLOSE** | `src/scenes/close.js`, `src/scenes/close/**`, `src/brand/logo.js`, `src/brand/whatsapp.js`, `public/brand/**` (nuevos) | la ola y el mar necesitan ART |
| **TYPE** | `src/scenes/type-hook.js`, `src/scenes/type-exp.js`, `src/scenes/type/**` | la máscara de la ola de ART |
| **AUDIO** | `audio/**`, `public/audio/**` | `src/cues.json` |
| director | todo lo demás: `src/engine/**`, `src/brand/pin.js`, `src/cues.json`, `src/scenes/index.js`, `src/main.js`, `tools/*` (salvo build-map), `docs/**` | |

Las capturas de cada equipo van en `shots/<equipo>/`.

### 8.1 API del kit de ART (`src/art/`) — la usan HOOK, DECK-A, DECK-B y CLOSE
ART la implementa con estos nombres (puede agregar opciones) y la documenta en `src/art/README.md` con ejemplos y
una hoja de muestras (`shots/art/`).
- `presets.js`: `SKY_PRESETS` y `SEA_PRESETS` para `'day' | 'golden' | 'sunset' | 'dusk' | 'night'` (colores
  coherentes cielo/mar/luz).
- `sky.js`: `drawSky(ctx, t, { preset, horizonY, sunX, sunY, cam, stars })`: degradé, bandas de bruma, rayos
  suaves y estrellas de noche.
- `sun.js`: `drawSun(ctx, t, x, y, r, { preset, glow, rays, flare })`: disco con halo, rayos que giran lento y
  flare anamórfico.
- `clouds.js`: `drawClouds(ctx, t, { preset, cam, depth, seed, y, density, scale })`: nubes estilizadas en capas
  (base, sombra plana y filo de luz).
- `ocean.js`: `drawOcean(ctx, t, { preset, horizonY, cam, glitter, sunX, swell, foam })`: mar estilizado del
  horizonte para abajo:
  - bandas de olas con parallax por profundidad
  - líneas de brillo y espuma
  - camino de destellos del sol
- `ship.js`: `drawShip(ctx, t, { x, y, scale, dir, wake, lights, preset, detail })` y `SHIP` (metadatos: largo,
  alto, posición de los ojos de buey y de la chimenea en coordenadas locales). Crucero moderno de perfil:
  - casco navy con línea de flotación cian
  - superestructura blanca de 8–10 cubiertas con filas de balcones y ventanas
  - **chimenea naranja de marca** (`brandOrange`) con banda cian
  - botes salvavidas naranjas, tobogán de colores en la cubierta superior, mástil y radar
  - estela y ola de proa animadas, y luces para el atardecer
  - Tiene que verse precioso **chico (horizonte), mediano Y de cerca** (el push-in de HOOK termina en UN ojo de
    buey a pantalla completa).
- `wave.js`: **LA OLA** de las dos transiciones. El CUÁNDO está en `src/scenes/waves.js` (director): `HOOK_WAVE` y
  `CLOSE_WAVE`, con `p(t)`, `dir`, `t0` y `t1`. ART define la FORMA: Dirección `'rtl' | 'ltr' | 'up'`, progreso
  p = 0→1:
  - `drawWaveMask(ctx, p, opts)` pinta la región YA cubierta: lo que queda detrás de la ola, donde se ve la escena
    nueva.
  - `drawWaveCrest(ctx, t, p, opts)` pinta el cuerpo de la ola:
    - una ola gigante que rompe, con rulo
    - degradé turquesa → navy y espuma blanca con encaje
    - gotas y spray que vuelan, y brillo
  - Es la pieza más vista de la promo: tiene que ser espectacular, líquida y con volumen.
  - El frente de la ola es una curva vertical (con rulo arriba y espuma). Con p = 0 está fuera de cuadro del lado de
    entrada y con p = 1 salió del lado opuesto.
  - El mismo `p` y `dir` en `drawWaveMask` y `drawWaveCrest` tienen que coincidir al píxel. TYPE usa la máscara
    INVERSA para que el agua se lleve el texto.
- `porthole.js`: `drawPorthole(ctx, t, cx, cy, r, { preset, glass, rimOnly })`: el ojo de buey en primer plano.
  - aro blanco/plateado con 8 bulones, sombra interior y brillo
  - vidrio que refleja el cielo, con un brillo diagonal
  - Lo usan HOOK (final del push-in) y DECK-A (el aro del iris). Así el match cut es perfecto.
- `gulls.js`: `drawGulls(ctx, t, { count, area, seed, scale })`: gaviotas con aleteo.
- `tropics.js`: `drawPalm(ctx, t, x, y, h, o)` e `drawIsland(ctx, t, x, y, s, o)` (palmeras con balanceo).
- `fxkit.js`: `drawGlitter(ctx, t, area, o)` (destellos en agua), `drawSplash(ctx, t, x, y, p, o)` (salpicadura con
  gotas) y `drawConfetti(ctx, t, area, p, o)`. Son genéricos; si un equipo hace uno mejor, lo dice y ART lo
  adopta en el pulido.

## 9. Textos exactos

- **Gancho**: «¿Y SI» · «TUS PRÓXIMAS» · «VACACIONES…» → «…FUERAN EN» · «CRUCERO?»
- **Experiencia**:
  - titular: «EXPERIENCIAS» · «ÚNICAS» · «EN CRUCERO»
  - chips: «PILETAS Y TOBOGANES» · «CENAS GOURMET» · «SHOWS Y CASINO» · «ATARDECERES EN CUBIERTA»
  - calendario: «LUNES», «MARTES», «MIÉRCOLES», «JUEVES»
- **Destinos**: «BUENOS AIRES» (chico) · «URUGUAY» · «BRASIL» · «CARIBE» · «TRANSATLÁNTICOS» · «EUROPA» · «DUBÁI»
  · «ANTÁRTIDA»
- **Navieras**: «LAS MEJORES NAVIERAS» + «MSC» · «Costa» · «Royal Caribbean» · «Norwegian» · «Celebrity» ·
  «Princess»
- **Valor**:
  - «HAY UN CRUCERO PARA CADA FORMA DE VIAJAR» · «EN PAREJA» · «EN FAMILIA» · «CON AMIGOS»
  - «MINICRUCEROS» · «DESDE USD 355» · «TARJETA DE EMBARQUE» · «PASAJERO/A: VOS» · «SALIDA: BUENOS AIRES» ·
    «EMBARQUE: ¡YA!»
  - «ASESORAMIENTO DE ESPECIALISTAS EN CRUCEROS» · «¿Qué crucero me conviene?» · «¡Te ayudamos a elegir!»
- **Cierre**: logo · «primecruceros.com.ar» · «CONSULTANOS POR WHATSAPP →»

Nada de precios, fechas ni datos inventados fuera de estos.

## 10. Audio (AUDIO) — tropical house, 128 BPM, La mayor

Hecho **de cero** en Python (numpy/scipy; numba disponible; se pueden instalar paquetes con pip). **Sin samples
externos**: todo sintetizado.

**Entrega**:
- `public/audio/promo.wav`: 48 kHz, 24 bit, estéreo, **exactamente 30,000 s** (1.440.000 muestras).
- stems en `audio/stems/`.
- `audio/README.md` con cómo regenerarlo (`python audio/build.py` o similar).

**Requisitos técnicos**:
- Determinista (semillas fijas).
- Lee `src/cues.json`: los SFX caen en el cue con ±5 ms y la cresta del transitorio va en el cue.
- Risers y reverses que **culminan** en su cue.
- **−14 LUFS integrados** y true peak ≤ −1 dBTP (también después de codificar a AAC).
- Una herramienta de análisis (`audio/analyze.py`) que verifique todo eso y genere espectrograma y forma de onda en
  PNG.

**Carácter**: soleado, alegre, «feel-good», con **beat claro**. La paleta tropical house:
- bombo four-on-the-floor con sidechain marcado en pads y bajo
- clap/snare en 2 y 4, hi-hats abiertos a contratiempo y shaker en semicorcheas
- percusión tropical: congas, bongós, rimshot y claves
- **marimba / steel drum / plucks** con delay
- lead tipo **«vocal chop» o flauta de pan** (síntesis con formantes y respiración)
- bajo cálido y profundo
- pads luminosos

**Armonía**: La mayor, I–V–vi–IV en sus variantes (por ejemplo F#m–D–A–E por compás desde c3). El cierre resuelve en
La mayor (add9).

**Arreglo por compás** (las frases empiezan donde empiezan las secciones visuales):

| compases | tramo | arreglo |
|---|---|---|
| c0–c1 (0–3,75) | **BUILD «gris»** | La música suena **apagada, filtrada**, como detrás de una pared o en auriculares ajenos: marimba lo-fi con el motivo, tic-tac del reloj en corcheas. El pasa-bajos se abre durante c1, entra un riser (ruido y tono) y un redoble que se acelera (corcheas → semicorcheas → fusas). **Semicorchea de SILENCIO en 3,633** (`hook.gap`) |
| c2 (3,75) | **DROP** | Impacto enorme (sub, bombo, crash y el golpe de ola `drop_wave`) y entra la banda completa con el **hook melódico** |
| c3–c6 | experiencia | Groove pleno; un acento o transición en cada corte de escena |
| c7–c10 | destinos | Segunda frase con variación: contramelodía de **steel drum**; los pines son notas pitcheadas (`pitch` en semitonos sobre La pentatónica); en c10, stabs por chip en corcheas |
| c11–c13 | valor | Algo más liviano (pre-estribillo: menos bajo, plucks), golpes por ítem y build en c13 hacia la ola (`val.surge`) |
| c14–c15 | cierre | Último estribillo con el hook. Golpe final en 28,125 con acorde grande de La mayor y cola que se apaga limpia en 30,0 (sin clic) |

**SFX** (los nombres están en `sfx` de cues.json): síntesis propia, con buen gusto, por debajo de la música pero
perceptibles. Los de agua (ola, splash, gotas) deben sonar a **agua**: ruido filtrado con envolventes, burbujeo y
spray. El `silence` es un hueco real de toda la mezcla (salvo colas).

**Loudness**: el build arranca ~6–8 LU por debajo del drop. Los dos picos de energía son el drop y el cierre.

## 11. Entrega de cada equipo
Cada equipo, antes de terminar:
1. `node tools/check.mjs --from=<su tramo>` sale `ok: true` (excepciones, determinismo y ms dentro del presupuesto).
2. Revisó sus cortes con las escenas vecinas, sus cues con `--offsets` y el movimiento con hojas cuadro a cuadro.
3. Hizo al menos **dos rondas de autocrítica** contra la vara del §0 y el §4–§5: miró cuadros a tamaño completo y
   arregló lo flojo.
4. Reporta:
   - qué hizo y dónde (archivos)
   - capturas clave (rutas)
   - ms por cuadro
   - qué le quedó flojo o qué necesita de otro equipo o del director

## 12. Cambios v2 (después de la revisión de 5 críticos del integrado v1)

| § | Cambio |
|---|---|
| §3 | Píldora de WhatsApp: `#25D366` en el filo, el brillo, el ícono y los anillos; cuerpo en verde profundo `#1A9E4E → #128C45`; texto blanco con extrusión `#0B5E2E` (contraste ≥ 3,5:1). |
| fx | Flash de `reveal.drop` bajado a 0,12 y el de `close.in` a 0,10: el cuadro de impacto de cada ola tiene que verse con color pleno, no lavado. |
| §5 | Excepción de legibilidad: en el mapa los rótulos que entran uno por beat pueden quedar ~0,4 s; se compensa con la relectura completa de `map.all`. |
| §6.6 | Logo **a color** (naranja «prime» + cian «cruceros») sobre una **placa blanca compacta**, con la URL fuera de la placa. El pin cae directo en la «o» 2 cuadros después de `close.in`; la placa y las letras nacen en cascada desde el pin; logo completo en 26,70. |
| §7 | Las crestas de las olas (`reveal-sea`, `close`) se pintan **encima de todo**, incluidos los titulares (`OVER_ABOVE` en `src/scenes/index.js`; el compositor admite `overAbove`). |
| §7 | `value` arranca en **20,5** (ventana fijada en `index.js`) con máscara ascendente entre 20,5 y 20,625 (`maskFrom`/`maskUntil`): la valija entra desde abajo y frena EN `val.in`. `map` sigue debajo hasta 20,625. |
| §10 | El groove sigue liviano (bombo, shaker, hats y stab de marimba) hasta 29,53 y cierra con un stinger (La add9) en el último beat; cola limpia sin clic. |
| cues v2 | `val.s3` pasa a **21,796875** (b(11, 3.5)) para que «CON AMIGOS» se lea ≥ 0,6 s. |
| motor | `text.js`: extrusión en dos pasadas (todas las extrusiones, después todas las caras) y `wordSpacing` (por defecto tracking × 1,5 si tracking > 0,04 em). `smear()`: buffer con 25 % de margen y bordes extendidos (`edge: 'clamp'`), sin bandas vacías en los látigos. |
| criterios | Ningún beat con energía < 4 entre 3,75 y 26,72 (ni < 3 hasta 30) y Δ luma ≤ 25 en los cortes 7,5 · 13,125 · 20,625 (`tools/energy.mjs`). |


## 13. Versión VERTICAL 9:16 (1080×1920) para Reels, TikTok, Stories y Shorts

La misma pieza, con el mismo tiempo, los mismos cues y la misma música, RECOMPUESTA para vertical. **No es un
recorte del 16:9**: cada escena se rearma para que todo se lea y se luzca en 1080×1920.

### 13.1 Técnica
- Un solo código, dos formatos:
  - `import { VERTICAL, W, H } from '../engine/time.js'`.
  - En Node: `--format=9x16` en still, check y render (`PROMO_FORMAT=9x16` en los procesos).
  - En el navegador: `?format=9x16`.
- Render: `node tools/render.mjs --format=9x16` → `out/promo-prime-cruceros-9x16.mp4`.
  - Borrador: `--draft --format=9x16` → 540×960.
- **El 16:9 no puede cambiar ni un píxel**: el 16:9 final ya está renderizado y aprobado.
  - Antes de tocar nada, guardá referencias: `still.mjs --t=<6–10 tiempos de tu tramo> --out=shots/<equipo>/ref16`.
  - Al terminar, compará con md5 contra un render nuevo. Tiene que dar idéntico.
- Reemplazá los números fijos (1920, 1080, 960, 540) por `W`, `H` o por layouts por formato
  (`const L = VERTICAL ? LAYOUT_V : LAYOUT_H`). Reusá las ilustraciones: cambian la composición, la cámara y la
  escala, no los dibujos.
- La cámara 2.5D (`applyCam`) ya centra en (W/2, H/2).

### 13.2 Zonas seguras (interfaz de las plataformas)
- **Arriba**: y < 250 (barra de estado y cuenta) → sin texto clave.
- **Abajo**: y > 1500 (descripción, música y botones) → sin texto clave. El CTA va por encima de 1480.
- **Derecha**: x > 950 entre y 900–1700 (botones de me gusta y compartir) → sin texto clave.
- **Texto clave** dentro de **x 80–950, y 260–1480**. Las ilustraciones sí pueden llenar todo el cuadro.

### 13.3 Composición vertical
- Apilada:
  - texto arriba (y 260–760)
  - objeto o acción protagonista al centro (y 700–1400)
  - aire o ambiente abajo
- Movimientos de cámara verticales (grúas, tilts) donde sumen.
- Tipografía:
  - Titulares en 2–4 líneas apiladas, ancho ≤ 900 px y 110–170 px en los golpes.
  - Secundarios ≥ 44 px y chips ≥ 40 px.
  - Mismo estilo que el 16:9: Outfit 900, extrusión navy y clave en dorado.
- Tiempos de lectura iguales al 16:9 (§5).

### 13.4 Geometría de los match cuts (vertical)

| t | corte | geometría |
|---|---|---|
| 5,625 | ojo de buey → iris de pileta | vidrio en (540, 960), r 300 |
| 7,5 | flotador → plato | (540, 960), r ext 210, int 95, giro horario |
| 9,375 | plato → ruleta | (540, 960), r 230, horario ~360°/s |
| 11,25 | reflector → sol | (540, 820), r 160 |
| 13,125 | sol → cabeza del pin | (540, 900), r 120; `drawPin(ctx, 540, 1065, 285)` |
| 20,625 | mapa → valor | látigo hacia arriba |
| olas | 3,52–3,86 y 26,0–26,35 | misma coincidencia máscara/cresta. Si en vertical una ola de abajo hacia arriba (`'up'`) luce más, ART lo propone y el director cambia `waves.js` (`dir` según `VERTICAL`) |

### 13.5 Dirección por escena (vertical)
- **hook-office**:
  - Pila de arriba abajo: calendario grande y reloj, ventana con la ciudad, monitor con la playa, escritorio.
  - La pregunta de TYPE va en la banda superior y media (y 280–820).
  - El agua revienta desde el monitor.
- **reveal-sea**:
  - Cielo alto con «…FUERAN EN / CRUCERO?» (y 300–760) y el crucero en el horizonte (~y 1100–1150).
  - Mar abajo con primer plano vivo.
  - Empuje al ojo de buey en (540, 960).
- **pool / dinner**: vistas cenitales (en vertical funcionan muy bien). En dinner la mesa larga va a lo alto.
- **show**:
  - Ruleta al centro y mesa en perspectiva.
  - Escenario con menos bailarinas (3–4), más grandes, y el telón a lo alto.
  - Reflector → sol en (540, 820).
- **sunset**: cielo alto con el sol; pareja, baranda y tragos en la mitad inferior. Salida: disco naranja en (540, 900) r 120.
- **map**:
  - El mapa se recorre más en vertical: Sudamérica es alta y el arco del Atlántico se encuadra en diagonal.
  - Postales más grandes.
  - Navieras en 2 columnas × 3 filas.
- **value**:
  - Titular arriba y objeto al centro.
  - Tarjeta de embarque en versión vertical, tipo «pase móvil», o girada; que se lea el precio grande.
  - Especialista abajo con los globos encima.
- **close**:
  - Placa con el logo centrada (ancho ≤ 960) en y ~650–800 y URL debajo.
  - Píldora de WhatsApp en y ~1280–1420 (ancho ≤ 940).
  - Atardecer alto y barco en el horizonte.
- **TYPE**:
  - Lockup de experiencia arriba a la izquierda en (80, 260), con escala ~0,45.
  - Chips de escena abajo a la izquierda (80, 1470).
  - Titular «EXPERIENCIAS / ÚNICAS / EN CRUCERO» apilado al centro.
