# Control de Bancales — Documento de Proyecto v1.0

> Documento de referencia para el desarrollo de la aplicación web de control de bancales logísticos entre hubs de Michelin y Continental.

---

## 1. Contexto y problema

La organización gestiona una flota de bancales (contenedores de transporte de neumáticos) que circulan entre una red de 23 plataformas (hubs) en España y Portugal, prestando servicio a dos clientes: **Michelin** y **Continental**.

Actualmente no existe una herramienta centralizada que permita:

- Saber en tiempo real cuántos bancales hay en cada plataforma.
- Detectar desviaciones entre el inventario real (conteo físico semanal) y el inventario teórico (calculado a partir de entradas y salidas registradas).
- Identificar bancales que llevan semanas sin aparecer en ninguna lectura ("bancales perdidos").

El control se realiza de forma manual, lo que hace que las desviaciones sean difíciles de detectar y aún más difíciles de localizar en el tiempo y el espacio.

---

## 2. Objetivo

Construir una aplicación web que centralice todas las lecturas de bancales, calcule automáticamente los inventarios real y teórico por plataforma y semana, y proporcione un dashboard de control que permita detectar desviaciones y bancales perdidos en menos de 5 minutos tras importar el fichero semanal.

**Éxito en 3 meses:** el dashboard reemplaza cualquier Excel manual de control de bancales, las desviaciones se detectan en menos de 5 minutos tras importar, y el número de bancales perdidos se reduce gracias a la visibilidad para actuar a tiempo.

---

## 3. Usuarios

| Rol | Descripción | v1 |
|---|---|---|
| Administrador | Acceso completo: importación, gestión, dashboard, configuración | ✅ |
| Solo visualización | Acceso de lectura al dashboard sin poder modificar datos | v2 |

En v1 existe un único usuario administrador.

---

## 4. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Hosting | Railway (frontend + backend + BD en el mismo proyecto) |
| Autenticación | JWT con sesión persistente |

---

## 5. Entidades de datos

### 5.1 Bancal

Creado automáticamente al procesar cualquier lectura (importación Excel o registro manual). No existe un catálogo previo.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria interna |
| `codigo` | STRING | Código único del bancal (ej: `CAT001022`) |
| `cliente` | ENUM | `MICHELIN` o `CONTINENTAL` |
| `plataforma_actual_id` | FK | Última plataforma conocida |
| `ultima_lectura` | TIMESTAMP | Fecha y hora de la última lectura de cualquier tipo |
| `activo` | BOOLEAN | `false` si se considera perdido según el umbral configurado |
| `created_at` | TIMESTAMP | Fecha de creación del registro |

### 5.2 Plataforma

Gestionable desde la aplicación. 23 plataformas precargadas en el despliegue inicial.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria interna |
| `codigo` | STRING | Código inmutable (ej: `ESMAD`) |
| `nombre` | STRING | Nombre descriptivo editable (ej: `Madrid`) |
| `pais` | ENUM | `ES` o `PT` |
| `activa` | BOOLEAN | Permite desactivar plataformas sin borrarlas |
| `created_at` | TIMESTAMP | Fecha de creación |

### 5.3 Evento (Lectura)

Registro central de todos los movimientos de bancales.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria interna |
| `bancal_id` | FK | Referencia al bancal |
| `plataforma_id` | FK | Referencia a la plataforma |
| `tipo` | ENUM | `CNTI` (entrada), `CNTO` (salida), `CNTS` (inventario) |
| `lectura` | TIMESTAMP | Fecha y hora exacta del evento |
| `usuario` | STRING | Nombre del operario que realizó la lectura |
| `fuente` | ENUM | `IMPORTACION` o `MANUAL` |
| `created_at` | TIMESTAMP | Fecha de inserción en la BD |

### 5.4 Parámetros de configuración

| Parámetro | Valor por defecto | Descripción |
|---|---|---|
| `umbral_bancal_perdido_semanas` | `4` | Semanas sin lectura para considerar un bancal perdido |
| `ventana_deduplicacion_minutos` | `180` | Minutos de margen para considerar dos lecturas como duplicado |

---

## 6. Reglas de negocio

### 6.1 Definición de semana

- La semana se identifica como **Wxx**, donde xx es el número ISO de la semana del **lunes** de ese período.
- El **cierre de semana es el jueves**.
- Ejemplo: una semana identificada como W03 empieza el lunes y cierra el jueves de esa semana.

### 6.2 Orden de operaciones del jueves (día de inventario)

El jueves es el día en que se realizan las lecturas de inventario (CNTS). El orden lógico de procesamiento es:

1. **CNTI del jueves** → cuentan en la **semana actual**.
2. **CNTS del jueves** → es la foto real del inventario de la **semana actual**.
3. **CNTO del jueves** → cuentan en la **semana siguiente**.

Este orden refleja la realidad física: el inventario se hace con los bancales que están presentes en ese momento, incluyendo los que acaban de entrar ese día, pero antes de que salgan.

### 6.3 Inventario teórico

```
Inventario teórico (semana N) = 
  Inventario real (semana N-1) 
  + CNTI recibidos entre viernes de W(N-1) y jueves de W(N) inclusive
  - CNTO emitidos entre viernes de W(N-1) y miércoles de W(N) inclusive
```

> Los CNTO del jueves se excluyen del cálculo de la semana actual y se suman a la siguiente.

### 6.4 Inventario real

El inventario real de una semana es el recuento de bancales únicos que tienen al menos un evento **CNTS** en el jueves de cierre de esa semana, en esa plataforma.

### 6.5 Desviación

```
Desviación = Inventario real - Inventario teórico
```

- Valor positivo → hay más bancales físicamente de los esperados.
- Valor negativo → faltan bancales respecto al teórico.

### 6.6 Bancal perdido

Un bancal se considera **en riesgo de pérdida** cuando la diferencia entre la fecha actual y su `ultima_lectura` supera el umbral configurado (por defecto 4 semanas). Cualquier tipo de lectura (CNTI, CNTO, CNTS) reinicia el contador.

### 6.7 Deduplicación de lecturas

Al importar un fichero Excel, una lectura se considera duplicada y se ignora si existe ya en la base de datos un evento con:

- Mismo `bancal`
- Mismo `tipo` de evento
- Misma `plataforma`
- `lectura` con diferencia inferior a 180 minutos (parametrizable)

Al finalizar la importación se muestra un resumen: registros importados, duplicados ignorados, errores.

---

## 7. Funcionalidades v1

### 7.1 Autenticación

- Login con usuario y contraseña.
- Sesión persistente mediante JWT.
- Un único usuario administrador (credenciales configuradas en variables de entorno en Railway).

### 7.2 Dashboard global

Pantalla principal de la aplicación.

**Cabecera:**
- Selector de semana (navegable hacia atrás y adelante). Por defecto: semana actual.
- Filtro por cliente: Todos / Michelin / Continental.

**Tarjetas resumen (KPIs globales):**
- Total bancales en circuito (con al menos una lectura en las últimas N semanas).
- Total bancales Michelin / Continental.
- Total bancales en riesgo de pérdida.
- Número de plataformas con desviación negativa esa semana.

**Tabla de plataformas:**

| Plataforma | Inv. Real | Inv. Teórico | Desviación | Bancales en riesgo |
|---|---|---|---|---|
| ESMAD | 120 | 118 | +2 | 3 |
| ESBCN | 45 | 50 | -5 | 1 |

- Clic en una fila → abre vista de detalle de esa plataforma.
- Filas con desviación negativa marcadas visualmente.

### 7.3 Vista de detalle por plataforma

- Histórico semana a semana: inventario real, teórico y desviación.
- Listado de bancales actualmente en la plataforma (según última lectura).
- Listado de bancales en riesgo de pérdida asociados a esa plataforma.
- Gráfico de evolución temporal del inventario (real vs. teórico).

### 7.4 Importación de fichero Excel

- Formulario de carga de fichero `.xlsx`.
- Validación de columnas esperadas antes de procesar.
- Procesamiento con deduplicación automática.
- Resumen final: `X registros importados / Y duplicados ignorados / Z errores`.
- Los errores se muestran en detalle (fila, motivo).

### 7.5 Registro manual de eventos

Formulario para crear un evento individual:

- Bancal (código, con autocompletado si ya existe).
- Tipo de evento: CNTI / CNTO / CNTS.
- Plataforma (desplegable).
- Fecha y hora.
- Usuario/operario.

### 7.6 Listado de bancales

Tabla con todos los bancales del sistema:

- Código, cliente, plataforma actual, última lectura, días sin lectura, estado (activo / en riesgo).
- Filtros: cliente, plataforma, estado.
- Ordenación por cualquier columna.
- Clic en bancal → historial completo de eventos de ese bancal.

### 7.7 Gestión de plataformas

- Listado de plataformas con estado (activa/inactiva).
- Alta de nueva plataforma (código + nombre + país).
- Edición de nombre.
- Activar / desactivar (no se borran plataformas con datos asociados).

### 7.8 Configuración / Parámetros

- Umbral de bancal perdido (semanas). Default: 4.
- Ventana de deduplicación (minutos). Default: 180.

---

## 8. Funcionalidades excluidas de v1

| Feature | Versión prevista |
|---|---|
| Usuarios de solo visualización | v2 |
| Justificación manual de desviaciones | v2 |
| Alertas / notificaciones automáticas (email, etc.) | v2 |
| Exportación de informes a Excel/PDF | v2 |
| API pública / webhooks | v3 |

---

## 9. Estructura de la aplicación (rutas)

```
/login                          → Autenticación
/                               → Dashboard global (semana actual)
/?semana=W03&cliente=MICHELIN   → Dashboard con filtros
/plataforma/:codigo             → Detalle de plataforma
/bancales                       → Listado de bancales
/bancales/:codigo               → Historial de un bancal
/importar                       → Importación de fichero Excel
/registro-manual                → Formulario de evento manual
/plataformas                    → Gestión de plataformas
/configuracion                  → Parámetros del sistema
```

---

## 10. Arquitectura técnica

```
┌─────────────────────────────────────────────────────┐
│                      Railway                        │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │   React App  │───▶│   Node.js / Express API  │  │
│  │   (Vite)     │    │   REST + JWT Auth         │  │
│  └──────────────┘    └────────────┬─────────────┘  │
│                                   │                 │
│                      ┌────────────▼─────────────┐  │
│                      │      PostgreSQL           │  │
│                      │      (Railway managed)    │  │
│                      └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**API endpoints principales:**

```
POST   /api/auth/login
GET    /api/dashboard?semana=W03&cliente=MICHELIN
GET    /api/plataformas
POST   /api/plataformas
PUT    /api/plataformas/:id
GET    /api/plataformas/:codigo/detalle?semana=W03
GET    /api/bancales
GET    /api/bancales/:codigo/historial
POST   /api/eventos                  → registro manual
POST   /api/importar                 → upload Excel
GET    /api/configuracion
PUT    /api/configuracion
```

---

## 11. Datos iniciales (seed)

Las 23 plataformas a precargar en el despliegue inicial:

| Código | País | Nombre sugerido |
|---|---|---|
| ESALB | ES | Albacete |
| ESALI | ES | Alicante |
| ESAST | ES | Asturias |
| ESBCN | ES | Barcelona |
| ESBIL | ES | Bilbao |
| ESCOR | ES | Córdoba |
| ESGRA | ES | Granada |
| ESJAE | ES | Jaén |
| ESLER | ES | Lérida |
| ESMAD | ES | Madrid |
| ESMAG | ES | Málaga |
| ESMER | ES | Mérida |
| ESMUR | ES | Murcia |
| ESSEV | ES | Sevilla |
| ESSGO | ES | Santiago de Compostela |
| ESTAR | ES | Tarragona |
| ESVLL | ES | Valladolid |
| ESVLN | ES | Valencia |
| ESZAR | ES | Zaragoza |
| PTALG | PT | Algarve |
| PTLIS | PT | Lisboa |
| PTPOR | PT | Porto |
| PTVIS | PT | Viseu |

---

## 12. Criterios de aceptación (v1 completa)

- [ ] Un administrador puede hacer login y mantener sesión.
- [ ] Se puede importar el fichero `LECTURAS_CONTROL_BANCALES.xlsx` sin errores, con resumen del proceso.
- [ ] La importación del mismo fichero dos veces no duplica registros.
- [ ] El dashboard muestra inventario real y teórico por plataforma para cualquier semana navegable.
- [ ] La desviación real vs. teórico es correcta para al menos 3 semanas verificadas manualmente.
- [ ] Los bancales sin lectura en más de 4 semanas aparecen en el listado de perdidos.
- [ ] Se puede registrar un evento manual y queda reflejado inmediatamente en el dashboard.
- [ ] Se puede añadir una nueva plataforma y aparece en el dashboard.
- [ ] Los parámetros de umbral y ventana de deduplicación son modificables desde la UI.

---

## 13. Decisiones pendientes de confirmar antes de desarrollar

| Decisión | Estado |
|---|---|
| Nombre definitivo de la aplicación | Pendiente |
| Credenciales iniciales del administrador | Pendiente (se configuran en Railway env vars) |
| ¿Los nombres descriptivos de plataformas del seed son correctos? | Pendiente de validación |

---

*Documento generado como base para el desarrollo. Versión 1.0 — Mayo 2026.*
