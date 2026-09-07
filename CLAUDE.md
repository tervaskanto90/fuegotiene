# Fuego tiene?

Sitio privado para ver Los Simuladores desde archivos propios, con un código
de acceso por persona. Next.js 15 (App Router) en Vercel, videos en
Cloudflare R2. Sin base de datos.

El dueño del proyecto no puede instalar nada en su compu: ni Node, ni git,
ni ffmpeg. Todo lo que él hace pasa por pantallas: Vercel, Cloudflare y
Cyberduck. Cada decisión de este repo tiene que sostener eso. Si una tarea
"requiere correr algo en su máquina", está mal planteada.

## Invariantes de arquitectura

Estas cinco cosas son decisiones tomadas, no defaults. Si vas a cambiar
alguna, avisá antes en vez de hacerlo al pasar.

**El video nunca pasa por Vercel.** `/api/stream/[id]` firma una URL de R2 y
devuelve un 302. El navegador le pide los bytes directo a R2. Convertir esa
ruta en un proxy (leer el objeto y devolverlo en el response) rompe los Range
requests, mata el seek de la barra y quema ancho de banda de Vercel. Es el
error más fácil de cometer acá. Las dos excepciones leen pedazos, no el
video: `/api/estado/[id]` lee la cabecera y el índice para el diagnóstico, y
`/api/arte/[id]` lee unos MB alrededor de un cuadro para generar la portada.

**Las subidas tampoco pasan por Vercel.** `/subir` pide a `/api/subir` una
URL firmada de PUT y el navegador manda el archivo directo a R2. Para eso el
bucket necesita una política CORS que nombre al sitio; la página la genera.
Sin esa política, la subida falla en el navegador y la página lo explica.

**El video se pide con `crossorigin="anonymous"`, con retroceso.** Es lo
que permite dibujar un cuadro en un canvas cuando alguien elige una portada
a mano desde el reproductor. Exige que el bucket tenga la política CORS (la
misma de `/subir`). Si no la tiene, la primera carga falla y el reproductor
vuelve a pedir el video sin CORS: se ve igual, sólo no hay capturas manuales.
No saques ese retroceso. Las portadas automáticas no dependen de esto.

**Los subtítulos sí pasan por Vercel, a propósito.** `/api/stream/[id]/sub`
lee el .vtt de R2 y lo devuelve. Un `<track>` sólo acepta archivos del mismo
origen (o con CORS), así que un redirect a R2 lo bloquearía en silencio. Son
decenas de KB: no es la excepción que confirma la regla, es otra regla.

**La sesión se valida dos veces, a propósito.** El middleware la chequea, y
`/api/stream/[id]` la vuelve a chequear por su cuenta. Es redundante porque
esa ruta es la única que expone URLs firmadas y no queremos que dependa de
que el middleware se haya ejecutado. No la "limpies".

**No hay base de datos.** El código de acceso es la identidad, y sale de la
variable de entorno `ACCESS_CODES`. La cookie guarda un hash del código, no
el código: sacar un código de la variable desloguea a esa persona. El
progreso de reproducción vive en el `localStorage` de cada navegador. Lo
único compartido entre navegadores son las anotaciones por capítulo (dónde
está la intro, si hay portada): un JSON chico, `marcas.json`, que vive en el
bucket al lado de los videos y que el sitio lee y reescribe entero
(`lib/marcas.ts`, `lib/almacen.ts`). Las portadas son JPEG de ~50 KB en
`art/<id>.jpg`, capturados por el reproductor. Si algo parece necesitar una
tabla, primero replanteá el feature.

**Los .mp4 no entran nunca al repo.** Están en `.gitignore`. Las dos
excepciones, chicas y explícitas, son `public/demo/muestra.mp4` (135 KB) y
los archivos de prueba de `tests/fixtures/` (unos 30 KB cada uno).

## Cómo suben los archivos

El dueño del proyecto sube desde el panel de Cloudflare (hasta 300 MB por
archivo), desde la página `/subir` del sitio (sin límite, con CORS en el
bucket) o con **Cyberduck**. Ver `SUBIR-CON-CYBERDUCK.md`, y `PASOS.md`
para el recorrido entero desde cero.

`scripts/upload.mjs` y `scripts/prepare-videos.mjs` siguen en el repo y
sirven para quien sí tenga Node y ffmpeg, pero no los propongas como camino
principal.

**No des por sentado que ffmpeg está disponible.** Para saber si un archivo
hace falta convertirlo no se corre ffprobe: se sube uno solo con Cyberduck y
se mira `/estado`. Si hay que convertir, lo hace el workflow **Convertir
capítulo** (`.github/workflows/convertir.yml`) en una máquina de GitHub:
baja el archivo del bucket, respalda el original en `originales/`, lo pasa a
H.264 + AAC con `+faststart` y lo sube con el mismo nombre. El dueño lo
dispara desde la pestaña Actions con el nombre del archivo.

## La página /estado reemplaza a ffprobe

`/estado` primero prueba el bucket con un listado corto (`/api/estado`) y
distingue credenciales rechazadas, bucket inexistente y archivos subidos con
nombres que no coinciden con ningún capítulo. Después revisa cada capítulo
(`/api/estado/[id]`). Para cada uno dice si el archivo
está, cuánto pesa, qué códecs trae y si el navegador lo va a reproducir. Lo
hace `lib/mp4.ts`: lee el archivo con pedidos parciales (la cabecera y el
índice `moov`, un par de MB como mucho, nunca el video entero) y entiende
las cajas del mp4. Detecta:

- **Audio AC-3, E-AC-3 o DTS.** Chrome no los reproduce. Se ve la imagen,
  no se escucha nada, la consola no dice nada. Veredicto `sin-audio`.
- **`moov` al final del archivo** (sin `+faststart`). El navegador se baja
  el capítulo entero antes de mostrar el primer cuadro. Veredicto
  `arranque-lento`.
- **Contenedores que el navegador no abre**: .avi, .mkv, .wmv, .mpg, .ts y
  .flv. Y video que no
  decodifica: MPEG-4 parte 2 (DivX/Xvid), H.264 de 10 bits. Veredicto
  `no-reproducible`.

El reproductor usa lo mismo: si un video falla, consulta `/api/estado/[id]`
y muestra el motivo en palabras en lugar de un cuadro negro.

Si aparece un reporte tipo "no anda el video", mandá a `/estado` antes de
tocar código.

**Sin R2 configurado, el sitio anda igual.** `lib/r2.ts` detecta que faltan
las variables y `/api/stream/[id]` redirige a `public/demo/muestra.mp4`, un
clip de 20 s con cronómetro y un tic por segundo. Sirve para probar login,
seek, progreso y navegación sin subir nada. Se apaga solo en cuanto aparecen
las cuatro variables: no hay un flag que prender.

## Comandos

```bash
npm run dev                      # local en :3000
npm run build                    # verificar que compila antes de deployar
npm test                         # tests de auth, r2, mp4, marcas y episodes.json (node --test)
npm run prepare-videos -- <dir>  # ffmpeg: normaliza, cuadros, srt->vtt (requiere ffmpeg)
npm run upload -- ./listos       # sube a R2 con multipart (requiere las variables)
npm run demo                     # regenera public/demo/muestra.mp4 (requiere ffmpeg)
```

Para probar en local hacen falta `SESSION_SECRET` (32 caracteres o más) y
`ACCESS_CODES` en `.env.local`. Sin eso el login rechaza todo y `/entrar`
explica qué falta. Ver `.env.example`.

## Mapa

```
lib/site.ts               nombre del sitio y bajada. Un solo lugar.
lib/auth.ts               HMAC con Web Crypto. Anda en Edge (middleware) y en
                          Node (routes): nada de node:crypto. Lee y valida las
                          variables y explica qué falta.
lib/r2.ts                 firma de URLs y pedidos a R2 con aws4fetch
lib/mp4.ts                lector de cajas mp4: códecs, moov, veredicto
lib/episodes.ts           lee data/episodes.json, helpers de navegación y formato
lib/progress.ts           localStorage + hook useProgreso
middleware.ts             puerta de acceso, corre en Edge
app/page.tsx              portada (server) -> Biblioteca (client)
app/entrar/page.tsx       login. Form HTML común, sin JS obligatorio.
app/ver/[id]/page.tsx     reproductor
app/estado/page.tsx       estado de la configuración y de cada archivo
app/subir/page.tsx        subida al bucket desde el navegador -> Subida (client)
app/api/subir             firma una URL de PUT para un nombre válido
app/api/marcas            lee y escribe marcas.json (intro por capítulo)
app/api/arte/[id]         portada JPEG: la devuelve (GET) o la guarda (POST)
lib/marcas.ts             forma de las anotaciones y validación
lib/almacen.ts            bucket o carpeta temporal (modo demo)
app/api/entrar            valida el código y pone la cookie
app/api/salir             borra la cookie
app/api/stream/[id]       firma la URL de R2 y redirige (302)
app/api/stream/[id]/sub   subtítulos .vtt, devueltos desde acá
app/api/estado            prueba el bucket y lista los archivos sueltos
app/api/estado/[id]       HEAD + lectura parcial del archivo -> JSON
components/Biblioteca.tsx destacado + grilla por temporada
components/Tarjeta.tsx    una tarjeta de capítulo
components/Arte.tsx       imagen del capítulo o trama con el número
components/Reproductor.tsx reproductor a pantalla entera: controles propios,
                          progreso, intro, portada, atajos, siguiente, errores
components/Iconos.tsx     íconos SVG del reproductor
components/Estado.tsx     tabla de /estado, revisa de a tres
components/Subida.tsx     cola de subidas con progreso y ayuda de CORS
components/Cabecera.tsx   wordmark, secciones, salir
data/episodes.json        títulos, fechas, duraciones, keys de R2
scripts/                  Node (.mjs), opcionales; r2.mjs y convertir.mjs
                          los usa el workflow de GitHub Actions
.github/workflows/        "Convertir capítulo": ffmpeg en GitHub, sin instalar
                          nada; secretos R2_* del repo
tests/                    node --test, con fixtures generados con ffmpeg
```

**Los scripts van en Node, no en bash.** Se corren en Windows tanto como
en Mac. Si agregás uno, seguí con `.mjs` y `spawnSync`, y respetá las
variables `FFMPEG` y `FFPROBE` para quien tenga ffmpeg portable
(`scripts/_ffmpeg.mjs` ya lo resuelve).

## Diseño

La dirección está tomada y no es un clon de Netflix. Si agregás pantallas,
seguí estos tokens en vez de inventar otros. Están todos arriba de
`app/globals.css`.

```
--ink    #0d1f26   fondo, azul petróleo (no negro)
--ink-2  #142c35   superficies levantadas
--line   #26505c   bordes
--line-2 #3b7386   bordes en hover
--bone   #e8e2d4   texto principal, color papel
--muted  #8aa0a5   texto secundario
--brick  #c1544a   acento. Solo lo que se puede tocar.
--mint   #7fb09c   progreso y "visto". Nada más.
```

Tipografía: Archivo y Archivo Narrow, de Omnibus-Type, fundición de Buenos
Aires. Están alojadas en `app/fonts/` (woff2, licencia OFL al lado) para que
el build no dependa de la red. Narrow solo para números y teclas. No
agregues una tercera familia.

Reglas que ya se aplicaron y conviene sostener: el acento ladrillo se usa en
un solo lugar por pantalla (el botón principal), los radios son de 3 px en
todo, y no hay transform en hover (solo cambia el borde y el brillo). El
wordmark va en caja baja: es una frase hablada, no una placa.

**El reproductor** (`/ver/[id]`) no tiene cabecera ni márgenes: ocupa la
ventana entera, fondo negro, con controles propios sobre el video que se
esconden a los 3 s (`.cine`). Reanuda solo desde el progreso guardado con
un toast para empezar de nuevo, arranca solo si el navegador lo permite y
si no muestra el botón grande. El engranaje abre un panel con la intro, la
portada y las teclas. Progreso en menta; el botón ladrillo sólo aparece en
las capas de fin de capítulo y de error.

**Movimiento.** `app/template.tsx` se vuelve a montar en cada navegación y
hace entrar la página con un fundido corto (`.pagina`). Las tarjetas de la
grilla entran escalonadas con la variable `--i`. Las capas del reproductor
aparecen con fundido y desenfoque, y la cuenta regresiva al siguiente
capítulo tiene una barra menta que se vacía en 12 s. Duraciones de 150 a
400 ms, curva `cubic-bezier(0.2, 0.7, 0.2, 1)`, nada rebota. Con
`prefers-reduced-motion` todo se apaga. La cabecera es fija, con fondo
translúcido y desenfoque.

Las imágenes de los capítulos: `Arte.tsx` dibuja siempre la trama diagonal
y el número con CSS. Encima, con fundido, va la portada si existe: la que
el reproductor capturó del video (`/api/arte/[id]`, anotada en
`marcas.json`) o, si alguien corrió `prepare-videos`, la de `public/art/`
del campo `arte`. Las portadas las genera el servidor la primera vez que
alguien las pide (`/api/arte/[id]`, `lib/cuadro.ts`): lee el índice del mp4
para saber la duración, elige un momento (20 s después de la intro si está
marcada; si no, el 12 % del capítulo, entre 1 y 5 minutos) y le pide ese
cuadro a ffmpeg. ffmpeg viene del paquete `@ffmpeg-installer/ffmpeg`, se deja
fuera del bundle (`serverExternalPackages`) y se incluye en la función con
`outputFileTracingIncludes`. Como ese binario estático no resuelve nombres
de dominio, no se le da la URL de R2: un servidor HTTP mínimo en 127.0.0.1
reenvía los Range firmados por Node. `/estado` tiene un botón que las pide
de a una para ver si alguna falla, y el reproductor permite elegir otro
cuadro a mano.

## Textos

Todo en español rioplatense, de vos, en registro de mensaje entre conocidos.
Sin mayúsculas de etiqueta, sin flechitas al final de los botones, sin
disculpas en los errores. Un error dice qué pasó y qué hacer.

Los botones dicen la acción exacta: "seguir desde 12:41", no "Continuar".

## Estado

`data/episodes.json` tiene los 24 episodios con título y fecha de emisión.
**La temporada 1 tiene 13 episodios y la 2 tiene 11**, no 12 y 12: si algo
asume simetría entre temporadas, está mal. `npm test` lo verifica.

`sinopsis` está vacío en los 24 a propósito. Los resúmenes de Wikipedia y de
las páginas de series son texto de otro; si se quieren sinopsis, se escriben.

`duracion` está en 0 hasta que alguien la cargue; mientras, la tarjeta usa la
duración que el navegador vio la última vez que se reprodujo el capítulo.

Ver `TAREAS.md`.
