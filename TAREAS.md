# Tareas y decisiones pendientes

## Para que el sitio quede andando

Esto ya está: el sitio anda con los 24 capítulos arriba.

- [x] Conectar el repo a Vercel y cargar `SESSION_SECRET` y `ACCESS_CODES`.
- [x] Crear el bucket `fuego-tiene` y el token en R2.
- [x] Cargar las cuatro variables de R2 en Vercel y hacer Redeploy.
- [x] Subir los 24 capítulos y mirar `/estado`.
- [x] Política CORS en el bucket, que es lo que habilita `/subir` desde el
      navegador y la captura manual de portadas.

## Si hay que convertir

`/estado` dice qué falla en cada archivo. El camino es el workflow
**Convertir capítulo** de GitHub Actions (ver `PASOS.md`): sin instalar
nada, con los cuatro secretos de R2 cargados en el repo. Alternativas para
quien sí tenga Node y ffmpeg: `npm run prepare-videos -- <carpeta>` sobre
los archivos locales, o `node scripts/convertir.mjs entrada salida.mp4`.

- [x] El 1x05 llegó en .avi y el 2x05 en un formato que el navegador no
      decodifica. Los dos pasaron por el workflow **Convertir capítulo** y
      quedaron en H.264 + AAC con `+faststart`. El workflow está probado de
      verdad: si aparece otro archivo raro, es el mismo camino.

## Del expediente y del juego

- [ ] Los datos de `lib/serie.ts` se cruzaron entre fuentes públicas. Los
      años de nacimiento de los actores tienen menos respaldo que el resto
      (de Peretti hay fuentes que dicen 10 y otras 25 de febrero de 1963;
      quedó sólo el año). Si algo está mal, se corrige en ese archivo.
- [ ] Faltan los invitados: la serie tuvo un desfile de actores por capítulo
      que hoy no está en ningún lado del sitio.
- [ ] El juego no guarda nada: cada partida arranca de cero y el plan se
      pierde al recargar. Si se quiere historial, va en `localStorage`,
      no en el bucket.
- [ ] Los seis casos son inventados, en el espíritu de la serie. Se pueden
      agregar más en `lib/simulacro.ts`: el motor no necesita cambios.
- [ ] El motor entiende los planes escritos en criollo, no sólo los que usan
      el vocabulario del oficio, y no confunde "golpea la puerta" con
      violencia. Los dos casos están en `tests/simulacro.test.ts`. Si
      aparece otro plan bueno que puntúa bajo, el arreglo es un detector
      nuevo en `ELEMENTOS` más su test, no tocar las bandas.

## Usuarios, para más adelante

Pedido y **no implementado a propósito**: que cada persona se haga su cuenta,
con un admin (el dueño) que administre las que se creen, y un usuario común
que sólo pueda ver capítulos, leer el expediente y el origen, y jugar.

Hoy la identidad es el código de acceso de `ACCESS_CODES`, y no hay base de
datos. La forma de hacerlo sin traicionar eso, cuando se decida:

- **Dónde viven los usuarios.** Un `usuarios.json` en el bucket, al lado de
  `marcas.json`, leído y reescrito entero (`lib/almacen.ts` ya sabe hacerlo).
  Cada entrada: nombre, hash de la contraseña, rol (`admin` o `mira`), fecha
  de alta y si está aprobada. Nada de una base de datos: son treinta filas
  como mucho, y el bucket ya es el lugar donde vive lo compartido.
- **Contraseñas.** PBKDF2 con Web Crypto, que es lo que ya usa `lib/auth.ts`
  y anda en Edge y en Node. Nunca la contraseña en claro, ni en la cookie ni
  en el JSON.
- **La cookie.** La misma de ahora, firmada, pero llevando el nombre de
  usuario y el rol en vez del hash del código. El middleware sigue siendo la
  puerta; el rol se chequea además en cada ruta que lo necesite, igual que
  `/api/stream/[id]` revalida la sesión por su cuenta.
- **Qué ve cada rol.** `mira`: `/`, `/ver/[id]`, `/expediente`, `/origen`,
  `/juego`. `admin`: eso más `/subir`, `/estado` y la pantalla de altas.
  Las escrituras que hoy hace cualquiera con sesión (marcar la intro, subir
  una portada, subir un archivo) pasan a pedir `admin`.
- **El alta.** Alguien se registra y queda pendiente; el admin aprueba desde
  una pantalla que lista las cuentas. Sin mails: no hay servicio de correo
  y agregarlo es otra cuenta y otra cosa que se rompe.
- **El código de acceso no se tira.** Sigue sirviendo para entrar como
  siempre, así el día que se migre nadie queda afuera.

Lo que hay que mirar antes de arrancar: dos personas aprobando cuentas al
mismo tiempo pueden pisarse, porque el JSON se reescribe entero. Con este
tamaño no importa, pero conviene saberlo.

## Datos

- [ ] **Título del último capítulo.** Las fuentes se dividen entre
      "Episodio final" (Wikipedia, cuenta de fans, Fandom) y "El capítulo
      final" (IMDb). Quedó "Episodio final". Si el dueño lo conoce con otro
      nombre, se cambia en `data/episodes.json`.
- [ ] **Fechas de emisión de 1x08 a 1x13 y de 2x10.** Wikipedia las da una
      semana antes (jueves) que IMDb y la cuenta de fans (miércoles). Quedaron
      las de IMDb, que coinciden con el día de emisión de la época. Son datos
      decorativos: sólo aparecen como "emitido el …".
- [ ] `duracion` está en 0 en los 24. Se llena a mano, o corriendo
      `npm run upload`, que la lee con ffprobe. Mientras, la tarjeta usa la
      duración que vio el navegador la última vez que reprodujo el capítulo.
- [ ] `sinopsis` vacía a propósito. Si se quieren, se escriben, se cargan en
      `data/episodes.json` y la tarjeta las muestra (hoy no las lee: agregar
      cuando existan).
- [x] Imágenes de los capítulos: el reproductor las captura solo y las
      guarda en el bucket (`art/<id>.jpg`). `prepare-videos` sigue pudiendo
      generar las de `public/art/`, que tienen prioridad si existen.
- [x] Saltear la intro: se marca una vez por capítulo desde el reproductor
      y queda en `marcas.json`, en el bucket.

## Técnicas, ya verificadas contra el bucket real

- [x] **Firma de URLs de R2** con `aws4fetch`: anda contra el bucket real.
      No hizo falta el SDK de AWS.
- [x] **Subida desde el navegador.** `/subir` con URLs firmadas de PUT y la
      política CORS puesta: así subieron los capítulos grandes. Queda una
      decisión abierta: cualquiera con un código puede subir, porque es un
      sitio de confianza entre conocidos. Si molesta, se limita a un código
      concreto (o al rol `admin`, si algún día hay usuarios).
- [x] **Portadas con ffmpeg en Vercel.** El binario de
      `@ffmpeg-installer/ffmpeg` viaja en la función y corre; los 24
      capítulos tienen su portada capturada del video.
- [x] **Portada manual y CORS.** Con la política puesta, elegir un cuadro a
      mano desde el reproductor funciona. Sin ella el video anda igual, por
      el retroceso automático.
- [ ] Vercel elige como rama de producción `main`, después `master`, después
      la rama por defecto del repo. Hoy la única rama es
      `claude/fuego-tiene-project-q2crcs`. Si se renombra a `main` en
      GitHub, revisar en Vercel: Settings → Environments → Production →
      Branch Tracking.
- [ ] Sólo el clip de `public/demo/` queda afuera del middleware. Las
      imágenes de `public/art/` piden sesión como todo lo demás, y al video
      real sólo se llega con URL firmada, que dura tres horas; si vence con
      la pestaña abierta, el reproductor recarga y sigue solo.

## Después

- [ ] Dominio propio en Vercel, si se quiere algo mejor que
      `fuegotiene.vercel.app`.
- [ ] La carpeta local "Fuego Tiene" con la versión anterior del proyecto
      queda vieja: el repo de GitHub es la única fuente.
