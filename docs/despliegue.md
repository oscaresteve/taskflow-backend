# TaskFlow — Despliegue

Guía para poner TaskFlow en producción. Las decisiones de stack que hay detrás están en [`decisiones.md`](./decisiones.md).
Aquí solo está el "cómo", y lo que rompe si se hace de otra forma.

## Topología

| Pieza         | Dónde               | Dominio                        |
| ------------- | ------------------- | ------------------------------ |
| Frontend      | Vercel              | `taskflow.oscaresteve.dev`     |
| Backend       | Railway (o similar) | `taskflow-api.oscaresteve.dev` |
| Base de datos | Neon                | —                              |
| Archivos      | Cloudflare R2       | dominio público del bucket     |

## El backend necesita un subdominio propio, no la URL de la plataforma

Esto no es estético: es la condición para que funcione el login.

`src/shared/security/cookies.ts` emite `accessToken` y `refreshToken` con `sameSite: "lax"`
hardcodeado y **sin** atributo `domain`. Con `sameSite: "lax"` el navegador no manda la cookie en
peticiones _cross-site_ que no sean una navegación de primer nivel — y el `fetch` de
`src/lib/http/client.ts` del frontend, con `credentials: "include"`, es exactamente eso.

Lo que decide si dos orígenes son _same-site_ es el dominio registrable, no el host:

- `taskflow.oscaresteve.dev` → `taskflow-api.oscaresteve.dev`: **same-site** (los dos cuelgan de
  `oscaresteve.dev`). La cookie viaja. No hay que tocar una línea de `cookies.ts`.
- `taskflow.vercel.app` → `taskflow-api.up.railway.app`: **cross-site** (dominios registrables
  distintos, y además ambos están en la Public Suffix List). El navegador descarta la cookie y
  **el login no funciona**, sin ningún error claro en la consola.

Así que hay que darle a Railway un dominio propio (`CNAME` desde `oscaresteve.dev`) y apuntar
`NEXT_PUBLIC_API_URL` a ese subdominio. Si en algún momento hiciera falta desplegar en dominios
distintos de verdad, el cambio obligatorio es `sameSite: "none"` + `secure: true` en las dos cookies;
`"none"` sin `secure` lo rechazan todos los navegadores.

## Variables de entorno

Las 16 que valida `src/config/env.ts`. La plantilla con los valores de local está en `.env.example`;
esta tabla es solo lo que cambia en producción.

| Variable                 | Producción                                                       |
| ------------------------ | ---------------------------------------------------------------- |
| `DATABASE_URL`           | cadena de conexión de Neon (con `sslmode=require`)               |
| `PORT`                   | lo inyecta la plataforma; no fijarlo a mano                      |
| `NODE_ENV`               | `production` — **de esto depende `secure` en las cookies**       |
| `BCRYPT_SALT_ROUNDS`     | `12`                                                             |
| `JWT_ACCESS_SECRET`      | secreto real, mínimo 32 caracteres                               |
| `JWT_REFRESH_SECRET`     | otro secreto real, distinto del anterior                         |
| `JWT_ACCESS_EXPIRES_IN`  | `15m`                                                            |
| `JWT_REFRESH_EXPIRES_IN` | `30d`                                                            |
| `CORS_ORIGIN`            | `https://taskflow.oscaresteve.dev`                               |
| `S3_ENDPOINT`            | endpoint S3 de R2 (`https://<account>.r2.cloudflarestorage.com`) |
| `S3_REGION`              | `auto`                                                           |
| `S3_ACCESS_KEY_ID`       | token de API de R2                                               |
| `S3_SECRET_ACCESS_KEY`   | token de API de R2                                               |
| `S3_BUCKET_NAME`         | nombre del bucket de R2, ver la nota                                          |
| `S3_FORCE_PATH_STYLE`    | **`false`**                                                      |
| `S3_PUBLIC_URL_BASE`     | dominio público del bucket                                       |

Tres merecen atención porque son las que se olvidan:

- **`NODE_ENV=production`.** `cookies.ts` deriva `secure` de aquí (`env.NODE_ENV !== "development"`).
  Si se queda en `development`, las cookies salen sin `Secure` sobre HTTPS.
- **`S3_FORCE_PATH_STYLE=false`.** En local va a `true` porque MinIO necesita path-style
  (`host/bucket/key`); R2 usa virtual-hosted-style. Es el valor por defecto del esquema, así que
  basta con no copiarla del `.env` local.
- **`S3_PUBLIC_URL_BASE`.** `buildPublicUrl()` en `src/shared/storage/storage.service.ts` compone
  `${S3_PUBLIC_URL_BASE}/${key}`. El endpoint S3 de R2 **no** sirve objetos públicos: hace falta
  habilitar el subdominio `r2.dev` del bucket o ponerle un dominio propio. Si se deja apuntando al
  endpoint S3, todo lo subido sale roto.

**El nombre del bucket, antes de crearlo.** En local se llama `taskflow-avatars` porque los avatares de
workspace fueron el primer caso de uso, pero el storage no se queda ahí: los adjuntos de tareas van al
mismo sitio, y es justamente la razón de haber diseñado la subida con URL prefirmada en vez de un proxy
por el backend (está en [`decisiones.md`](./decisiones.md)). Al crear el bucket de producción conviene
darle un nombre que no mienta, tipo `taskflow` o `taskflow-uploads`, porque renombrarlo más tarde
obliga a mover los objetos y a reescribir las `key` guardadas en base de datos. Los dos entornos no
tienen por qué coincidir: el nombre viaja en `S3_BUCKET_NAME` y las `key` que guarda la aplicación son
relativas al bucket.

En el frontend (Vercel) solo hay una variable: `NEXT_PUBLIC_API_URL=https://taskflow-api.oscaresteve.dev/api`.
El sufijo `/api` va incluido; `src/lib/config/env.ts` deriva de ahí el origen pelado para el socket.

## Checklist antes del primer despliegue

Ninguno de estos cinco puntos está resuelto todavía en el código. Están aquí con la solución concreta
para no tener que volver a descubrirlos.

### 1. El seed borra la base de datos sin ninguna guarda — resolver antes de sembrar producción

`main()` llama a `resetDatabase()` (`src/prisma/seed.ts`) sin comprobar nada. Un `pnpm db:seed` con
`DATABASE_URL` de Neon en el entorno borra comentarios, tareas, proyectos, workspaces y usuarios, sin
preguntar.

La guarda tiene que mirar el **host de `DATABASE_URL`**, no `NODE_ENV`: el accidente realista es
lanzar el seed desde local —donde `NODE_ENV` vale `development`— con la URL de producción delante, y
un chequeo de `NODE_ENV` no lo pararía. Dejar pasar si el host es `localhost`, `127.0.0.1` o `::1`, y
en cualquier otro caso exigir un `SEED_ALLOW_REMOTE=1` explícito, nombrando en el error el host contra
el que iba a borrar. Ese mismo flag es la vía para sembrar Neon la primera vez.

### 2. No hay forma de arrancar en producción

No existe script `build` ni `start`: el único arranque es `tsx watch src/server.ts`, que es modo
desarrollo. Y `tsconfig.json` tiene `noEmit: true`, así que `tsc` no genera JS. Dos salidas:

- **La corta:** mover `tsx` de `devDependencies` a `dependencies` y añadir
  `"start": "tsx src/server.ts"`. Funciona, a cambio de ejecutar TypeScript en caliente en producción.
- **La limpia:** un `tsconfig.build.json` con `noEmit: false` y `outDir`, y `"start": "node dist/server.js"`.
  Ojo: todos los imports relativos del proyecto llevan extensión `.ts` literal y dependen de
  `rewriteRelativeImportExtensions`, que solo reescribe `.ts` → `.js` **cuando `tsc` emite de verdad**.
  Hoy, con `noEmit: true`, ese flag no se ejecuta nunca, así que esta ruta está sin probar.

Hay que resolverlo sí o sí: sin `start`, Railway no sabe arrancar la aplicación.

### 3. No hay endpoint de health

No existe ninguna ruta de health en todo `src/` (`routes/index.ts` solo monta los módulos de dominio).
Railway, Render y Fly esperan una para decidir si un despliegue está vivo. Un `GET /api/health` que
devuelva 200 basta; si además comprueba la base de datos, un hipo de Neon tumba el despliegue, así que
mejor que no toque la base.

### 4. `CORS_ORIGIN` admite un solo origen

Es `z.string().min(1)`, sin `split`, y se usa tal cual en el `cors()` de `src/app.ts` y en el CORS del
servidor de socket.io. Consecuencia práctica: **los preview deployments de Vercel no podrán hablar con
la API**, porque cada uno tiene su propia URL. Si se quieren previews funcionales, la variable tiene que
aceptar una lista separada por comas y pasarse como array (o como función) a las dos configuraciones.

### 5. El bind del servidor es implícito

`httpServer.listen(env.PORT)` no pasa host. Funciona, porque Node hace bind a todas las interfaces por
defecto, pero es la causa número uno de "el despliegue no responde" cuando algo cambia. Dejarlo
explícito (`listen(env.PORT, "0.0.0.0")`) cuesta nada.

## Una sola instancia, sin autoescalado

El publicador de socket.io es **en proceso**: `src/socket/realtime.ts` guarda un `io` en memoria. Con
dos réplicas de Node, un cliente conectado a la instancia A no recibe los eventos que emite la B, así
que la mitad de los usuarios vería un tablero que no se actualiza. Para escalar hace falta el adaptador
de Redis.

Mientras no esté, hay que fijar el servicio a **una instancia** y desactivar el autoescalado.

Además, la ruta del socket es `/socket.io`, **fuera de `/api`**. En Railway no hay problema porque es
el mismo proceso Node sirviendo todo, pero cualquier proxy inverso que se ponga delante tiene que
enrutarla aparte, y permitir el upgrade a WebSocket.

## Sobre dormirse y los cold starts

Neon se eligió, entre otras cosas, por no tener _sleep_ ni _cold start_: el proyecto tiene que estar
siempre disponible en el portfolio. El mismo criterio aplica al backend, y es donde los free tier se
complican:

- **Render (free):** duerme a los 15 minutos de inactividad y tarda ~50 s en despertar. Un recruiter
  que abre el enlace y ve una pantalla en blanco medio minuto no vuelve. Contradice justo el motivo por
  el que se eligió Neon.
- **Railway:** ya no tiene free tier permanente, solo crédito de prueba; el plan Hobby son unos pocos
  euros al mes.
- **Fly.io, Koyeb y similares:** tienen asignaciones gratuitas pequeñas que cambian a menudo. Hay que
  mirar en el momento de desplegar si la instancia se suspende por inactividad.

Conclusión práctica: pagar unos euros al mes por un backend que no duerme vale más que un free tier que
hace esperar en la primera impresión. Si se va a un servicio que duerme, un ping periódico lo mitiga en
parte, pero no arregla el primer arranque tras un despliegue.

## Datos de la demo

El seed es el dataset de la demo, no datos de relleno: Nimbus Studio está escrito a mano para que se
lea como un proyecto real. Está descrito en el [README](../README.md) y en `src/prisma/seed.ts`.

Credenciales: `demo@taskflow.dev` / `Password123`, la misma contraseña para todos los usuarios. El
botón "Entrar como demo" de la pantalla de login entra con ellas sin teclear nada.

Dos cosas a tener en cuenta:

- **Las fechas son relativas al momento de sembrar.** Hay trabajo vencido, trabajo de esta semana y
  trabajo cerrado en los últimos 7 días, que es lo que leen las pantallas de resumen. Si la base se
  queda meses sin regenerar, esos contadores se van a cero y la demo se ve vacía.
- **Quien entra puede cambiar cosas**, porque el usuario demo es OWNER de Nimbus Studio. No hay rol de
  solo lectura en el modelo de permisos.

Las dos se resuelven con lo mismo: un **re-seed periódico** (un cron semanal, por ejemplo) que deje la
demo otra vez al día y limpia. Depende del punto 1 del checklist: hoy el seed no se puede lanzar
contra producción de forma segura.
