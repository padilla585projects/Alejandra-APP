-- ARC-011 fase 3 (ADR-0011) -- vertical "ordenes_compra", septimo vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), las dos tablas de ordenes de compra:
-- ordenes_compra y su detalle oc_lineas (FK oc_id -> ordenes_compra.id). Ambas
-- son de las 105 tablas que solo existen porque worker.js las crea en caliente;
-- ninguna migracion versionada las declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente: worker.js, ensureOcTable(), CREATE TABLE x2 (sin ALTER en ninguna).
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info, autorizado por el Director 2026-08-03): 15 columnas en
-- ordenes_compra y 8 en oc_lineas, coincidiendo exactamente con el codigo.
--
-- Riesgo: bajo. Dos CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna
-- fila existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureOcTable()) se deja intacto hasta que el paso 2 y el paso 4 (verificar
-- en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS ordenes_compra (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id    INTEGER NOT NULL,
  obra_id       INTEGER,
  numero        TEXT NOT NULL,
  proveedor     TEXT NOT NULL,
  descripcion   TEXT,
  fecha_emision TEXT,
  fecha_entrega TEXT,
  estado        TEXT NOT NULL DEFAULT 'borrador',
  importe_total REAL DEFAULT 0,
  notas         TEXT,
  aprobado_por  TEXT,
  aprobado_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oc_lineas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  oc_id       INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  unidad      TEXT DEFAULT 'ud',
  cantidad    REAL DEFAULT 1,
  precio_unit REAL DEFAULT 0,
  recibido    REAL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
