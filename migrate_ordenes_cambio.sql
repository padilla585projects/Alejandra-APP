-- ARC-011 fase 3 (ADR-0011) -- vertical "ordenes_cambio", sexto vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), la tabla de ordenes de cambio de obra
-- (gestionar_oc). Es una de las 105 tablas que solo existen porque worker.js la
-- crea en caliente; ninguna migracion versionada la declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente: worker.js, ensureOrdenesCambioTable(), CREATE TABLE (17 columnas, sin
-- ALTER -- este vertical no tiene columna departamento/DEPT-01).
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info, autorizado por el Director 2026-08-03): las 17 columnas
-- coinciden exactamente con el codigo.
--
-- Riesgo: bajo. CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureOrdenesCambioTable()) se deja intacto hasta que el paso 2 y el paso 4
-- (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS ordenes_cambio (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id          INTEGER,
  empresa_id       INTEGER NOT NULL,
  numero           TEXT,
  titulo           TEXT NOT NULL,
  descripcion      TEXT,
  rfi_id           INTEGER,
  estado           TEXT DEFAULT 'propuesta',
  categoria        TEXT DEFAULT 'general',
  coste_adicional  REAL DEFAULT 0,
  dias_extension   INTEGER DEFAULT 0,
  solicitado_por   TEXT,
  aprobado_por     TEXT,
  fecha_propuesta  TEXT,
  fecha_aprobacion TEXT,
  notas            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);
