-- ARC-011 fase 3 (ADR-0011) -- vertical "proveedores_gestion", octavo vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), la tabla de gestion de proveedores/
-- subcontratas. Es una de las 105 tablas que solo existen porque worker.js la
-- crea en caliente; ninguna migracion versionada la declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Nota: distinta de la tabla legada "proveedores" (declarada en schema_completo.sql,
-- catalogo simple usado por pedidos/bobinas). proveedores_gestion es una tabla
-- nueva y mas rica (contacto, homologacion, valoracion), sin relacion de FK con
-- la legada.
--
-- Fuente: worker.js, ensureProveedoresGestionTable(), CREATE TABLE (23 columnas,
-- sin ALTER).
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info, autorizado por el Director 2026-08-03): las 23 columnas
-- coinciden exactamente con el codigo.
--
-- Riesgo: bajo. CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureProveedoresGestionTable()) se deja intacto hasta que el paso 2 y el
-- paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS proveedores_gestion (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id         INTEGER NOT NULL,
  nombre             TEXT    NOT NULL,
  cif                TEXT,
  tipo               TEXT    NOT NULL DEFAULT 'proveedor',
  categoria          TEXT,
  contacto_nombre    TEXT,
  contacto_cargo     TEXT,
  telefono           TEXT,
  email              TEXT,
  web                TEXT,
  direccion          TEXT,
  ciudad             TEXT,
  cp                 TEXT,
  pais               TEXT    DEFAULT 'España',
  activo             INTEGER NOT NULL DEFAULT 1,
  valoracion         INTEGER DEFAULT NULL,
  homologado         INTEGER NOT NULL DEFAULT 0,
  fecha_homologacion TEXT,
  notas              TEXT,
  created_by         TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
