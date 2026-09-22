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

## La puerta y los usuarios

Al sitio se entra sin contraseña: quien abre la dirección ve el juego y el
origen, y los capítulos y el expediente se abren cuando arma un operativo que
saca 70 sobre 100. Está andando; lo que queda abierto es esto:

- [ ] **El número.** 70 es la primera calibración, elegida contra los planes
      de prueba. Cuando juegue gente de verdad va a quedar claro si deja
      afuera a alguien que se tomó el trabajo. Se cambia con la variable
      `PUNTAJE_PARA_ENTRAR`, sin tocar código ni perder los pases ya dados.
- [x] **El código del dueño va en `CODIGOS_DUENO`**, que es el único nivel
      que llega a `/estado` y `/subir`. `CODIGOS_LIBRES` quedó para quien
      mira la serie sin jugar y no tiene por qué tocar el bucket.
- [ ] Nadie puede perder el pase: `pases.json` se queda con el mejor puntaje
      y el pase dura 180 días como la sesión. Si alguna vez hay que sacarle
      la entrada a alguien, hoy se hace borrando su línea de `pases.json` con
      Cyberduck. Si eso pasa seguido, conviene una pantalla.
- [ ] El plan se puede copiar de otra persona, y la cookie del pase también
      se puede pasar. Como cualquiera puede ganar jugando, no cambia nada;
      anotado por las dudas.
- [ ] **El sitio es público.** Cualquiera con la dirección llega a la serie
      pasando el juego. Si algún día hay que cerrarlo de nuevo, el cambio es
      chico: volver a pedir sesión en el middleware para todo lo que no sea
      /entrar.
- [ ] **`/api/simulacro` es pública y puede gastar la clave de Claude.** Hay
      un tope de diez narraciones por visitante por hora, pero vive en la
      memoria de la función de Vercel y se pierde cuando la reciclan. Si
      aparece una factura rara, sacar `ANTHROPIC_API_KEY`: el juego anda
      igual con el simulador local.
- [ ] Marcar la intro y guardar una portada lo puede hacer cualquiera que
      gane el juego, no sólo el dueño. Es lo que había antes y no molesta,
      pero ahora el conjunto es más grande. Si alguna vez molesta, esas dos
      rutas piden `dueno` en vez de `entra`.

**Cuentas de usuario**, que era la idea anterior y quedó reemplazada por la
puerta, ahora que ni siquiera hay códigos de por medio. Si algún día se retoma (para que cada uno tenga su nombre y su
progreso, no sólo un código), el camino que no traiciona el "sin base de
datos" es el mismo que usa `pases.json`:

- Un `usuarios.json` en el bucket: nombre, hash de la contraseña con PBKDF2
  (Web Crypto, que anda en Edge y en Node), rol y fecha de alta.
- Rol `admin` (el dueño) para aprobar altas, subir y ver `/estado`; rol
  común para ver, leer y jugar. La puerta seguiría valiendo para el rol común.
- Sin mails: el alta queda pendiente y el admin la aprueba desde una pantalla.
- Cuidado con dos personas aprobando a la vez: el JSON se reescribe entero.

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
      política CORS puesta: así subieron los capítulos grandes. Ya no la puede
      usar cualquiera: `/subir`, `/estado` y sus dos APIs son sólo para los
      códigos de `CODIGOS_DUENO`.
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
