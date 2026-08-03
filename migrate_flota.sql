-- ARC-011 fase 3 (ADR-0011) -- vertical "flota", decimotercer vertical del ciclo
-- (quinto vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (la tabla NO existe
-- todavia en D1, ver verificacion abajo), la tabla de gestion de flota de
-- vehiculos: flota_vehiculos. Pertenece a las 23 tablas de ARC-011 fase 1/2 que
-- "solo existen porque el codigo las crea" (patron lazy) -- ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Fuente: worker.js, ensureFlorVehiculosTable() (29 columnas, todas por CREATE
-- TABLE, ninguna por ALTER). El nombre de la funcion tiene una errata
-- ("Flor" en vez de "Flota") -- desajuste cosmetico, no afecta al esquema ni a
-- esta migracion.
--
-- Verticalizada aparte de migrate_relaciones_obra.sql/migrate_seguridad_cumplimiento.sql
-- porque flota_vehiculos es un dominio propio (mantenimiento y documentacion de
-- vehiculos), no encaja en ninguno de los otros grupos tematicos de este lote.
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name = 'flota_vehiculos', 2026-08-03): la tabla no existe
-- todavia en produccion -- el paso 2 (aplicar) creara la tabla por primera vez, no
-- sera un no-op sobre datos existentes.
--
-- Riesgo: bajo. Un CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente (la tabla no existe aun, no tiene filas).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureFlorVehiculosTable()) se deja intacto hasta que el paso 2 y el paso 4
-- (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS flota_vehiculos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id           INTEGER NOT NULL,
  matricula            TEXT    NOT NULL,
  tipo                 TEXT    NOT NULL DEFAULT 'furgoneta',
  marca                TEXT,
  modelo               TEXT,
  color                TEXT,
  anno_fabricacion     INTEGER,
  bastidor             TEXT,
  asignado_a           TEXT,
  obra_id              INTEGER,
  km_actual            INTEGER DEFAULT 0,
  km_ultimo_servicio   INTEGER DEFAULT 0,
  km_proximo_servicio  INTEGER DEFAULT 0,
  fecha_itv            TEXT,
  prox_itv             TEXT,
  fecha_seguro         TEXT,
  prox_renovacion_seguro TEXT,
  aseguradora          TEXT,
  poliza_seguro        TEXT,
  fecha_revision       TEXT,
  prox_revision        TEXT,
  estado               TEXT    NOT NULL DEFAULT 'disponible',
  combustible          TEXT    DEFAULT 'diesel',
  notas                TEXT,
  activo               INTEGER NOT NULL DEFAULT 1,
  created_by           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
