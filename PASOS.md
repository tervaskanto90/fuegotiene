# Pasos, desde cero y sin instalar nada

Todo lo que sigue se hace en pantallas: GitHub, Vercel, Cloudflare y
Cyberduck. Nada de terminal, nada de Node. El código ya está en el repo de
GitHub; vos lo conectás a Vercel, creás el bucket, cargás las variables y
subís los capítulos.

El orden importa: primero el sitio andando con el clip de muestra, después
R2, después **un solo capítulo**, y recién al final los otros 23.

## 1. Publicar el sitio en Vercel

1. Entrá a **vercel.com** y creá la cuenta con **Continue with GitHub**. El
   plan Hobby, gratis, alcanza y sobra: el video no pasa por Vercel.
2. Arriba a la derecha, **Add New…** y después **Project**.
3. En **Import Git Repository** buscá `fuegotiene` y tocá **Import**. Si no
   aparece, hay un enlace **Adjust GitHub App Permissions** para darle acceso
   a ese repo.
4. En la pantalla de configuración, Vercel detecta solo que es Next.js. No
   toques nada de build. Abrí la sección **Environment Variables** y cargá
   dos, una por una:

   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | una frase larga que sólo vos sepas, 32 caracteres o más, con algún número. Firma la cookie de sesión. No la vas a tener que escribir nunca más. |
   | `ACCESS_CODES` | tu código de acceso. Es lo que vas a escribir para entrar. Mínimo 6 caracteres, mejor 12 o más. Si querés dar acceso a más gente, más códigos separados por coma: `codigo-mio,codigo-de-mama` |

5. **Deploy**. Tarda un par de minutos. Cuando termina, **Visit**.
6. El sitio te lleva a `/entrar`. Poné tu código. Vas a ver la portada con
   los 24 capítulos y, si abrís uno, el clip de muestra de 20 segundos, con
   un cronómetro y un tic por segundo. Si se escucha el tic, la parte del
   sitio está bien.
7. Entrá a **/estado** (está en el menú). Arriba dice cómo está la
   configuración: los códigos cargados y que todavía está en modo demo.

Si `/entrar` muestra un aviso rojo en vez del formulario, dice exactamente
qué variable falta o está corta. Se arregla en **Settings → Environment
Variables** y después **Deployments → ⋯ → Redeploy**: las variables nuevas
sólo entran en un deploy nuevo.

Sobre la rama: el repo tiene una sola rama, `claude/fuego-tiene-project-q2crcs`,
y Vercel la usa como producción porque es la única. Cada vez que yo suba un
cambio ahí, Vercel vuelve a publicar solo. Más adelante se puede renombrar
a `main` desde GitHub, pero no hace falta para nada de esto.

## 2. Probar el clip de muestra como si fuera un capítulo

Con el clip andando, probá lo que después vas a usar de verdad:

- arrastrá la barra al medio y fijate que siga desde ahí,
- cerrá la pestaña a los 10 segundos, volvé a la portada: tiene que ofrecer
  **seguir desde 0:10** (ojo: para que aparezca hacen falta al menos 30
  segundos vistos, así que en el clip de 20 no lo vas a ver; sí en un capítulo),
- dejalo terminar: ofrece el siguiente y cuenta 12 segundos,
- las teclas: espacio, flechas, `f` para pantalla completa, `n` siguiente.

## 3. Crear el bucket en Cloudflare R2

1. Cuenta gratis en **dash.cloudflare.com**. R2 pide una tarjeta para activarse
   aunque el uso quede dentro de lo gratis (10 GB guardados por mes;
   bajar datos no se cobra nunca). 24 capítulos de 1 GB son unos 24 GB, así
   que va a costar del orden de medio dólar por mes.
2. En el menú, **R2 Object Storage** y **Create bucket**. Nombre
   `fuego-tiene`. Ubicación automática. Dejalo privado: no toques nada de
   "public access" ni dominios.
3. En la pantalla de R2, a la derecha, está el **Account ID**: una tira de 32
   letras y números. Copiala.
4. **Manage R2 API Tokens** (o "API" → "Manage API tokens") → **Create API
   token**:
   - Permissions: **Object Read & Write**.
   - Specify bucket(s): **Apply to specific buckets only** → `fuego-tiene`.
   - TTL: **Forever**.
   - **Create API Token**.
5. Te muestra **Access Key ID** y **Secret Access Key**. Copiá los dos ahora,
   a un lugar seguro: el secret se ve una sola vez. Si lo perdés, se crea otro
   token y listo.

## 4. Conectar el sitio con R2

En Vercel, **Settings → Environment Variables**, cargá cuatro más:

| Name | Value |
|---|---|
| `R2_ACCOUNT_ID` | el Account ID de 32 caracteres |
| `R2_ACCESS_KEY_ID` | el Access Key ID del token |
| `R2_SECRET_ACCESS_KEY` | el Secret Access Key del token. Marcá **Sensitive** si te lo ofrece. |
| `R2_BUCKET` | `fuego-tiene` |

Después **Deployments → ⋯ en el último → Redeploy**. Cuando termina, el
sitio deja el modo demo solo. **/estado** ahora dice "R2 conectado" y abajo
los 24 capítulos figuran como "no está en el bucket", que es lo esperado.

Si en cambio /estado muestra un error en rojo en cada fila, lo más común es
que alguna de las cuatro variables tenga un espacio de más o esté cortada.

## 5. Subir un solo capítulo con Cyberduck

Está explicado paso a paso en **SUBIR-CON-CYBERDUCK.md**. Lo importante:

- el archivo se tiene que llamar exactamente como el sitio lo busca:
  `s01e01.mp4` para el primero de la primera temporada, `s02e11.mp4` para el
  último de la segunda. La temporada 1 tiene 13, la 2 tiene 11. Se renombra
  con clic derecho en Cyberduck, o antes en la carpeta de Windows;
- **subí uno solo primero.**

Si preferís no renombrar 24 archivos, pasame los nombres que tienen y yo
cambio el campo `key` de cada capítulo en `data/episodes.json`.

## 6. Mirar /estado antes de subir el resto

Abrí **/estado**. La fila del capítulo que subiste va a decir una de estas
cosas, y qué hacer:

| Resultado | Qué significa | Qué hacer |
|---|---|---|
| **listo** | mp4 con video H.264, audio AAC y el índice al principio. | Abrilo y miralo. Subí los otros 23 igual. |
| **sin sonido** | el audio es AC-3 o DTS: se ve pero no se escucha en Chrome. | Hay que convertir el audio a AAC. Avisame y vemos la opción más simple. |
| **arranque lento** | el índice del video está al final del archivo: tarda en arrancar y saltar en la barra se traba. | Hay que remuxar con `+faststart`. Es rápido, no recomprime. Avisame. |
| **no se reproduce** | es .avi, .mkv, DivX/Xvid o H.264 de 10 bits. | Hay que convertirlo. Avisame con lo que dice la fila. |
| **no está en el bucket** | el nombre no coincide. | Fijate el nombre en Cyberduck, o pasámelo para que cambie el `key`. |

Cualquier conversión necesita ffmpeg en alguna compu. No lo demos por hecho
hasta ver el veredicto: puede que tus archivos anden tal cual.

## 7. Subir los otros 23

Mismo Cyberduck, mismos nombres. Cuando /estado muestre los 24 en verde,
terminaste. Los progresos de reproducción quedan en cada navegador, no hace
falta configurar nada más.

## Después

- **Dar acceso a alguien**: agregá otro código a `ACCESS_CODES`, separado por
  coma, y Redeploy. Le pasás el código y la dirección del sitio.
- **Sacarle el acceso a alguien**: borrá su código de la variable y Redeploy.
  Su sesión deja de valer en el acto.
- **Dominio propio**: en Vercel, Settings → Domains. Opcional.
- Lo que falta o queda para decidir está en **TAREAS.md**.
