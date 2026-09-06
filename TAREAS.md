# Tareas y decisiones pendientes

## Para que el sitio quede andando

- [ ] Conectar el repo a Vercel y cargar `SESSION_SECRET` y `ACCESS_CODES`.
      Ver `PASOS.md`, paso 1.
- [ ] Crear el bucket `fuego-tiene` y el token en R2. Paso 3.
- [ ] Cargar las cuatro variables de R2 en Vercel y hacer Redeploy. Paso 4.
- [ ] Subir **un** capítulo con Cyberduck y mirar `/estado`. Pasos 5 y 6.
- [ ] Según el veredicto: subir los otros 23, o decidir cómo convertir.

## Si hay que convertir

`/estado` dice qué falla en cada archivo. Las opciones, de la más simple a la
menos, sabiendo que en la compu del dueño no se puede instalar nada:

1. Que alguien con ffmpeg corra `npm run prepare-videos -- <carpeta>` una
   sola vez sobre los 24 y suba la carpeta `listos/` con Cyberduck (o con
   `npm run upload`). El script copia el video sin recomprimir cuando ya es
   H.264, pasa el audio a AAC y agrega `+faststart`.
2. Un ffmpeg "portable" (un .zip que se descomprime y se usa sin instalador)
   en la compu personal, si la lista blanca lo permite. Node también existe
   en versión portable.
3. Un programa con ventanas tipo HandBrake, que hace lo mismo pero
   recomprime siempre. Más lento, pero sin terminal.

Si los archivos son `.avi` (DivX/Xvid, muy común en rips de 2002) la
conversión es inevitable, y es recompresión completa: contá una hora por
capítulo en una compu normal.

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
- [ ] Imágenes reales de los capítulos. Hoy es la trama con el número. Si
      alguien corre `prepare-videos`, guarda un cuadro de cada uno en
      `public/art/` y lo anota en el campo `arte`.

## Técnicas, para verificar con el primer archivo real

- [ ] **Firma de URLs de R2.** Se hace con `aws4fetch` (lo que usan los
      ejemplos de Cloudflare). Se probó la forma de la URL pero no contra un
      bucket real. Si el primer capítulo da 403 en el navegador, `/estado`
      lo dice; la alternativa es `@aws-sdk/s3-request-presigner`, ya
      instalada como devDependency para `scripts/upload.mjs`.
- [ ] Vercel elige como rama de producción `main`, después `master`, después
      la rama por defecto del repo. Hoy la única rama es
      `claude/fuego-tiene-project-q2crcs`. Si se renombra a `main` en
      GitHub, revisar en Vercel: Settings → Environments → Production →
      Branch Tracking.
- [ ] Las imágenes de `public/art/` y el clip de `public/demo/` quedan
      afuera del middleware (son públicas). El video real nunca: sólo se
      llega con URL firmada.

## Después

- [ ] Dominio propio en Vercel, si se quiere algo mejor que
      `fuegotiene.vercel.app`.
- [ ] La carpeta local "Fuego Tiene" con la versión anterior del proyecto
      queda vieja: el repo de GitHub es la única fuente.
