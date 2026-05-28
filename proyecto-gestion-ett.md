# Proyecto: Gestión de Solicitudes de Trabajadores Temporales

## Índice
1. [Visión general](#visión-general)
2. [Roles y permisos](#roles-y-permisos)
3. [Modelo de datos](#modelo-de-datos)
4. [Flujo de validación](#flujo-de-validación)
5. [Módulo de ETTs](#módulo-de-etts)
6. [Notificaciones](#notificaciones)
7. [Renovaciones](#renovaciones)
8. [Trazabilidad y estadísticas](#trazabilidad-y-estadísticas)
9. [Panel de administración](#panel-de-administración)
10. [Arquitectura técnica](#arquitectura-técnica)
11. [Modelo de base de datos](#modelo-de-base-de-datos)
12. [API REST](#api-rest)
13. [Plan de desarrollo por sprints](#plan-de-desarrollo-por-sprints)
14. [Criterios de éxito V1](#criterios-de-éxito-v1)
15. [Roadmap V2](#roadmap-v2)

---

## Visión general

### Problema que resuelve
Eliminar el caos de solicitudes de contratación temporal por email o papel. Centralizar el proceso, garantizar trazabilidad completa y reducir errores en los pedidos enviados a las ETTs.

### Descripción del sistema
Aplicación web interna para una empresa con múltiples managers que solicitan trabajadores temporales a un catálogo de ETTs. Los pedidos pasan por un circuito de validación configurable antes de ser enviados automáticamente a la ETT correspondiente.

### Usuarios objetivo
Managers y responsables internos que gestionan contrataciones temporales, junto con sus aprobadores y el equipo de RRHH.

---

## Roles y permisos

| Rol | Descripción | Capacidades |
|---|---|---|
| `SOLICITANTE` | Crea y gestiona sus pedidos | Crear, editar borradores, ver estado de sus pedidos, renovar contratos aprobados |
| `APROBADOR` | Valida pedidos asignados | Aprobar, rechazar, devolver para ampliar información. Actúa en su posición de la cadena |
| `APROBADOR_BACKUP` | Suplente de un aprobador principal | Mismas capacidades que APROBADOR, activa cuando el principal supera el timeout |
| `SUPERVALIDADOR` | Autoridad máxima | Puede aprobar o rechazar cualquier pedido en cualquier estado, en cualquier momento |
| `ADMIN` | Administrador del sistema | Gestión completa de usuarios, circuitos, catálogos, ETTs y parámetros globales |
| `USUARIO_ETT` | Usuario externo de una ETT | Ver sus pedidos asignados e histórico propio. Registrar y modificar el trabajador asignado |

> Cada usuario interno tiene exactamente un rol. Los roles son exclusivos y no se combinan.
> Los usuarios con rol `USUARIO_ETT` son externos y solo tienen acceso a su portal restringido.

---

## Modelo de datos

### Entidad: Pedido (`requests`)

#### Datos básicos (obligatorios)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador interno |
| `code` | VARCHAR(6) | Código alfanumérico único irrepetible (ej. `X4K9QR`). Se genera al aprobar el pedido |
| `status` | ENUM | Estado actual del pedido |
| `requester_id` | FK → users | Solicitante |
| `ett_id` | FK → etts | ETT seleccionada |
| `workplace_id` | FK → workplaces | Centro de trabajo |
| `start_date` | DATE | Fecha de inicio del contrato |
| `end_date` | DATE | Fecha de fin del contrato |
| `contract_type_id` | FK → contract_types | Tipo de contrato |
| `job_category_id` | FK → job_categories | Categoría profesional / puesto |
| `headcount` | INTEGER | Número de personas solicitadas |

#### Datos operativos (opcionales salvo indicado)
| Campo | Tipo | Descripción |
|---|---|---|
| `shift_id` | FK → shifts | Turno / horario |
| `reason_id` | FK → request_reasons | Motivo de la contratación **(obligatorio)** |
| `substituted_person` | VARCHAR | Nombre de la persona sustituida (si aplica) |
| `assigned_worker_name` | VARCHAR | Nombre del trabajador asignado por la ETT |
| `assigned_worker_id_number` | VARCHAR | DNI/NIE del trabajador asignado |
| `candidate_requirements` | TEXT | Requisitos del candidato (formación, experiencia, idiomas…) |
| `notes` | TEXT | Observaciones libres |

#### Metadatos
| Campo | Tipo | Descripción |
|---|---|---|
| `parent_request_id` | FK → requests | Si es renovación, referencia al pedido original |
| `is_renewal` | BOOLEAN | Indica si es una renovación |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `approved_at` | TIMESTAMP | Momento de aprobación final |
| `sent_to_ett_at` | TIMESTAMP | Momento de envío del email a la ETT |
| `worker_registered_at` | TIMESTAMP | Momento en que la ETT registró el trabajador asignado |
| `worker_registered_by` | FK → ett_users | Usuario de ETT que registró al trabajador |

### Estados del pedido (`status`)

```
DRAFT → PENDING_VALIDATION → APPROVED
                           → REJECTED
                           → RETURNED_FOR_INFO → PENDING_VALIDATION (reinicia desde el principio)
```

| Estado | Descripción |
|---|---|
| `DRAFT` | Borrador, no enviado al circuito aún |
| `PENDING_VALIDATION` | En circuito de validación, esperando aprobador actual |
| `APPROVED` | Aprobado por toda la cadena, email enviado a ETT |
| `REJECTED` | Rechazado por algún aprobador. Incluye motivo |
| `RETURNED_FOR_INFO` | Devuelto al solicitante para ampliar información |

---

## Flujo de validación

### Configuración del circuito
Cada solicitante tiene una cadena de validación propia, configurable por el admin:

```
Solicitante → Aprobador 1 (+ Backup 1) → Aprobador 2 (+ Backup 2) → ... → APROBADO
```

- Cada eslabón de la cadena tiene un aprobador principal y un backup opcional.
- El orden de los aprobadores es secuencial: el siguiente no recibe el pedido hasta que el anterior actúa.
- El SUPERVALIDADOR puede intervenir en cualquier momento, en cualquier eslabón.

### Lógica de timeout y escalado al backup
1. El pedido llega al aprobador principal → se envía notificación por email.
2. Si transcurre el **timeout global** (configurable por admin, ej. 48h) sin respuesta:
   - Se notifica al **aprobador backup**.
   - El backup tiene las mismas capacidades que el principal.
   - El principal también puede seguir actuando mientras el backup no haya respondido.
3. El timeout se reinicia en cada eslabón de la cadena.

### Concurrencia entre principal y backup
Cuando ambos pueden actuar simultáneamente, **gana el primero que actúe**. El sistema procesa la acción con un `SELECT FOR UPDATE` sobre `request_validation_state` para garantizar atomicidad. Si el segundo actor intenta actuar sobre un eslabón ya procesado, recibe el mensaje: *"Este pedido ya fue tramitado por [nombre]."*

### Acciones del aprobador
| Acción | Resultado |
|---|---|
| **Aprobar** | El pedido avanza al siguiente eslabón. Si es el último, pasa a `APPROVED` y se envía email a ETT |
| **Rechazar** | El pedido pasa a `REJECTED`. Se notifica al solicitante con el motivo obligatorio |
| **Devolver para ampliar info** | El pedido pasa a `RETURNED_FOR_INFO`. Se notifica al solicitante con comentario. El solicitante corrige y el circuito reinicia desde el principio (Aprobador 1) |

### Intervención del SUPERVALIDADOR
- Puede aprobar o rechazar cualquier pedido en estado `PENDING_VALIDATION` o `RETURNED_FOR_INFO`.
- Su acción queda registrada en el log de auditoría con su identidad.
- Al aprobar, se salta los eslabones restantes y el pedido pasa directamente a `APPROVED`.

---

## Módulo de ETTs

### Catálogo de ETTs
Gestionado por el admin. Cada ETT tiene:
- Nombre
- CIF / datos fiscales (opcional)
- Activa / inactiva

### Usuarios de ETT
- Cada ETT puede tener uno o más usuarios con rol `USUARIO_ETT`.
- Los usuarios son creados y gestionados exclusivamente por el **admin de la empresa**, no por la ETT.
- Cada usuario de ETT pertenece a una sola ETT.
- El aislamiento es total: un usuario de ETT A no puede ver ningún pedido de ETT B, ni siquiera sabe que existe.
- Dentro de la misma ETT, cada usuario ve **únicamente sus pedidos asignados**. El Usuario 1 de ETT A no ve los pedidos del Usuario 2 de ETT A.

#### Modelo de aislamiento
```
ETT A
  ├── Usuario 1 → ve solo pedidos asignados a Usuario 1
  └── Usuario 2 → ve solo pedidos asignados a Usuario 2

ETT B
  ├── Usuario 3 → ve solo pedidos asignados a Usuario 3
  └── Usuario 4 → ve solo pedidos asignados a Usuario 4
```

### Configuración de destinatarios y routing
El routing determina simultáneamente **a qué email se envía el pedido** y **qué usuario de ETT lo gestiona en la app**:

```
ETT + Centro de trabajo + (opcionalmente) Solicitante → Email destino + Usuario ETT asignado
```

El admin configura una tabla de routing:

| ETT | Centro de trabajo | Solicitante (opcional) | Email destino | Usuario ETT |
|---|---|---|---|---|
| ETT Alpha | Madrid | (cualquiera) | madrid@ettAlpha.com | Usuario 1 |
| ETT Alpha | Barcelona | Usuario X | bcn-vip@ettAlpha.com | Usuario 2 |
| ETT Beta | Madrid | (cualquiera) | madrid@ettBeta.com | Usuario 3 |

Si no hay match específico con el solicitante, se usa el match por ETT + centro de trabajo. Si no existe ninguna regla de routing para la combinación ETT + centro de trabajo seleccionada, el pedido no puede crearse con esa combinación — se muestra un error de validación al solicitante en el momento de seleccionar ETT y centro de trabajo.

### Portal de la ETT
El usuario de ETT accede a la misma app con el mismo diseño, pero con acceso estrictamente restringido a sus pedidos.

#### Vistas disponibles para USUARIO_ETT
- **Mis pedidos:** listado de pedidos asignados, filtrables por estado, fecha, categoría
- **Detalle de pedido:** todos los datos del pedido, histórico de cambios del trabajador asignado
- **Histórico:** pedidos anteriores ya cerrados o con contratos vencidos

#### Acción disponible: Registrar trabajador asignado
Desde el detalle de un pedido aprobado, el usuario de ETT puede:
- Registrar el nombre y DNI/NIE del trabajador que va a enviar
- Modificar el trabajador asignado si hay un cambio posterior
- Cada modificación queda registrada en el log de auditoría

#### Timeout de registro del trabajador
- Plazo configurable por el admin (en horas) para que la ETT registre al trabajador.
- Si se supera el plazo sin registro: notificación por email a la ETT y al solicitante.
- Los recordatorios se repiten según configuración hasta que se registre el trabajador.

### Email enviado a la ETT
Al aprobar el pedido:
1. Se genera el **código alfanumérico único de 6 caracteres** (ej. `X4K9QR`).
2. Se genera un **PDF** con todos los datos del pedido.
3. Se envía un email al destinatario configurado con:
   - **Asunto:** `[CÓDIGO] Solicitud de trabajador temporal - [Categoría] - [Centro de trabajo]`
   - **Cuerpo:** Todos los datos del pedido formateados en texto legible
   - **Adjunto:** PDF del pedido
4. El pedido queda visible simultáneamente en el portal del usuario de ETT asignado.

#### Generación y descarga del PDF
El PDF **no se almacena**. Se genera en el momento de la aprobación para adjuntarlo al email, y se regenera bajo demanda cada vez que alguien lo descarga desde el detalle del pedido. El motor de generación debe ser determinista: mismo pedido → mismo PDF en cualquier momento.

#### Generación del código alfanumérico
- 6 caracteres: letras mayúsculas (A-Z) + números (0-9). Excluir caracteres ambiguos: `0`, `O`, `I`, `1`.
- Verificación de unicidad contra la base de datos antes de persistir. Hasta 5 reintentos; si se agota, alerta al sistema.
- Se genera en el momento de la aprobación final, no antes.

---

## Notificaciones

Todas las notificaciones son por **email**. Todos los emails identifican el pedido por su **código alfanumérico** como referencia. No hay push ni SMS en V1.

### Notificaciones del circuito de validación interno

| Evento | Destinatario | Contenido |
|---|---|---|
| Pedido enviado a validación | Aprobador del eslabón actual | Datos resumen del pedido + link para actuar |
| Timeout superado sin respuesta | Aprobador backup | Datos resumen + aviso de escalado + link para actuar |
| Pedido aprobado | Solicitante | Confirmación + código alfanumérico + datos del pedido |
| Pedido rechazado | Solicitante | Motivo del rechazo + datos del pedido |
| Pedido devuelto para ampliar info | Solicitante | Comentario del aprobador + link para editar el pedido |

### Notificaciones del ciclo post-aprobación (ETT)

| Evento | Destinatario | Contenido |
|---|---|---|
| Pedido aprobado y enviado | ETT (email de routing) | Datos completos del pedido + PDF adjunto + código de referencia |
| Pedido aprobado y enviado | Solicitante | Confirmación de envío a ETT + código de referencia |
| Timeout de registro superado | ETT + Solicitante | Aviso de que el trabajador aún no ha sido registrado + código de referencia |
| Recordatorio periódico (si sigue sin registrarse) | ETT + Solicitante | Recordatorio con código de referencia |
| Trabajador registrado por ETT | Solicitante | Nombre + DNI del trabajador asignado + código de referencia |
| Confirmación de registro | ETT | Acuse de que el registro quedó guardado correctamente |
| Trabajador modificado por ETT | Solicitante | Nuevo nombre + DNI del trabajador + código de referencia |
| Confirmación de modificación | ETT | Acuse de que el cambio quedó guardado correctamente |

> Todas las notificaciones incluyen un link directo al pedido en la aplicación.

---

## Renovaciones

### Flujo de renovación
1. Desde un pedido en estado `APPROVED`, el solicitante pulsa **"Renovar contrato"**.
2. Se crea un nuevo pedido pre-rellenado con todos los datos del original.
3. El campo **"Trabajador asignado"** es editable para cubrir cambios de persona.
4. Las fechas de inicio y fin deben ser actualizadas obligatoriamente.
5. El nuevo pedido referencia al original mediante `parent_request_id`.
6. El pedido de renovación pasa por el **mismo circuito de validación** que un pedido nuevo.
7. Al aprobarse, genera su propio código alfanumérico único.

### Vinculación para estadísticas
- Las renovaciones se identifican mediante `is_renewal = true` y `parent_request_id`.
- Las estadísticas pueden mostrar cadenas de renovación: pedido original → renovación 1 → renovación 2…

---

## Trazabilidad y estadísticas

### Log de auditoría (`audit_log`)
Cada acción relevante genera una entrada inmutable:

| Campo | Descripción |
|---|---|
| `id` | UUID |
| `request_id` | Pedido afectado |
| `user_id` | Usuario que realizó la acción |
| `action` | Tipo de acción (ver tabla abajo) |
| `details` | JSON con datos adicionales (motivo de rechazo, comentario, etc.) |
| `created_at` | Timestamp de la acción |

#### Tipos de acción registradas
- `REQUEST_CREATED` — Pedido creado
- `REQUEST_SUBMITTED` — Enviado al circuito
- `REQUEST_APPROVED_STEP` — Aprobado en un eslabón intermedio
- `REQUEST_APPROVED_FINAL` — Aprobación final, email enviado
- `REQUEST_REJECTED` — Rechazado
- `REQUEST_RETURNED` — Devuelto para ampliar info
- `REQUEST_RESUBMITTED` — Reenviado tras corrección (reinicia desde Aprobador 1)
- `REQUEST_ESCALATED` — Escalado al backup por timeout
- `SUPERVALIDATOR_APPROVED` — Aprobado por supervalidador
- `SUPERVALIDATOR_REJECTED` — Rechazado por supervalidador
- `EMAIL_SENT` — Email enviado a ETT con confirmación
- `RENEWAL_CREATED` — Renovación creada desde este pedido
- `WORKER_REGISTERED` — Trabajador asignado registrado por usuario de ETT
- `WORKER_MODIFIED` — Trabajador asignado modificado por usuario de ETT
- `ETT_REMINDER_SENT` — Recordatorio enviado a ETT por timeout de registro

### Dashboard de estadísticas
Métricas disponibles, filtrables por rango de fechas:

#### Por solicitante
- Total de solicitudes creadas
- Solicitudes aprobadas / rechazadas / devueltas para info
- Tasa de aprobación
- Tiempo medio desde creación hasta aprobación final
- Número de renovaciones generadas

#### Por tipo de contrato y categoría
- Distribución de solicitudes por tipo de contrato
- Distribución por categoría profesional
- Distribución por ETT

#### Por circuito de validación
- Tiempo medio por eslabón de validación
- Número de escalados al backup
- Aprobadores con mayor tiempo de respuesta

#### Por estado global
- **Pedidos activos:** pedidos con `status IN (PENDING_VALIDATION, RETURNED_FOR_INFO)`, con tiempo acumulado en estado actual
- **Pedidos bloqueados:** activos que han superado el timeout sin respuesta del backup

---

## Panel de administración

Accesible solo para usuarios con rol `ADMIN`. UX cuidada para usuario de negocio.

### Secciones del panel

#### 1. Usuarios
- Listado de usuarios con rol, estado (activo/inactivo) y fecha de alta
- Crear / editar / desactivar usuarios internos
- Asignar rol (selector único — cada usuario tiene exactamente un rol)
- Restablecer contraseña

#### 1b. Usuarios de ETT
- Listado de usuarios de ETT con su ETT asociada y estado
- Crear / editar / desactivar usuarios de ETT
- Cada usuario de ETT debe estar vinculado a una ETT del catálogo
- Restablecer contraseña de usuario ETT

#### 2. Circuitos de validación
- Para cada solicitante, definir su cadena ordenada de aprobadores
- Para cada eslabón: aprobador principal + aprobador backup (opcional)
- Vista clara de la cadena completa por solicitante

#### 3. ETTs y configuración de emails
- Gestión del catálogo de ETTs (nombre, CIF, estado activo/inactivo)
- Tabla de routing de emails: ETT + centro de trabajo + solicitante opcional → email destino + usuario ETT asignado
- Test de envío de email de prueba
- Timeout de registro de trabajador por ETT (en horas, heredado del global si no se especifica)

#### 4. Catálogos
Tablas de referencia editables:
- Tipos de contrato
- Categorías profesionales
- Centros de trabajo
- Motivos de contratación
- Turnos / horarios

#### 5. Parámetros globales
- Timeout global para escalado al backup de aprobadores (en horas)
- Timeout global para registro de trabajador por ETT (en horas)
- Frecuencia de recordatorios a ETT por trabajador no registrado (en horas)
- Logo corporativo (upload)
- Nombre de la empresa (aparece en emails y PDF)
- Email remitente del sistema (from address)

---

## Arquitectura técnica

### Stack recomendado

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + TypeScript | Ecosistema maduro, componentes reutilizables, tipado fuerte |
| Estilos | Tailwind CSS | Desarrollo rápido, consistencia visual |
| Backend | Node.js + Express (TypeScript) | Mismo lenguaje full-stack, ecosistema amplio |
| Base de datos | PostgreSQL | Relacional, robusto, soporte nativo de UUID y JSONB para audit log |
| ORM | Prisma | Type-safe, migraciones automáticas, excelente DX |
| Autenticación | JWT + bcrypt | Simple, sin dependencias externas, stateless |
| Email | Resend o SendGrid | APIs modernas, fiables, buen soporte de plantillas |
| PDF | Puppeteer o PDFKit | Generación server-side de PDFs |
| Jobs / colas | pg-boss | Cola de jobs sobre PostgreSQL. Sin servicios extra: usa la misma BD del proyecto. |
| Hosting | Railway | Soporte nativo de Node.js y PostgreSQL. Deploy automático desde GitHub. Todo en un mismo proyecto. |

### Diagrama de componentes

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React)                  │
│  Dashboard · Pedidos · Admin Panel · Estadísticas    │
└─────────────────────┬───────────────────────────────┘
                      │ REST API (JSON)
┌─────────────────────┼───────────────────────────────┐
│                  BACKEND (Node.js)                   │
│                                                      │
│  Auth    Requests   Validation   Notifications       │
│  Module  Module     Engine       Service             │
│                         │              │             │
│                    ┌────┴─────┐  ┌─────┴────────┐   │
│                    │ pg-boss  │  │  Email       │   │
│                    │  Queue   │  │  Service     │   │
│                    └────┬─────┘  └──────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
      ┌─────────┴──────┐     (PDF generado
      │   PostgreSQL   │      bajo demanda)
      │  (datos +      │
      │  audit log +   │
      │  jobs queue)   │
      └────────────────┘
```

---

## Modelo de base de datos

### Tablas principales

```sql
-- Usuarios internos (un rol por usuario)
users (id, name, email, password_hash, role, is_active, created_at)
-- role: SOLICITANTE | APROBADOR | APROBADOR_BACKUP | SUPERVALIDADOR | ADMIN

-- Usuarios de ETT (tabla separada por aislamiento)
ett_users (id, name, email, password_hash, ett_id, is_active, created_at)

-- Catálogos
workplaces (id, name, is_active)
contract_types (id, name, is_active)
job_categories (id, name, is_active)
request_reasons (id, name, is_active)
shifts (id, name, description, is_active)

-- ETTs
etts (id, name, cif, is_active)

-- Routing: determina email destino Y usuario ETT asignado por pedido
ett_email_routing (id, ett_id, workplace_id, requester_id[nullable],
                   email, ett_user_id)

-- Circuitos de validación
validation_circuits (id, requester_id)
validation_steps (id, circuit_id, step_order, approver_id, backup_approver_id[nullable])

-- Pedidos
requests (id, code[nullable until approved], status, requester_id, ett_id,
          ett_user_id[nullable], -- usuario ETT asignado al aprobarse
          workplace_id, start_date, end_date, contract_type_id, job_category_id, headcount,
          shift_id, reason_id, substituted_person,
          assigned_worker_name, assigned_worker_id_number,
          candidate_requirements, notes,
          parent_request_id[nullable], is_renewal,
          created_at, updated_at, approved_at, sent_to_ett_at,
          worker_registered_at, worker_registered_by[FK → ett_users])

-- Estado de validación del pedido en curso
request_validation_state (id, request_id, current_step_order,
                           current_approver_id, current_backup_id,
                           step_started_at, escalated_to_backup_at[nullable])

-- Log de auditoría (unificado para usuarios internos y de ETT)
-- Exactamente uno de internal_user_id o ett_user_id debe estar set (CHECK constraint)
audit_log (id, request_id,
           internal_user_id[nullable FK → users],
           ett_user_id[nullable FK → ett_users],
           action, details[JSONB], created_at,
           CONSTRAINT chk_audit_user CHECK (
             (internal_user_id IS NOT NULL AND ett_user_id IS NULL) OR
             (internal_user_id IS NULL AND ett_user_id IS NOT NULL)
           ))

-- Parámetros globales
system_config (key, value, updated_at, updated_by)
```

---

## API REST

### Autenticación
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/change-password
```

### Pedidos
```
GET    /api/requests              -- Lista pedidos del usuario actual (con filtros)
POST   /api/requests              -- Crear nuevo pedido (status: DRAFT)
GET    /api/requests/:id          -- Detalle de un pedido
GET    /api/requests/:id/audit    -- Log de auditoría de un pedido
GET    /api/requests/:id/pdf      -- Descargar PDF del pedido (generado bajo demanda, solo APPROVED)
PUT    /api/requests/:id          -- Editar pedido en DRAFT o RETURNED_FOR_INFO
POST   /api/requests/:id/submit   -- Enviar al circuito de validación
POST   /api/requests/:id/renew    -- Crear renovación desde pedido APPROVED
DELETE /api/requests/:id          -- Eliminar borrador
```

### Validación
```
GET    /api/validation/pending         -- Pedidos pendientes de mi validación
POST   /api/validation/:id/approve    -- Aprobar pedido
POST   /api/validation/:id/reject     -- Rechazar pedido (motivo obligatorio)
POST   /api/validation/:id/return     -- Devolver para ampliar info (comentario obligatorio)
```

### Supervalidador
```
GET    /api/supervalidator/requests          -- Todos los pedidos en validación
POST   /api/supervalidator/:id/approve      -- Aprobar cualquier pedido
POST   /api/supervalidator/:id/reject       -- Rechazar cualquier pedido
```

### Estadísticas
```
GET    /api/stats/overview         -- Métricas globales
GET    /api/stats/by-user          -- Métricas por solicitante
GET    /api/stats/by-contract-type -- Distribución por tipo de contrato
GET    /api/stats/validation-times -- Tiempos de validación
```

### Portal ETT
```
-- Autenticación ETT (endpoint separado, devuelve token con scope ETT)
POST   /api/ett/auth/login
POST   /api/ett/auth/logout
POST   /api/ett/auth/change-password

-- Pedidos (solo los asignados al usuario ETT autenticado)
GET    /api/ett/requests              -- Lista pedidos asignados (activos + histórico)
GET    /api/ett/requests/:id          -- Detalle de un pedido
GET    /api/ett/requests/:id/pdf      -- Descargar PDF del pedido (generado bajo demanda)

-- Trabajador asignado
PUT    /api/ett/requests/:id/worker   -- Registrar o modificar trabajador asignado
                                      -- body: { name, id_number }
```

### Administración
```
-- Usuarios internos
GET/POST        /api/admin/users
GET/PUT/DELETE  /api/admin/users/:id
POST            /api/admin/users/:id/reset-password

-- Usuarios de ETT
GET/POST        /api/admin/ett-users
GET/PUT/DELETE  /api/admin/ett-users/:id
POST            /api/admin/ett-users/:id/reset-password

-- Circuitos
GET/POST        /api/admin/circuits
GET/PUT/DELETE  /api/admin/circuits/:id

-- ETTs
GET/POST        /api/admin/etts
GET/PUT/DELETE  /api/admin/etts/:id
GET/POST        /api/admin/etts/:id/routing        -- incluye ett_user_id en el routing
DELETE          /api/admin/etts/:id/routing/:routingId

-- Catálogos (mismo patrón para cada uno)
GET/POST        /api/admin/workplaces
GET/POST        /api/admin/contract-types
GET/POST        /api/admin/job-categories
GET/POST        /api/admin/request-reasons
GET/POST        /api/admin/shifts

-- Configuración global
GET/PUT         /api/admin/config
POST            /api/admin/config/test-email
```

---

## Plan de desarrollo por sprints

> Sprints de 2 semanas. Equipo mínimo: 1 full-stack developer.

### Sprint 0 — Setup (1 semana)
- Repositorio, estructura de proyecto, CI/CD básico
- Base de datos: esquema inicial + migraciones con Prisma
- Autenticación JWT funcional
- Deploy inicial en Railway (entorno de staging): servicios Node.js + PostgreSQL

### Sprint 1 — Core de pedidos
- CRUD de pedidos (crear, editar, borrador)
- Catálogos básicos (tipos de contrato, categorías, centros de trabajo)
- UI: formulario de creación de pedido
- UI: listado de mis pedidos con estados

### Sprint 2 — Circuito de validación
- Motor de validación (cadena de aprobadores, avance por eslabones)
- Acciones de aprobador: aprobar, rechazar, devolver para info
- Supervalidador: vista global + acciones
- UI: bandeja de pedidos pendientes de validación

### Sprint 3 — Notificaciones y timeouts
- Integración con servicio de email (Resend/SendGrid)
- Plantillas de email para cada tipo de notificación (circuito interno + ciclo ETT)
- pg-boss: job de timeout de aprobadores → escalado al backup
- pg-boss: job de timeout de registro de trabajador → recordatorio a ETT y solicitante

### Sprint 4 — ETTs, envío final y portal ETT
- Catálogo de ETTs + tabla de routing (email + usuario ETT asignado)
- Generación de código alfanumérico único
- Generación de PDF del pedido
- Envío de email a ETT (cuerpo + PDF adjunto)
- Activación simultánea del pedido en portal ETT al aprobarse
- Portal ETT: autenticación separada con scope restringido
- Portal ETT: listado de pedidos asignados e histórico
- Portal ETT: registro y modificación de trabajador asignado
- Log de auditoría completo (acciones internas + acciones de ETT)

### Sprint 5 — Panel de administración
- Gestión de usuarios internos y roles (selector único por usuario)
- Gestión de usuarios de ETT (vinculados a su ETT)
- Configuración de circuitos de validación
- Gestión de ETTs y routing de emails (con usuario ETT asignado)
- Gestión de catálogos
- Parámetros globales (timeouts de aprobadores y de registro ETT, logo, nombre empresa)

### Sprint 6 — Renovaciones y estadísticas
- Flujo de renovación (botón "Renovar", pre-relleno, campo trabajador editable)
- Dashboard de estadísticas (métricas por usuario, tipo contrato, tiempos)
- Log de auditoría visible en detalle de pedido

### Sprint 7 — Pulido y QA
- Revisión completa de UX y diseño
- Integración del logo corporativo
- Tests de integración de flujos críticos
- Corrección de bugs
- Documentación de usuario final
- Deploy a producción

---

## Criterios de éxito V1

| Indicador | Métrica objetivo | Cómo se mide |
|---|---|---|
| **Adopción** | 100% de solicitudes de contratación temporal gestionadas por la app | Cero emails directos a ETTs fuera del sistema |
| **Trazabilidad** | Cualquier pedido localizable en < 30 segundos | Log de auditoría completo por pedido |
| **Errores** | Cero pedidos enviados a ETTs con datos incorrectos o incompletos | Validación de campos obligatorios en formulario + revisión mensual |

---

## Roadmap V2

| Feature | Descripción |
|---|---|
| Aviso automático de vencimiento | X días antes de que venza un contrato, notificación al solicitante para renovar |
| Exportación de reportes | Estadísticas exportables a Excel/PDF |
| Reglas automáticas de asignación ETT | Según categoría o centro, el sistema propone ETT automáticamente |
| Admin ETT delegado | Cada ETT puede gestionar sus propios usuarios sin pasar por el admin de la empresa |
| Integración SSO corporativo | Azure AD / Google Workspace |
| App móvil (PWA) | Versión móvil para aprobar pedidos desde cualquier lugar |

---

*Documento generado como briefing de proyecto para desarrollo con Claude Code.*
*Versión: 1.5 — Mayo 2026 (cola de jobs: pg-boss sobre PostgreSQL, Redis eliminado del stack)*
