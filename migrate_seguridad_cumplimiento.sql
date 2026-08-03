-- ARC-011 fase 3 (ADR-0011) -- vertical "seguridad_cumplimiento", undecimo vertical
-- del ciclo (tercer vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (estas seis tablas NO
-- existen todavia en D1, ver verificacion abajo), las tablas del dominio de
-- seguridad laboral y cumplimiento normativo: registro_ambiental, seguros_obra,
-- cae_documentacion, ausencias, libro_subcontratacion y toolbox_talks. Las seis
-- pertenecen a las 23 tablas de ARC-011 fase 1/2 que "solo existen porque el
-- codigo las crea" (patron lazy) -- ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Fuente de cada columna (todas por CREATE TABLE, ninguna por ALTER):
--   registro_ambiental:    worker.js, ensureRegistroAmbientalTable()    (19 columnas)
--   seguros_obra:          worker.js, ensureSegurosObraTable()          (21 columnas)
--   cae_documentacion:     worker.js, ensureCaeDocumentacionTable()     (22 columnas)
--   ausencias:             worker.js, ensureAusenciasTable()            (17 columnas)
--   libro_subcontratacion: worker.js, ensureLibroSubcontratacionTable() (19 columnas)
--   toolbox_talks:         worker.js, ensureToolboxTalksTable()         (13 columnas)
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name IN (...), 2026-08-03): ninguna de las seis tablas existe
-- todavia en produccion -- el paso 2 (aplicar) de este vertical creara las tablas
-- por primera vez, no sera un no-op sobre datos existentes.
--
-- Riesgo: bajo. Seis CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna fila
-- existente de ninguna tabla (ninguna de las seis tiene filas: no existen aun).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js, las seis
-- funciones ensureXxxTable() listadas arriba) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS registro_ambiental (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER NOT NULL,
  tipo              TEXT DEFAULT 'observacion',
  categoria         TEXT,
  descripcion       TEXT NOT NULL,
  ubicacion         TEXT,
  cantidad          REAL,
  unidad            TEXT,
  gestor_autorizado TEXT,
  numero_documento  TEXT,
  estado            TEXT DEFAULT 'abierto',
  gravedad          TEXT DEFAULT 'baja',
  responsable       TEXT,
  fecha_evento      TEXT,
  fecha_cierre      TEXT,
  accion_tomada     TEXT,
  notas             TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seguros_obra (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id          INTEGER NOT NULL,
  obra_id             INTEGER,
  tipo                TEXT NOT NULL DEFAULT 'responsabilidad_civil',
  compania            TEXT NOT NULL,
  numero_poliza       TEXT NOT NULL,
  tomador             TEXT,
  asegurado           TEXT,
  capital_asegurado   REAL,
  prima_anual         REAL,
  fecha_inicio        TEXT NOT NULL,
  fecha_vencimiento   TEXT NOT NULL,
  forma_pago          TEXT DEFAULT 'anual',
  estado              TEXT NOT NULL DEFAULT 'activo',
  alertar_dias        INTEGER DEFAULT 30,
  contacto_agente     TEXT,
  adjunto_url         TEXT,
  notas               TEXT,
  created_by          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cae_documentacion (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id       INTEGER NOT NULL,
  obra_id          INTEGER,
  subcontrata      TEXT NOT NULL,
  cif              TEXT,
  actividad        TEXT,
  tipo_doc         TEXT NOT NULL DEFAULT 'plan_prevencion',
  titulo           TEXT NOT NULL,
  numero           TEXT,
  fecha_emision    TEXT,
  fecha_caducidad  TEXT,
  organismo        TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  adjunto_url      TEXT,
  alertar_dias     INTEGER DEFAULT 30,
  trabajadores     INTEGER,
  notas            TEXT,
  validado_por     TEXT,
  fecha_validacion TEXT,
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ausencias (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  usuario_id        INTEGER,
  externo_id        INTEGER,
  nombre_trabajador TEXT NOT NULL,
  tipo              TEXT NOT NULL DEFAULT 'vacaciones',
  fecha_inicio      TEXT NOT NULL,
  fecha_fin         TEXT NOT NULL,
  dias_habiles      INTEGER,
  estado            TEXT NOT NULL DEFAULT 'pendiente',
  aprobado_por      TEXT,
  fecha_aprobacion  TEXT,
  motivo            TEXT,
  notas             TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS libro_subcontratacion (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id            INTEGER NOT NULL,
  obra_id               INTEGER NOT NULL,
  numero_entrada        INTEGER NOT NULL,
  nivel                 INTEGER NOT NULL DEFAULT 1,
  subcontratista        TEXT    NOT NULL,
  nif_subcontratista    TEXT,
  actividad             TEXT    NOT NULL,
  fecha_inicio          TEXT    NOT NULL,
  fecha_fin             TEXT,
  num_trabajadores      INTEGER DEFAULT 0,
  responsable_seguridad TEXT,
  autorizado_por        TEXT,
  regimen_especial      INTEGER DEFAULT 0,
  observaciones         TEXT,
  estado                TEXT    NOT NULL DEFAULT 'activo',
  created_by            TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS toolbox_talks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  tema TEXT NOT NULL,
  descripcion TEXT,
  fecha TEXT NOT NULL,
  hora TEXT,
  duracion_min INTEGER DEFAULT 15,
  facilitador TEXT,
  asistentes TEXT,
  firma_facilitador TEXT,
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
