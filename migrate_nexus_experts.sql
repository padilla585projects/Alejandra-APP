-- ARC-011 fase 3 (ADR-0011) -- vertical "nexus_experts", decimocuarto vertical del
-- ciclo (sexto vertical del tercer lote agrupado, 2026-08-03).
--
-- Declara, con el esquema EXACTO que hoy tiene worker.js (la tabla NO existe
-- todavia en D1, ver verificacion abajo), la tabla nexus_experts. Pertenece a las
-- 23 tablas de ARC-011 fase 1/2 que "solo existen porque el codigo las crea"
-- (patron lazy) -- ver docs/architecture/07-INVENTARIO-DDL-RUNTIME.md.
--
-- Migrada en archivo aparte, deliberadamente, en vez de agruparla con cualquiera
-- de las otras cinco de este lote: nexus_experts NO es una tabla de dominio de
-- obra/construccion como las demas 22 -- es telemetria interna de salud de los
-- "expertos" de Nexus (integracion con sistemas externos, ver ADR-0008), sin
-- empresa_id ni obra_id (no tiene tenant, es global a la instalacion). Tampoco se
-- crea desde una funcion _ensureXxxTable() reutilizable como las demas: su CREATE
-- TABLE vive dentro de runMigrations(request, env), un endpoint de migracion en
-- bloque de un solo uso, solo accesible a superadmin.
--
-- Fuente: worker.js, runMigrations(), bloque CREATE TABLE de nexus_experts
-- (8 columnas, todas por CREATE TABLE, ninguna por ALTER).
--
-- Verificado contra D1 real (solo lectura, SELECT name FROM sqlite_master WHERE
-- type='table' AND name = 'nexus_experts', 2026-08-03): la tabla no existe
-- todavia en produccion -- el paso 2 (aplicar) creara la tabla por primera vez, no
-- sera un no-op sobre datos existentes.
--
-- Riesgo: bajo. Un CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente (la tabla no existe aun, no tiene filas).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- runMigrations(), bloque de nexus_experts) se deja intacto hasta que el paso 2 y
-- el paso 4 (verificar en produccion sin el DDL en caliente) esten completos --
-- nota: al vivir dentro de un endpoint de un solo uso y no en una funcion
-- reutilizable invocada en cada request, "retirar el DDL en runtime" (paso 3) de
-- este vertical puede resultar en un cambio distinto al patron de comentar una
-- funcion ensureXxxTable(); se revisa en el paso 3 de este vertical, no aqui.

CREATE TABLE IF NOT EXISTS nexus_experts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT UNIQUE NOT NULL,
  score       INTEGER DEFAULT 80,
  total_calls INTEGER DEFAULT 0,
  tokens_in   INTEGER DEFAULT 0,
  tokens_out  INTEGER DEFAULT 0,
  cost_cents  INTEGER DEFAULT 0,
  updated_at  TEXT DEFAULT (datetime('now'))
);
