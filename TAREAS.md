# Tareas y decisiones pendientes

## Para que el sitio quede andando

- [ ] Conectar el repo a Vercel y cargar `SESSION_SECRET` y `ACCESS_CODES`.
      Ver `PASOS.md`, paso 1.
- [ ] Crear el bucket `fuego-tiene` y el token en R2. Paso 3.
- [ ] Cargar las cuatro variables de R2 en Vercel y hacer Redeploy. Paso 4.
- [ ] Subir **un** capítulo con Cyberduck y mirar `/estado`. Pasos 5 y 6.
- [ ] Según el veredicto: subir los otros 23, o decidir cómo convertir.

## Si hay que convertir

`/estado` dice qué falla en cada archivo. El camino es el workflow
**Convertir capítulo** de GitHub Actions (ver `PASOS.md`): sin instalar
nada, con los cuatro secretos de R2 cargados en el repo. Alternativas para
quien sí tenga Node y ffmpeg: `npm run prepare-videos -- <carpeta>` sobre
los archivos locales, o `node scripts/convertir.mjs entrada salida.mp4`.

- [ ] El 2x05 ("El vengador infantil") tiene el video en un formato que el
      navegador no decodifica: se escucha y no se ve. Convertirlo con el
      workflow. Primera corrida real del workflow: confirmar que los
      secretos están y que el runner tiene ffmpeg.

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

## Técnicas, para verificar con el primer archivo real

- [ ] **Firma de URLs de R2.** Se hace con `aws4fetch` (lo que usan los
      ejemplos de Cloudflare). Se probó la forma de la URL pero no contra un
      bucket real. Si el primer capítulo da 403 en el navegador, `/estado`
      lo dice; la alternativa es agregar `@aws-sdk/s3-request-presigner`
      (el SDK de AWS ya está como devDependency para `scripts/upload.mjs`).
- [ ] **Subida desde el navegador.** `/subir` usa URLs firmadas de PUT
      (aws4fetch) y exige una política CORS en el bucket. Se probó con un
      R2 simulado; la primera subida real confirma la firma y la política.
      Cualquier persona con un código puede subir: es un sitio de
      confianza entre conocidos. Si eso molesta, se puede limitar a un
      código concreto.
- [ ] **Portadas con ffmpeg en Vercel.** Se generan en el servidor con el
      binario de `@ffmpeg-installer/ffmpeg`, incluido en la función por
      `outputFileTracingIncludes`. Probado en local; en Vercel hay que
      confirmar que el binario viaja con permiso de ejecución (si no, se
      copia a /tmp solo) y que la función termina dentro de los 60 s. Si
      falla, el botón de /estado muestra el motivo exacto.
- [ ] **Portada manual y CORS.** Elegir un cuadro desde el reproductor pide
      el video con `crossorigin` y depende de la política CORS del bucket.
      Sin ella el video anda igual (retroceso automático) pero no hay
      captura manual.
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
