# Fuego tiene?

Sitio para ver Los Simuladores desde archivos propios. Se entra sin
contraseña: el juego es la puerta, y los capítulos se abren cuando alguien
arma un operativo que salga bien. Next.js 15 (App Router) en Vercel, videos
en Cloudflare R2. Sin base de datos.

El dueño del proyecto no puede instalar nada en su compu: ni Node, ni git,
ni ffmpeg. Todo lo que él hace pasa por pantallas: Vercel, Cloudflare y
Cyberduck. Cada decisión de este repo tiene que sostener eso. Si una tarea
"requiere correr algo en su máquina", está mal planteada.

## Invariantes de arquitectura

Estas cosas son decisiones tomadas, no defaults. Si vas a cambiar alguna,
avisá antes en vez de hacerlo al pasar.

**El sitio no puede costar plata.** No llama a ninguna API paga y no hay que
dejarlo así por descuido: es la condición para que exista. El desenlace del
juego lo escribe `lib/simulacro.ts`, código local y determinista. Hubo una
versión que se lo pedía a Claude cuando había una clave cargada, y se sacó
—junto con la dependencia— el día que el sitio pasó a ser público: entra
cualquiera con el link y cada partida se le facturaba al dueño. Si alguna vez
vuelve, tiene que venir con algo que la haga imposible de gastar sin querer
(un tope duro del lado del proveedor, o sólo para el dueño), no con un
contador en memoria. Lo mismo vale para cualquier otro servicio con factura:
esto se banca con el plan gratis de Vercel y el de R2, que no cobra por lo
que se baja.

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

**Al sitio se entra sin nada y los capítulos se ganan jugando.** No hay
contraseña ni registro: quien abre la dirección ve el juego y el origen. Los
capítulos y el expediente se abren cuando arma un operativo que saca 70 sobre
100 o más. `/juego` no es un adorno al costado: es la puerta, y la primera
pantalla que ve cualquiera.

Lo decide el servidor con `evaluarPlan`, que es determinista, y nunca el
navegador: si el puntaje dependiera del cliente, cualquiera pediría 100. Lo
que acredita
haber pasado es el "pase", una cookie firmada con el mismo HMAC de la sesión
(`lib/auth.ts`). **El pase vale por sí mismo, sin sesión**: es lo que deja
entrar a alguien que llegó sin ningún código. Lleva adentro un id —el del
código si entró con uno, o uno anónimo— que sirve para anotarlo, no para
validarlo. El middleware lo mira en cada pedido, y `/api/stream/[id]` lo
vuelve a mirar por su cuenta.

Si vas a tocar `lib/simulacro.ts`, tené presente que los puntajes son una
puerta: bajarle el puntaje a un plan bueno deja gente afuera.

**Tres niveles, y el de abajo es cualquiera.** Quien llega sin nada juega
para entrar. Los códigos de `CODIGOS_LIBRES` se saltean el juego, y nada más.
Los de `CODIGOS_DUENO` además entran a `/estado` y `/subir`: mirar el bucket y
escribir en él es del dueño del sitio, no de cualquiera que gane el juego.
Cada nivel implica el de abajo, y estar nombrado en cualquiera de las tres
variables alcanza para entrar con código: `leerConfig` las suma. **Ninguna es
obligatoria**: un sitio sin un solo código anda perfecto, que es el caso
normal ahora. Lo único que no puede faltar es `SESSION_SECRET`, que firma el
pase.

El middleware tiene la lista `SOLO_DUENO`, y `/api/subir` y `/api/estado` lo
vuelven a chequear por su cuenta, porque una firma de escritura sobre el
bucket no depende de que el middleware haya corrido. `/api/estado/[id]` queda
afuera de esa lista a propósito: es el diagnóstico de un capítulo y el
reproductor lo usa para explicar por qué un video no anda, en la pantalla de
cualquiera. Las rutas de API resuelven todo esto con `quienPide` de
`lib/pases.ts`, que devuelve `{ entra, dueno }`.

**No hay base de datos.** No hay cuentas ni registro: la mayoría de la gente
entra sin identidad ninguna. Los códigos que existen salen de variables de
entorno, y la cookie guarda un hash del código, no el código: sacar un código
de la variable desloguea a esa persona en el acto. El
progreso de reproducción vive en el `localStorage` de cada navegador. Lo
compartido entre navegadores son dos JSON chicos que viven en el bucket al
lado de los videos y que el sitio lee y reescribe enteros: `marcas.json`, con
las anotaciones por capítulo (dónde está la intro, si hay portada), y
`pases.json`, el registro de quiénes ganaron el juego y con cuánto. Para
quien entró con código sirve además para no hacerlo jugar de nuevo desde otro
navegador; para el resto es la bitácora, acotada a `MAX_PASES` porque el
archivo se lee y reescribe entero (`lib/marcas.ts`,
`lib/puerta.ts`, `lib/pases.ts`, `lib/almacen.ts`). Las portadas son JPEG de ~50 KB en
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

## Las secciones y el menú

El menú tiene cuatro: **capítulos** (`/`), **el expediente** (`/expediente`),
**el juego** (`/juego`) y **el origen** (`/origen`). "capítulos" y "el
expediente" llevan un candado al lado hasta que la persona gana el juego, y
los enlaces siguen vivos a propósito: quien los toca cae en `/juego`, que
explica el trato. Eso enseña la regla mejor que un enlace muerto. "salir"
aparece sólo si hay una sesión que cerrar, o sea casi nunca.

`/subir` y `/estado` **no están en el menú a propósito**: los 24 capítulos ya
están cargados y son pantallas de mantenimiento. No se borraron: el dueño
llega escribiendo la dirección, y el reproductor le enlaza a `/estado` cuando
un video falla. Al resto el middleware lo devuelve a los capítulos.

La sección de lectura se llamaba `/serie`. El nombre daba a entender que los
capítulos estaban ahí, así que pasó a **el expediente**, con un redirect
permanente en `next.config.ts` para que no se rompa ningún enlace guardado.
Si se vuelve a renombrar, son tres lugares: la carpeta de `app/`, el `href`
de `components/Cabecera.tsx` y ese redirect.

`/origen` cuenta por qué existe el sitio: alguien buscó la serie en las
plataformas que paga, no estaba en ninguna, y la subió a un bucket. El texto
vive entero en `lib/origen.ts`, en cinco capítulos numerados, y la página
sólo lo pone en pantalla. El tono es contenido: la épica sale de los hechos,
no de los adjetivos. El acento ladrillo va una sola vez, en la última frase
(`.relato__cierre`, marcado desde el componente: un `:last-child` no sirve
porque cada capítulo va envuelto en su propio `Revelar`).

## Comandos

```bash
npm run dev                      # local en :3000
npm run build                    # verificar que compila antes de deployar
npm test                         # tests de auth, puerta, r2, mp4, marcas, simulacro, serie y episodes.json
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
app/expediente/page.tsx   el expediente: legajos, método y Szifrón
app/origen/page.tsx       el origen: por qué existe el sitio
app/juego/page.tsx        el simulacro -> Juego (client)
app/estado/page.tsx       mantenimiento: estado de cada archivo. Fuera del menú.
app/subir/page.tsx        mantenimiento: subida al bucket. Fuera del menú.
app/api/subir             firma una URL de PUT para un nombre válido
app/api/marcas            lee y escribe marcas.json (intro por capítulo)
app/api/arte/[id]         portada JPEG: la devuelve (GET) o la guarda (POST)
app/api/simulacro         evalúa el plan del juego. Local: no sale a internet.
lib/serie.ts              datos de la serie, los cuatro y Szifrón. Escrito, no copiado.
lib/origen.ts             el relato de por qué existe el sitio. Cinco capítulos.
lib/simulacro.ts          casos del juego + motor que puntúa y narra
lib/puerta.ts             las reglas de la puerta: cuánto hay que sacar y cómo
                          se anota. No importa nada: se testea solo.
lib/pases.ts              pases.json en el bucket, el estado para las páginas
                          y quienPide() para las rutas. La parte de la puerta
                          que necesita Node.
lib/cuadro.ts             ffmpeg: saca un cuadro del video para la portada
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
components/Expediente.tsx las cuatro fichas y el legajo que se abre
components/Juego.tsx      el juego: caso, plan y desenlace
components/Revelar.tsx    deja aparecer una sección cuando entra en pantalla
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
todo, y **la tarjeta no se mueve en hover**: cambian el borde, el fondo y el
brillo, y la imagen de adentro hace un zoom lento sin correr la grilla. El
wordmark va en caja baja: es una frase hablada, no una placa.

**El reproductor** (`/ver/[id]`) no tiene cabecera ni márgenes: ocupa la
ventana entera, fondo negro, con controles propios sobre el video que se
esconden a los 3 s (`.cine`). Reanuda solo desde el progreso guardado con
un toast para empezar de nuevo, arranca solo si el navegador lo permite y
si no muestra el botón grande. El engranaje abre un panel con la intro, la
portada y las teclas. Progreso en menta; el botón ladrillo sólo aparece en
las capas de fin de capítulo y de error.

**Movimiento.** `app/template.tsx` se vuelve a montar en cada navegación y
hace entrar la página con un fundido corto (`.pagina`). Ese fundido es
**sólo de opacidad**: una animación de `transform` ahí convierte al
contenedor en bloque contenedor de los elementos `fixed` y le rompe la
pantalla entera al reproductor. Las tarjetas de la
grilla entran escalonadas con la variable `--i`. Las capas del reproductor
aparecen con fundido y desenfoque, y la cuenta regresiva al siguiente
capítulo tiene una barra menta que se vacía en 12 s. Duraciones de 150 a
400 ms, curva `cubic-bezier(0.2, 0.7, 0.2, 1)`, nada rebota. Con
`prefers-reduced-motion` todo se apaga. La cabecera es fija, con fondo
translúcido y desenfoque. Además: la imagen de la tarjeta hace zoom al pasar
el mouse, la portada del destacado respira despacio, las secciones de
`/expediente` y `/origen` aparecen al llegar a la pantalla (`components/Revelar.tsx`, que
muestra igual si no hay IntersectionObserver) y las fases del desenlace del
juego entran escalonadas.

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

## El juego (`/juego`)

Te dan un caso, escribís el operativo y se simula cómo sale. El que evalúa es
`lib/simulacro.ts`: detecta en el texto los elementos de un operativo
(estudio previo, personaje, montaje, orden, reparto, salida, contingencia),
descuenta por violencia, por hablarle de frente al otro y por delegar en la
justicia, y arma el relato en cuatro fases. **Es determinista y no usa red**:
la variedad sale de un hash del propio texto, con tres variantes por fase.
Por eso se puede testear como cualquier función.

`/api/simulacro` no sale a internet: recibe el plan, lo evalúa y devuelve el
relato en el mismo pedido, en milisegundos. **El juego nunca se queda sin
respuesta y nunca genera un gasto.**

Al agregar detectores, cuidado con el español: "Santos **arma** el
operativo" no es un arma, y "amena**c**e" no lleva z. Los dos casos están en
los tests.

**El juego es la puerta.** El puntaje no es sólo un número: de él dependen
los capítulos. Cómo funciona, de punta a punta:

1. Alguien abre la dirección del sitio. El middleware no le ve el pase y lo
   manda a `/juego`, donde un cartel dice el trato y cuánto hay que sacar.
   No se le pide nada: ni código, ni mail, ni registro.
2. Escribe un plan y lo manda. `/api/simulacro` lo evalúa con `evaluarPlan`.
   Si el puntaje llega al mínimo, la misma respuesta trae la cookie del pase
   y anota el puntaje en `pases.json`. El cliente recibe además un objeto
   `puerta` con `minimo`, `puntaje`, `paso` y `recien`, y con eso muestra el
   bloque que se abre o dice cuánto falta.
3. A partir de ahí el middleware lo deja pasar, y `/api/stream/[id]`
   revalida el pase por su cuenta antes de firmar nada.
4. El pase es una cookie, así que vive en ese navegador. Quien tiene código
   además lo recupera al entrar: `/api/entrar` busca su puntaje en
   `pases.json` y le devuelve el pase sin hacerlo jugar de nuevo.

El mínimo es 70 y se cambia con `PUNTAJE_PARA_ENTRAR` sin tocar código. Se
puede intentar las veces que uno quiera, con cualquiera de los seis casos, y
el pase se queda con el mejor puntaje: nadie pierde la entrada por volver a
jugar y salir peor.

**`/api/simulacro` es pública**, porque es la puerta: cualquiera que abra el
sitio la llama sin tener nada. Por eso no puede hacer nada que cueste plata
ni que tarde: evalúa con una función local y contesta. Si alguna vez se le
agrega algo que cobre por uso, esa ruta es el primer lugar donde mirar.

Tres cosas que ya se rompieron una vez y conviene no repetir: el enlace a los
capítulos desde el juego es un `<a>` y no un `<Link>`, porque el router de
Next prefetchea `/` cuando todavía no hay pase y después sirve ese rebote de
su cache; al abrirse la puerta se llama a `router.refresh()`, porque la
cabecera se arma en el servidor y si no el candado se queda puesto
contradiciendo al cartel; y **`/ver/[id]` es una página estática** (SSG, por
`generateStaticParams`), así que no puede leer cookies para decidir qué
mostrar: el intento de pasarle si es el dueño desde el servidor dio un error
de hidratación que sólo aparecía en el build de producción. Ese dato viaja en
la respuesta de `/api/estado/[id]`, que el reproductor ya consulta cuando un
video falla, que es justo cuando hace falta.

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
