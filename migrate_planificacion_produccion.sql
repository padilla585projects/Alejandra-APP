-- ARC-011 fase 3 (ADR-0011) -- vertical "planificacion_produccion", noveno vertical
-- del ciclo (primer vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (fuente autoritativa: estas
-- cinco tablas NO existen todavia en D1, ver verificacion abajo), las tablas del
-- dominio de planificacion y seguimiento de produccion de obra: fases_obra,
-- diario_obra, plan_semanal, rendimientos y field_reports. Las cinco pertenecen a
-- las 23 tablas de ARC-011 fase 1/2 que "solo existen porque el codigo las crea"
-- (patron lazy, nunca invocadas todavia en produccion) -- ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Fuente de cada columna (todas por CREATE TABLE, ninguna por ALTER -- ninguna de
-- las cinco tiene ALTER TABLE en ningun otro punto de worker.js):
--   fases_obra:      worker.js, ensureFasesObraTable()    (14 columnas)
--   diario_obra:     worker.js, ensureDiarioObraTable()   (14 columnas)
--   plan_semanal:    worker.js, ensurePlanSemanalTable()  (14 columnas)
--   rendimientos:    worker.js, ensureRendimientosTable() (17 columnas)
--   field_reports:   worker.js, ensureFieldReportTable()  (19 columnas)
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name IN (...), 2026-08-03): ninguna de las cinco tablas existe
-- todavia en produccion. A diferencia de los verticales anteriores (checklists,
-- rfis, calidad, tareas_obra, actas_reunion, ordenes_*), el paso 2 (aplicar) de
-- este vertical no sera un no-op sobre filas existentes -- sera la primera vez que
-- estas tablas se crean. El riesgo sigue siendo bajo (CREATE TABLE IF NOT EXISTS
-- aditivo, ninguna tabla con datos), pero conviene registrarlo explicitamente: aqui
-- no hay "esquema de produccion" que contrastar, solo el esquema que el codigo
-- crearia la primera vez que se invoque cada endpoint.
--
-- Riesgo: bajo. Cinco CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna fila
-- existente de ninguna tabla (ninguna de las cinco tiene filas: no existen aun).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js, las cinco
-- funciones ensureXxxTable() listadas arriba) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS fases_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio_plan TEXT,
  fecha_fin_plan TEXT,
  fecha_inicio_real TEXT,
  fecha_fin_real TEXT,
  porcentaje INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  responsable TEXT,
  orden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diario_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  clima TEXT,
  temperatura TEXT,
  trabajos TEXT NOT NULL,
  personal_presente INTEGER DEFAULT 0,
  equipos_activos TEXT,
  incidencias_dia TEXT,
  visitantes TEXT,
  observaciones TEXT,
  creado_por TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plan_semanal (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id          INTEGER NOT NULL,
  obra_id             INTEGER NOT NULL,
  semana_inicio       TEXT NOT NULL,
  gremio              TEXT NOT NULL,
  responsable         TEXT,
  descripcion         TEXT,
  actividades         TEXT DEFAULT '[]',
  workers_num         INTEGER DEFAULT 1,
  horas_planificadas  REAL DEFAULT 0,
  estado              TEXT DEFAULT 'planificado',
  ppc                 INTEGER DEFAULT 0,
  notas               TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rendimientos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  obra_id        INTEGER,
  fase_id        INTEGER,
  fecha          TEXT NOT NULL,
  actividad      TEXT NOT NULL,
  unidad         TEXT NOT NULL DEFAULT 'ud',
  cantidad_plan  REAL,
  cantidad_real  REAL NOT NULL,
  trabajadores   INTEGER DEFAULT 1,
  horas_hombre   REAL,
  rendimiento    REAL,
  turno          TEXT DEFAULT 'manana',
  responsable    TEXT,
  observaciones  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_reports (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id             INTEGER NOT NULL,
  obra_id                INTEGER,
  numero                 TEXT,
  fecha                  TEXT NOT NULL,
  preparado_por          TEXT,
  estado                 TEXT NOT NULL DEFAULT 'borrador',
  clima_manana           TEXT,
  clima_tarde            TEXT,
  temperatura            REAL,
  trabajadores_presentes INTEGER DEFAULT 0,
  equipos_presentes      TEXT,
  trabajo_realizado      TEXT,
  materiales_recibidos   TEXT,
  issues                 TEXT,
  visitas                TEXT,
  observaciones          TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
