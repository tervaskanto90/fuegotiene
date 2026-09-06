# Subir los capítulos con Cyberduck

El panel web de R2 tiene un límite por archivo de unos 300 MB y tus capítulos
pesan cerca de 1 GB, así que por ahí no entran. Cyberduck es un programa con
ventanas que sí puede: parte los archivos grandes solo, muestra el progreso y
retoma si se corta.

Ninguna terminal. Esto reemplaza a `npm run upload`.

## 1. Sacar las credenciales de R2

Está en detalle en `PASOS.md`, paso 3. En resumen, en **dash.cloudflare.com**
→ **R2**:

1. **Create bucket**, nombre `fuego-tiene`. Dejalo privado.
2. **Manage R2 API Tokens** → **Create API Token**.
3. Permiso: **Object Read & Write**. Alcance: sólo el bucket que acabás de crear.
4. Te va a mostrar **Access Key ID** y **Secret Access Key**. Copiálos ahora:
   el secret se muestra una sola vez y después no lo ves más.
5. El **Account ID** está en la pantalla principal de R2, a la derecha. Es
   una tira de 32 caracteres.

## 2. Instalar Cyberduck y el perfil de R2

1. Bajá Cyberduck de **cyberduck.io/download**.
2. El perfil de conexión de R2 se llama **Cloudflare R2 Storage (S3)**. Hay
   dos formas de tenerlo: bajarlo de **profiles.cyberduck.io** y hacerle doble
   clic, o dentro de Cyberduck ir a **Preferences → Profiles**, buscar
   "Cloudflare" y tildarlo.

## 3. Conectar

En Cyberduck, **Open Connection**. En el desplegable de arriba elegí
**Cloudflare R2 Storage (S3)**.

| Campo | Qué va |
|---|---|
| Server | `TU_ACCOUNT_ID.r2.cloudflarestorage.com` |
| Access Key ID | el que copiaste |
| Secret Access Key | el que copiaste |
| Path | `fuego-tiene` |

**Ese campo Path es la trampa.** Como el token es de tipo *Object Read &
Write*, no tiene permiso para listar los buckets de la cuenta, así que
Cyberduck no puede mostrarte la lista y tenés que escribir el nombre del
bucket a mano. Si lo dejás vacío, la conexión falla y el error no te dice por
qué. Puede estar escondido en **More Options**.

**Connect**. Si entra, ves una ventana vacía: es el bucket.

## 4. Antes de subir 24 archivos, probá uno

Arrastrá **un solo capítulo** a la ventana. Renombralo `s01e01.mp4` (clic
derecho → Rename), o el nombre que le corresponda: el sitio busca los
archivos por ese nombre exacto.

Después, con las cuatro variables de R2 ya cargadas en Vercel, abrí
**/estado** en el sitio. La fila de ese capítulo te dice si el archivo está,
cuánto pesa, qué códecs trae y una de estas cosas:

- **listo**: subí el resto tal cual y terminaste.
- **sin sonido**: el audio viene en AC-3 o DTS y Chrome no lo reproduce. Hay
  que convertir el audio.
- **arranque lento**: el índice está al final del archivo. Hay que remuxar
  con `+faststart`.
- **no se reproduce**: es .avi, .mkv, DivX o H.264 de 10 bits. Hay que
  convertir.

Si alguna falla, ese es el momento de hablar de ffmpeg, y recién ahí.

## 5. Los nombres

El sitio busca cada capítulo por el `key` que figura en
`data/episodes.json`. Por defecto son `s01e01.mp4` hasta `s01e13.mp4` y
`s02e01.mp4` hasta `s02e11.mp4`.

Ojo: **la temporada 1 tiene 13 y la 2 tiene 11.**

Si preferís no renombrar 24 archivos, se puede al revés: editar el campo
`key` de cada episodio en `data/episodes.json` para que apunte al nombre que
ya tienen. Cualquiera de las dos sirve, pero elegí una. Evitá nombres con
`?`, `#` o `%`; espacios y acentos andan pero es más fácil sin.

## 6. Subtítulos, si tenés

Un archivo `.vtt` por capítulo, subido al mismo bucket, y su nombre en el
campo `sub` del episodio. Los `.srt` hay que convertirlos a `.vtt` antes; el
sitio no lo hace solo. Sin subtítulos el sitio anda igual.
