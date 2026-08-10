-- Aislamiento por departamento (DEPT-01) -- auditoria de Alejandra Office (10/08/2026)
-- Grupo "Compras y material": ordenes de compra, entregas, consumos y solicitudes.
--
-- ordenes_compra YA esta declarada (migrate_ordenes_compra.sql, aplicada:true)
-- -- se le anade con ALTER. entregas_material, consumos_material y
-- solicitudes_material nunca se declararon (100% DDL en runtime) -- se
-- declaran aqui por primera vez, esquema EXACTO verbatim contra worker.js
-- (entregas_material l.19127, consumos_material l.22540, solicitudes_material
-- l.22855), con `departamento` incluido en el CREATE.
--
-- Riesgo: bajo, mismo patron aditivo que el resto de este lote.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia.

ALTER TABLE ordenes_compra ADD COLUMN departamento TEXT;

CREATE TABLE IF NOT EXISTS entregas_material (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  fase_id           INTEGER,
  numero_pedido     TEXT,
  descripcion       TEXT NOT NULL,
  proveedor         TEXT,
  contacto_prov     TEXT,
  unidad            TEXT DEFAULT 'ud',
  cantidad_pedida   REAL DEFAULT 0,
  cantidad_recibida REAL DEFAULT 0,
  precio_unitario   REAL DEFAULT 0,
  importe_total     REAL DEFAULT 0,
  fecha_pedido      TEXT,
  fecha_entrega_prevista TEXT,
  fecha_entrega_real     TEXT,
  estado            TEXT DEFAULT 'pendiente',
  ubicacion_obra    TEXT,
  notas             TEXT,
  albaranado        INTEGER DEFAULT 0,
  numero_albaran    TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  departamento      TEXT
);

CREATE TABLE IF NOT EXISTS consumos_material (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  numero            TEXT,
  fecha             TEXT NOT NULL,
  tipo_movimiento   TEXT NOT NULL DEFAULT 'salida',
  material          TEXT NOT NULL,
  referencia        TEXT,
  cantidad          REAL NOT NULL,
  unidad            TEXT NOT NULL DEFAULT 'ud',
  almacen           TEXT,
  solicitado_por    TEXT,
  fase_trabajo      TEXT,
  coste_unitario    REAL,
  coste_total       REAL,
  observaciones     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  departamento      TEXT
);

CREATE TABLE IF NOT EXISTS solicitudes_material (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id       INTEGER NOT NULL,
  obra_id          INTEGER,
  numero           TEXT,
  fecha_solicitud  TEXT NOT NULL,
  fecha_necesaria  TEXT,
  solicitante      TEXT,
  fase_trabajo     TEXT,
  prioridad        TEXT NOT NULL DEFAULT 'normal',
  lineas           TEXT NOT NULL DEFAULT '[]',
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  aprobado_por     TEXT,
  fecha_aprobacion TEXT,
  pedido_id        INTEGER,
  observaciones    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  departamento     TEXT
);
