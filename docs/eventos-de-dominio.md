# TaskFlow — Eventos de dominio

Diseño de la pieza de la que salen tres features: el historial de actividad, las notificaciones con
menciones y el tiempo real por WebSocket. Las tres se apoyan en una sola tabla de eventos inmutables
con actor, acción, entidad, payload y fecha.

Las decisiones de stack que salen de aquí (tabla de eventos, socket.io) están resumidas en
`decisiones.md`; este documento es el diseño completo.

## La tesis y sus dos grietas

Si modelas cada cambio como un evento inmutable, el historial es leerlos, las notificaciones son
quedarte con los que te tocan y el tiempo real es empujarlos por un socket. El modelo de datos se
comparte de verdad, y esa es la razón de construir esto como una pieza y no como tres.

Pero hay dos cosas que no se derivan tan directamente, y que cambian el diseño:

- **Las notificaciones no se resuelven en lectura.** El contador de no leídas se consulta en cada
  carga de página; calcularlo recorriendo eventos es un escaneo. Se materializan al escribir, en su
  propia tabla.
- **El canal en vivo y el registro no son el mismo conjunto.** Reordenar una tarjeta dentro de su
  columna tiene que viajar por el socket y no debe entrar en el historial — nadie quiere leer "Ana
  movió TF-14 dos posiciones". Son dos canales con el mismo origen, no uno.

## El modelo

`ActivityEvent` guarda `workspaceId`, `projectId`, `taskId?`, `actorId`, `action`, `payload` y
`createdAt`.

`workspaceId` es una desnormalización deliberada: es derivable del proyecto, pero tenerlo evita el
join en un futuro feed de espacio y sirve de clave de sala. En v1 todo evento es de proyecto, así
que `projectId` es no nulo.

El actor va con `onDelete: Restrict`, igual que el creador de una tarea: un evento sin autor no es
un evento. Los usuarios se desactivan, no se borran.

### Granularidad: un evento por cambio, no por petición

`PATCH /tasks/:taskNumber` acepta título, descripción, estado, prioridad, fecha y asignado a la vez.
Un único `TASK_UPDATED` con un diff dentro obligaría a que tanto la frase del historial como la
regla de notificación hicieran *branching* sobre el payload. Partirlo por campo hace que cada acción
tenga una frase y un destinatario propios, que es lo que pide la convención de preferir código
explícito para conjuntos pequeños y fijos de variantes.

Consecuencias prácticas:

- Un `update` puede emitir varios eventos en la misma transacción.
- `move` emite `TASK_STATUS_CHANGED` solo si la columna cambió de verdad. Una reordenación pura no
  emite ningún evento — viaja por el socket y ya está.

### El payload

Columna `Json`, pero tipada en los bordes: un mapa de acción a forma y un esquema zod por acción que
valida al escribir y parsea al leer.

Guarda lo que la frase necesita y no es resoluble por id: `from` y `to`, el número y el título de la
tarea en ese momento, y los ids mencionados. **No** guarda el nombre del actor: ese se resuelve con
un join a `User` para que el feed muestre siempre el nombre actual.

Tampoco guarda texto ya compuesto. El evento guarda `from: "TODO"` y `to: "IN_PROGRESS"`; la frase
la compone el catálogo de mensajes del frontend. Por eso el historial sale traducido en los dos
idiomas sin tocar datos.

## Dónde se emite

En el **service**, que es la única capa que conoce la narrativa: sabe el actor, el estado anterior y
el nuevo. Ni un middleware de Prisma ni un `$extends` pueden construir eso, por mucho que automaticen
la escritura.

La pieza delicada es la atomicidad. Un evento que afirma algo que luego hizo rollback es peor que no
tener evento. Los repositorios ya abren su propia transacción por dentro, así que el service
construye los eventos y se los pasa al repositorio, que escribe mutación y eventos juntos. Cuesta un
parámetro más por función mutadora; a cambio el log no puede mentir.

La publicación (fan-out de notificaciones y emisión por socket) va **después** del commit: emitir
dentro de la transacción difunde cambios que todavía pueden revertirse.

## Notificaciones

Una fila de `Notification(userId, eventId, readAt)` por destinatario, creada en el mismo `publish`.
No duplica contenido: apunta al evento, y la frase la renderiza el mismo componente que el historial.
Por eso la campanita sale casi gratis una vez existe el feed.

| Acción | Quién recibe notificación |
| --- | --- |
| `COMMENT_CREATED` | Mencionados, asignado de la tarea y creador de la tarea |
| `TASK_ASSIGNEE_CHANGED` | El nuevo asignado |
| `TASK_STATUS_CHANGED` | Asignado y creador |
| `TASK_DUE_DATE_CHANGED` | El asignado |
| `PROJECT_MEMBER_ADDED` | El miembro añadido |
| El resto | Nadie — van al historial y al socket, no a la campanita |

El actor se descuenta siempre: nadie se notifica a sí mismo. El `@@unique([userId, eventId])`
resuelve el caso de que un comentario te mencione *y* además seas el asignado.

### Menciones

El comentario se guarda con un token estable en el texto: `@[Nombre visible](userId)`. Lleva el id
porque es lo único inmutable, y lleva el nombre para que degrade de forma legible si el usuario ya no
pertenece al proyecto; el renderizador pinta el nombre actual resolviendo el id contra los miembros y
solo cae al texto guardado cuando no lo encuentra.

El backend no se fía de lo que llegue: al crear el comentario reresuelve los ids mencionados contra
los miembros activos del proyecto y descarta los que no lo sean. No es una regla nueva ni más
estricta — es la misma pertenencia que ya exige `getTaskContext` para poder comentar.

No hace falta una tabla `CommentMention`: la única consulta que la justificaría, "comentarios que me
mencionan", ya la cubre `Notification`.

## Tiempo real

**socket.io y no `ws` a pelo.** Hacen falta salas por proyecto y reconexión con backoff, y con `ws`
las dos cosas hay que escribirlas a mano junto con los heartbeats. El interés de esta feature está en
el modelado de eventos, no en reimplementar un multiplexor.

**Autenticación:** las cookies son `httpOnly`, así que el handshake las lleva solo con
`withCredentials: true` y el `CORS_ORIGIN` que ya está configurado. Un middleware de handshake lee
`accessToken` y reusa `verifyAccessToken`. Para entrar en la sala de un proyecto se llama a
`authorizationService.getProjectContext`: mismas reglas que el HTTP, cero autorización nueva.

| Sala | Mensaje | Qué lleva |
| --- | --- | --- |
| `project:<id>` | `activity:new` | El evento ya mapeado a DTO |
| `project:<id>` | `task:reordered` | Id, columna y rank — no es evento de dominio |
| `user:<id>` | `notification:new` | La notificación y el nuevo contador |

### Aristas conocidas

- **El access token caduca y el socket vive más.** El handshake solo autentica al conectar, así que
  al caducar el servidor cierra la conexión y el cliente reconecta; si la reconexión falla con 401,
  pide un refresh y reintenta una vez — el mismo patrón que ya hace `lib/http/client.ts`.
- **El emisor es en proceso.** Con más de una instancia de Node haría falta el adaptador de Redis.
  No se construye ahora, pero queda escrito como límite conocido.
- **Los cambios propios vuelven por el socket** y pisan la actualización optimista de
  `use-move-task` y `use-update-task`. Todo mensaje lleva `actorId` y el cliente ignora los suyos.
  Es lo primero que se rompe al probar con dos pestañas.

## Qué hace el socket con la caché del frontend

Invalidar, no escribir. Las *key factories* ya están hechas para coincidencia parcial, así que un
`invalidateQueries` sobre `taskKeys.all` es correcto por construcción; meter el payload en la caché
con `setQueryData` obligaría a que el mensaje del socket fuera idéntico al DTO del endpoint. El coste
es un fetch de más, y a esta escala no se nota.

## Orden de construcción

Cada fase es entregable por sí sola.

1. **La espina y el historial.** Migración de `ActivityEvent`, catálogo de acciones, emisión desde
   los services, endpoints de lectura por proyecto y por tarea, y el feed en la UI.
2. **Notificaciones y menciones.** Tabla `Notification`, fan-out, campanita con contador y el editor
   de menciones en el cuadro de comentarios.
3. **Tiempo real.** socket.io, salas, publicación tras commit, provider e invalidaciones.

El tiempo real va el último a propósito: si en esa fase no hace falta tocar el esquema, la espina
estaba bien diseñada.

**Lo que la espina no abarata:** el autocompletado de menciones en el editor y el transporte de
sockets con su autenticación y reconexión. Ninguno de los dos se abarata por tener una tabla de
eventos, y conviene presupuestarlos aparte.

## Decisiones abiertas

- **Retención del log.** Los eventos crecen sin techo. Decidir si se purgan a los N meses evita
  rediseñar el índice después.
- **Suscriptores explícitos.** Las reglas de destinatarios son un sustituto de un modelo de
  *watchers* ("seguir esta tarea"). Es la evolución natural cuando el ruido moleste, y no rompe nada
  de lo diseñado.
- **Eventos de espacio.** En v1 `projectId` es no nulo. Para tener historial de espacio (renombrados,
  miembros del espacio) hay que hacerlo opcional: una migración pequeña, pero conviene tomarla a
  conciencia.
- **Espacios inactivos y proyectos archivados.** El backend ya devuelve 404 para todo lo que cuelga
  de un espacio inactivo; el feed y la campanita siguen esa misma regla en vez de inventarse una.
