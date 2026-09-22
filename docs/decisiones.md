# TaskFlow — Decisiones del proyecto

## Backend

### Lenguaje y framework: Node.js + TypeScript + Express 5

Quería un stack de backend consolidado, usado en empresas grandes, para que el proyecto tuviera peso real de cara a un portfolio. TypeScript no fue una opción a valorar, sino un requisito desde el principio.

**Por qué Express y no Fastify/NestJS/Hono:** es el framework más extendido y reconocible del ecosistema Node — la prioridad era consolidar un stack conocido, no explorar alternativas más nuevas u opinionadas.

### Base de datos y ORM: PostgreSQL + Prisma 7

Prisma es un ORM moderno y muy conocido en el ecosistema TypeScript. En producción la base de datos correrá en Neon (ya lo había usado antes): tiene capa gratuita, sin _sleep_ ni _cold start_, algo importante para que el proyecto esté siempre disponible en el portfolio. En local, dos contenedores Postgres separados vía Docker Compose: uno para desarrollo y otro exclusivo para tests, para no machacar los datos de desarrollo cada vez que corre la suite.

### Almacenamiento de archivos: Cloudflare R2 (prod) + MinIO (dev)

Cloudflare R2 en producción y MinIO en desarrollo, ambos compatibles con la API de S3.

**Por qué:** R2 usa la API de S3 (conocida, con capa gratuita ideal para un portfolio) y MinIO habla esa misma API, así el código de storage no cambia entre entornos y todo se puede levantar en local vía Docker.

**Subida de archivos: URL prefirmada (presigned URL), no proxy por el backend.** El backend expone un endpoint que devuelve una URL de `PutObject` firmada; el cliente sube el archivo directo al bucket (R2 o MinIO) y el backend nunca ve los bytes del archivo pasar por su memoria/ancho de banda.

**Por qué:** aunque el primer caso de uso (avatar de proyecto) es un archivo pequeño donde un proxy por el backend sería igual de simple, el sistema de storage se diseña una vez para todos los casos de uso futuros (adjuntos de tareas, que sí pueden ser archivos grandes), y ahí la URL prefirmada escala mejor. Requiere configurar CORS en el bucket y validar el archivo con condiciones en la policy de la URL firmada en vez de leerlo en el backend, pero evita que el servidor sea un cuello de botella de ancho de banda para subidas.

### Validación: Zod

Es el estándar de facto para validar datos en proyectos TypeScript, y además llevo tiempo usándolo — no hubo necesidad de evaluar alternativas como Joi o class-validator.

### Autenticación: JWT (access + refresh) con bcrypt, en cookies httpOnly

Access token de corta duración + refresh token para no forzar al usuario a reautenticarse constantemente, con bcrypt para el hash de contraseñas. Los tokens se envían en cookies httpOnly en vez de exponerlos en el cuerpo de la respuesta o esperarlos en un header `Authorization`, buscando mayor seguridad frente a robo de tokens vía XSS.

### Arquitectura en capas: routes → controller → service → repository

Vengo de trabajar con Spring Boot y esa separación de responsabilidades (capa de entrada HTTP, lógica de negocio, acceso a datos) me parece escalable y ordenada, así que trasladé el mismo patrón a Express en vez de usar una estructura más plana.

### Testing: Vitest + Supertest (tests de integración)

Ya había trabajado con esta combinación antes y es una elección conocida en el ecosistema. Los tests son de integración (contra una base de datos Postgres real en el contenedor de test) en vez de unitarios con mocks.

### Ordenación de tareas: lexorank

Para el orden de las tareas en el tablero (drag & drop) probé primero con un campo numérico de orden, pero me encontré con el límite natural de reordenaciones que tiene ese enfoque (hay que renumerar o dejar huecos, y eventualmente se agotan). Investigué y encontré que lexorank (orden por claves alfanuméricas, al estilo Jira) es la solución más profesional para este problema, así que la adopté.

### Gestor de paquetes: pnpm (obligatorio)

pnpm es seguro por defecto — sobre todo relevante después de los ataques recientes a la cadena de suministro de npm. Es el único gestor soportado en el proyecto.

---

## Frontend

### Framework: Next.js 16 (App Router) + React 19

Ya lo conocía y me ofrece ventajas de un framework consolidado frente a un SPA con Vite, incluyendo SSR.

### UI y estilos: Tailwind v4 + shadcn/ui

Tailwind es mi estándar habitual. shadcn/ui no es una librería de componentes cerrada como MUI o Chakra: los componentes se copian al proyecto y son completamente modificables y flexibles, y ya tengo experiencia con él.

### Estado de servidor: TanStack React Query

Primera vez que lo uso — para cachear las respuestas de la API y optimizar peticiones. No descarté ninguna alternativa, fue una elección directa para aprenderlo.

### Formularios: React Hook Form + Zod (resolvers)

Es lo que uso siempre en formularios con React, y se integra perfectamente tanto con Zod (mismo validador que en el backend) como con los componentes de shadcn.

### Drag & drop: @dnd-kit

Primera vez que lo uso, para el tablero tipo Kanban. Ahorra mucho trabajo frente a implementarlo a mano.

### Internacionalización: next-intl

Para soportar traducciones y centralizar los textos de la aplicación en un solo sitio, con integración directa con Next.js.

### Tema oscuro: next-themes

Se integra bien tanto con Next.js como con shadcn/ui.

### Estado en la URL: nuqs

Primera vez que lo uso, en vez de manejarlo a mano con los hooks de navegación de Next. Necesitaba que ciertos estados (filtros, paginación...) vivieran en la URL para que las páginas se puedan compartir con ese estado incluido, y nuqs ahorra bastante trabajo respecto a hacerlo manualmente.

### Gráficos: recharts

Es la librería que usa shadcn/ui para sus componentes de charts.
