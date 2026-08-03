-- ARC-011 fase 3 (ADR-0011) -- vertical "finanzas_obra", decimo vertical del ciclo
-- (segundo vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (estas seis tablas NO
-- existen todavia en D1, ver verificacion abajo), las tablas del dominio economico
-- de obra: presupuesto_obra, presupuesto_lineas, costes_obra, cobros_cliente,
-- gastos_dietas y licitaciones. Las seis pertenecen a las 23 tablas de ARC-011
-- fase 1/2 que "solo existen porque el codigo las crea" (patron lazy) -- ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Fuente de cada columna (todas por CREATE TABLE, ninguna por ALTER):
--   presupuesto_obra:   worker.js, ensurePresupuestoObraTable() (12 columnas)
--   presupuesto_lineas: worker.js, ensurePresupuestoTable()     (18 columnas) --
--                       OJO: el nombre de la funcion es ensurePresupuestoTable
--                       (no ensurePresupuestoLineasTable), pero la tabla que crea
--                       es presupuesto_lineas -- desajuste cosmetico de nombre de
--                       funcion, no de esquema; no confundir con presupuesto_obra,
--                       que es una tabla distinta con proposito distinto (partida
--                       de presupuesto a nivel obra vs. linea de medicion detallada)
--   costes_obra:        worker.js, ensureCostesObraTable()    (13 columnas)
--   cobros_cliente:     worker.js, ensureCobrosClienteTable() (22 columnas)
--   gastos_dietas:      worker.js, ensureGastosDietasTable()  (28 columnas)
--   licitaciones:       worker.js, ensureLicitacionesTable()  (26 columnas)
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name IN (...), 2026-08-03): ninguna de las seis tablas existe
-- todavia en produccion -- el paso 2 (aplicar) de este vertical creara las tablas
-- por primera vez, no sera un no-op sobre datos existentes.
--
-- gastos_dietas.importe_km se reproduce tal cual del codigo: es una columna
-- GENERATED ALWAYS AS (...) VIRTUAL (calculada por SQLite a partir de km y
-- precio_km), la unica columna generada entre las tablas de este lote -- no se
-- simplifica a una columna normal.
--
-- Riesgo: bajo. Seis CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna fila
-- existente de ninguna tabla (ninguna de las seis tiene filas: no existen aun).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js, las seis
-- funciones ensureXxxTable() listadas arriba) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS presupuesto_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  descripcion TEXT NOT NULL,
  importe_previsto REAL DEFAULT 0,
  importe_real REAL DEFAULT 0,
  unidades REAL DEFAULT 1,
  unidad TEXT DEFAULT 'ud',
  proveedor TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presupuesto_lineas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id            INTEGER NOT NULL,
  obra_id               INTEGER NOT NULL,
  capitulo              TEXT DEFAULT '01',
  codigo                TEXT,
  descripcion           TEXT NOT NULL,
  unidad                TEXT DEFAULT 'ud',
  cantidad_presupuestada REAL DEFAULT 0,
  precio_unitario       REAL DEFAULT 0,
  importe_presupuestado REAL DEFAULT 0,
  cantidad_ejecutada    REAL DEFAULT 0,
  importe_ejecutado     REAL DEFAULT 0,
  porcentaje_avance     REAL DEFAULT 0,
  fase_id               INTEGER,
  orden                 INTEGER DEFAULT 0,
  notas                 TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS costes_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  fase_id INTEGER,
  concepto TEXT NOT NULL,
  tipo TEXT DEFAULT 'otros',
  importe REAL NOT NULL DEFAULT 0,
  fecha TEXT,
  proveedor TEXT,
  factura_ref TEXT,
  notas TEXT,
  creado_por TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cobros_cliente (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  certificacion_id  INTEGER,
  numero            TEXT,
  cliente_nombre    TEXT,
  concepto          TEXT,
  fecha_emision     TEXT    NOT NULL,
  fecha_vencimiento TEXT,
  importe_bruto     REAL    NOT NULL DEFAULT 0,
  importe_retencion REAL    NOT NULL DEFAULT 0,
  importe_liquido   REAL    NOT NULL DEFAULT 0,
  importe_cobrado   REAL    NOT NULL DEFAULT 0,
  estado            TEXT    NOT NULL DEFAULT 'pendiente',
  fecha_cobro       TEXT,
  metodo_cobro      TEXT,
  referencia_cobro  TEXT,
  dias_vencimiento  INTEGER,
  notas             TEXT,
  created_by        TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gastos_dietas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  usuario_id        INTEGER,
  nombre_trabajador TEXT    NOT NULL,
  obra_id           INTEGER,
  fecha             TEXT    NOT NULL,
  tipo              TEXT    NOT NULL DEFAULT 'dieta',
  concepto          TEXT,
  km                REAL    DEFAULT 0,
  precio_km         REAL    DEFAULT 0.26,
  importe_km        REAL    GENERATED ALWAYS AS (ROUND(km * precio_km, 2)) VIRTUAL,
  dieta_media_dia   REAL    DEFAULT 0,
  dieta_completa    REAL    DEFAULT 0,
  alojamiento       REAL    DEFAULT 0,
  peajes            REAL    DEFAULT 0,
  parking           REAL    DEFAULT 0,
  otros             REAL    DEFAULT 0,
  total             REAL    NOT NULL DEFAULT 0,
  estado            TEXT    NOT NULL DEFAULT 'pendiente',
  aprobado_por      TEXT,
  fecha_aprobacion  TEXT,
  pagado            INTEGER DEFAULT 0,
  fecha_pago        TEXT,
  justificante_url  TEXT,
  notas             TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS licitaciones (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id           INTEGER NOT NULL,
  nombre               TEXT    NOT NULL,
  cliente              TEXT,
  expediente           TEXT,
  tipo_obra            TEXT,
  provincia            TEXT,
  presupuesto_base     REAL    DEFAULT 0,
  nuestra_oferta       REAL    DEFAULT 0,
  margen_pct           REAL,
  estado               TEXT    NOT NULL DEFAULT 'prospectando',
  probabilidad         INTEGER DEFAULT 50,
  fecha_presentacion   TEXT,
  fecha_apertura       TEXT,
  fecha_adjudicacion   TEXT,
  responsable          TEXT,
  competidores         TEXT,
  criterios_adj        TEXT,
  puntuacion_tecnica   REAL,
  puntuacion_economica REAL,
  motivo_perdida       TEXT,
  notas                TEXT,
  obra_id              INTEGER,
  created_by           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
