-- ARC-011 fase 3 (ADR-0011) -- vertical "relaciones_obra", duodecimo vertical del
-- ciclo (cuarto vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (estas cuatro tablas NO
-- existen todavia en D1, ver verificacion abajo), las tablas de documentacion y
-- relaciones de obra: correspondencia, contactos_obra, lecciones_aprendidas y
-- cierre_obra_items. Las cuatro pertenecen a las 23 tablas de ARC-011 fase 1/2 que
-- "solo existen porque el codigo las crea" (patron lazy) -- ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Fuente de cada columna (todas por CREATE TABLE, ninguna por ALTER):
--   correspondencia:      worker.js, ensureCorrespondenciaTable()  (15 columnas)
--   contactos_obra:       worker.js, ensureContactosObraTable()    (12 columnas) --
--                         unica tabla de este lote donde empresa_id y obra_id son
--                         NULLABLE (sin NOT NULL) en el codigo; se preserva tal
--                         cual, no se endurece aqui sin decision aparte
--   lecciones_aprendidas: worker.js, ensureLeccionesTable()        (17 columnas) --
--                         nombre de funcion no coincide con el de la tabla
--                         (ensureLeccionesTable -> lecciones_aprendidas), desajuste
--                         cosmetico, no de esquema
--   cierre_obra_items:    worker.js, ensureCierreObraTable()       (15 columnas) --
--                         mismo tipo de desajuste cosmetico de nombre de funcion
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name IN (...), 2026-08-03): ninguna de las cuatro tablas existe
-- todavia en produccion -- el paso 2 (aplicar) de este vertical creara las tablas
-- por primera vez, no sera un no-op sobre datos existentes.
--
-- Riesgo: bajo. Cuatro CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna fila
-- existente de ninguna tabla (ninguna de las cuatro tiene filas: no existen aun).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js, las cuatro
-- funciones ensureXxxTable() listadas arriba) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS correspondencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  numero TEXT,
  tipo TEXT DEFAULT 'saliente',
  asunto TEXT NOT NULL,
  emisor TEXT,
  receptor TEXT,
  fecha DATE NOT NULL,
  referencia TEXT,
  estado TEXT DEFAULT 'enviada',
  respuesta_requerida INTEGER DEFAULT 0,
  fecha_respuesta_limite DATE,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contactos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER,
  obra_id INTEGER,
  nombre TEXT NOT NULL,
  rol TEXT,
  empresa TEXT,
  email TEXT,
  telefono TEXT,
  movil TEXT,
  notas TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lecciones_aprendidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id    INTEGER NOT NULL,
  obra_id       INTEGER,
  numero        TEXT,
  titulo        TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT 'tecnica',
  fase          TEXT NOT NULL DEFAULT 'ejecucion',
  impacto       TEXT NOT NULL DEFAULT 'medio',
  descripcion_problema TEXT,
  causa_raiz    TEXT,
  leccion       TEXT NOT NULL,
  recomendacion TEXT,
  autor         TEXT,
  estado        TEXT NOT NULL DEFAULT 'borrador',
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cierre_obra_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id      INTEGER NOT NULL,
  obra_id         INTEGER NOT NULL,
  categoria       TEXT DEFAULT 'documentacion',
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  responsable     TEXT,
  estado          TEXT DEFAULT 'pendiente',
  fecha_limite    TEXT,
  fecha_completado TEXT,
  completado_por  TEXT,
  evidencia       TEXT,
  notas           TEXT,
  orden           INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);
