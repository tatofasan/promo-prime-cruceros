# Cómo se generó esta promo

Este documento cuenta **cómo se produjo** el video: quién hizo qué, en qué orden, con qué controles de calidad y qué
problemas aparecieron. Para la parte técnica del código, ver [`CODIGO.md`](CODIGO.md). El contrato creativo completo
(storyboard, tiempos, dirección de arte) está en [`PLAN.md`](PLAN.md).

## Resumen

- **Encargo**: un brief escrito (en inglés) para una promo de 30 s de Prime Cruceros, que tenía que vender la
  experiencia del crucero y generar consultas por WhatsApp. Pedía:
  - motion graphics originales, sin capturas de la web
  - texto en rioplatense
  - música tropical house con el movimiento en el beat
  - calidad de producción profesional
- **Quién lo hizo**: **Claude Code** (modelo Opus 5.5) como director, coordinando **equipos de subagentes** que
  trabajaron en paralelo, cada uno dueño de una parte del video. El cliente (el usuario) dio el brief y tomó las
  decisiones clave: pidió todo de cero, cortó las rondas de pulido y dejó el 9:16 para después.
- **Cómo**: todo es código. No se usaron imágenes generadas por IA, videos de stock ni samples de audio:
  - las ilustraciones son instrucciones de dibujo en Canvas 2D
  - la animación son funciones del tiempo
  - la música y los efectos se sintetizan en Python
- **Duración**: un día de trabajo (5 de octubre de 2026), con varias horas de agentes trabajando en paralelo.

## 1. Preparación (director)

1. **Marca**: se bajaron de primecruceros.com.ar:
   - el logo (`docs/ref/`)
   - los colores: naranja `#FF3D00` de «prime» y cian `#00A7CE` de «cruceros»
   - la tipografía: **Outfit**
   
   Se descubrió que la «o» del logo es un **pin de ubicación con un crucero adentro**, y eso se volvió el **hilo
   conductor** de la pieza: el sol se transforma en el pin del mapa, los destinos son pines y el pin cae para formar
   el logo.
2. **Decisiones de dirección**:
   - **Formato**: 16:9 (1920×1080) a 60 fps.
   - **Música**: **128 BPM**. Así **16 compases duran exactamente 30,000 s** y las secciones del brief caen casi
     justas en compases enteros: gancho 0–3,75, drop 3,75, experiencia 5,625–13,125, destinos 13,125–20,625,
     valor 20,625–26,25 y cierre 26,25–30.
   - **Transiciones**: una cadena de **match cuts circulares**: ojo de buey → flotador → plato → ruleta → reflector
     → sol → pin.
3. **Motor propio de cero**: se evaluaron dos librerías de Canvas para Node y se eligió `@napi-rs/canvas` (Skia),
   que tardaba 28 ms por cuadro contra 92 ms de la otra.
   - El motor dibuja cada cuadro como **función pura del tiempo**, así el render es determinista y se puede repartir
     en varios procesos.
   - El mismo código corre en el navegador para la vista previa con música.
   - Se escribieron también las herramientas: cuadros sueltos, hojas de contactos, control de errores y render
     paralelo.
4. **Contrato** (`docs/PLAN.md`) y **hoja de golpes** (`src/cues.json`, 65 cues).
   - El contrato fija el storyboard con tiempos exactos, la paleta, el estilo de ilustración, el lenguaje de
     movimiento, la geometría de cada corte, qué archivos son de cada equipo y la vara de calidad.
   - Los cues los leen la imagen y el audio, así todo cae en el mismo beat.

## 2. Construcción en paralelo (equipos de agentes)

Se lanzaron dos flujos en paralelo.

**Imagen** (12 agentes, con dependencias):

| equipo | qué hizo |
|---|---|
| **ART** | Kit compartido: cielo, sol y flares, mar, el crucero, la ola de las transiciones, ojo de buey, gaviotas, palmeras y agua. Fue primero, porque otros lo necesitaban |
| **HOOK** | Oficina gris del gancho, y después (con el kit) la ola, el mar abierto y el viaje al ojo de buey |
| **DECK-A** | Cena gourmet, y después la pileta con tobogán |
| **DECK-B** | Casino y show, y después el atardecer en cubierta |
| **MAP** | Mapamundi con datos reales (Natural Earth), ruta, pines, postales y navieras |
| **VALUE** | Valija con stickers, tarjeta de embarque con sello y especialista con chat |
| **CLOSE** | Logo vectorizado (fiel al PNG original), ícono de WhatsApp, botón y cierre |
| **TYPE** | Titulares del gancho y de la experiencia |

Los equipos que dependían del kit esperaban a ART; los demás arrancaban enseguida. Cada equipo hizo al menos dos
rondas de autocrítica mirando sus propios cuadros.

**Audio** (4 agentes):
1. Un productor armó de cero la síntesis (osciladores, filtros, reverb, sidechain, limitador), el arreglo compás por
   compás, los 41 efectos de sonido y un analizador automático.
2. Dos críticos lo revisaron por separado: uno musical (nota 6) y uno técnico (nota 7,8).
3. El productor aplicó las correcciones.

Resultado: −14 LUFS, pico ≤ −1 dBTP incluso en AAC y efectos a ±2 ms de su golpe.

## 3. Integración y primer borrador

El director integró las escenas, corrigió problemas del motor que encontraron los equipos y renderizó el **borrador
v1**:
- grano y texturas muy lentos
- un desenfoque direccional que hacía bandas
- una fuga de memoria de la librería al leer píxeles

## 4. Revisión con cinco críticos

Cinco críticos independientes revisaron el v1 cuadro a cuadro, cada uno con una lente:

| crítico | lente | nota |
|---|---|---|
| motion | animación, timing, cortes, cámara | 6,0 |
| arte | ilustración, estilo, luz, composición | 6,8 |
| tipografía y copy | textos, lectura, legibilidad | 7,4 |
| cliente | ¿vende?, ¿cumple el brief?, marca, CTA | 7,0 |
| QA técnico | artefactos, saltos, máscaras, errores | 6,4 |

**Promedio: 6,7.**

Un **jefe de postproducción** consolidó las observaciones:
- unió duplicados
- resolvió contradicciones entre críticos (por ejemplo, de qué color va el tubo de la ola y si el logo va blanco o a
  color)
- armó una lista de tareas por equipo con criterios de aceptación medibles

Los tres problemas que marcaron los cinco críticos fueron:
1. **la ola**: tenía una mancha navy que no se leía como agua
2. **el logo**: había quedado blanco y aplastado al nacer
3. **la pareja del atardecer**: se veía translúcida

Los equipos corrigieron en paralelo y QA verificó: **7,8**. A mitad de esta ronda se llegó al límite semanal de uso,
y se retomó después desde el caché del workflow (las críticas y la consolidación no se repitieron).

El director hizo sus propias tareas:
- la cresta de la ola se pinta encima del texto
- la escena de valor arranca antes con máscara, para que la valija entre desde abajo
- un sticker se adelantó una corchea para que se lea
- el texto con extrusión ahora se dibuja en dos pasadas
- el barrido de cámara ya no deja bandas en los bordes
- se creó una herramienta oficial de medición (`tools/energy.mjs`)

## 5. Pulido final

Una tercera ronda dirigida, con 7 equipos y tareas concretas de QA:
- la ola pasó a ser un barril que rompe, con labio y espuma
- el drop quedó limpio y con jerarquía
- el bocinazo es un chorro de vapor visible
- se suavizaron los saltos de luz en los cortes
- se sumó más movimiento por beat en la cena, el mapa, el valor y el cierre
- se corrigió el nacimiento del logo

El cliente pidió **cortar después de esta ronda**. El director paró el flujo antes de que arrancara una segunda
vuelta automática y verificó el resultado con las métricas oficiales:

| criterio | resultado |
|---|---|
| Salto de luz en los cortes (Δ luma, límite 25) | 3 a 11 en los siete cortes; en el v1 había saltos de 70–80 |
| Energía por beat (≥ 4 entre 3,75 y 26,72; ≥ 3 en el cierre) | se cumple. El único beat tranquilo es el 2,3 s, dentro del gancho gris (a propósito) |
| Errores y determinismo | ninguno; cada cuadro sale idéntico en cualquier orden |
| Costo | 81 ms por cuadro en promedio |

En paralelo, el audio sumó un **groove liviano bajo el botón de WhatsApp** y un **stinger** en el último beat
(29,53 s), para que el CTA no quede sin ritmo. Un crítico técnico lo verificó con sus propios medidores.

## 6. Render final

`node tools/render.mjs`: 1800 cuadros, motion blur con 6 submuestras por cuadro y 180 tramos en 10 procesos.
**~7 minutos.**
- En la primera pasada el video salió con 1799 cuadros: la opción `-shortest` de ffmpeg se comía el último al unir
  con el audio. Se corrigió y se volvió a renderizar.
- **Entregables** (en `out/`, no están en el repo):
  - `promo-prime-cruceros.mp4`: máster, 235 MB
  - `promo-prime-cruceros-web.mp4`: 45 MB
  - `promo-prime-cruceros-celular.mp4`: 25 MB

## 7. Controles de calidad que se usaron

| control | herramienta |
|---|---|
| Cuadros sueltos y hojas de contactos, cuadro a cuadro | `tools/still.mjs` |
| Errores, determinismo y costo por cuadro | `tools/check.mjs` |
| Energía de movimiento por beat y salto de luz en cortes | `tools/energy.mjs` |
| Huella de píxeles (para comprobar que un cambio no tocó la imagen) | `tools/fingerprint.mjs` |
| Loudness, true peak, sincronía de efectos, silencios, final sin clic, determinismo del audio | `audio/analyze.py` |

## 8. Problemas técnicos que aparecieron (y cómo se resolvieron)

- **Fuga de memoria** de `@napi-rs/canvas` 1.0.10: cada lectura de píxeles pierde ~8 MB que el recolector no
  libera. El render usa procesos cortos que se reciclan cada 10 cuadros, y las herramientas guardan PNG (sin fuga).
- **Lienzos que se vuelven a rasterizar** cada vez que se usan: las cachés se «hornean» con `bake()`.
- **Rellenos con patrón y desenfoques chicos lentos en Skia**: el grano y las texturas se pegan como azulejos, y los
  desenfoques se hacen a media resolución.
- **Desenfoque direccional que hacía bandas** (sumar copias con alfa 1/n en 8 bits): se promedian de a pares
  (ping-pong) en un búfer con margen.
- **Mediciones de tiempo infladas** cuando había 20 procesos de agentes en paralelo: se midió con la máquina libre.
- **Un archivo roto de un equipo frenaba las pruebas de todos**: las herramientas de prueba de componentes ya no
  arrancan todas las escenas.

Todas estas lecciones están en `docs/PLAN.md` §2.1.

## 9. Escala y lo que quedó pendiente

- **Volumen**: unas 40 ejecuciones de agentes y ~20 millones de tokens de subagentes en total (construcción ~6 M,
  revisión y correcciones ~8 M, audio ~3 M y pulido final). El resultado son unas 43.000 líneas de código
  (JavaScript y Python).
- **9:16**: el motor ya renderiza en vertical (`--format=9x16`) y el contrato de composición vertical está en
  `docs/PLAN.md` §13, pero las escenas todavía no se adaptaron.
- **Nadie escuchó la música**: el audio se juzgó con métricas, espectrogramas y análisis de bandas. Conviene
  escucharla, sobre todo el timbre del lead y la bocina del barco.
