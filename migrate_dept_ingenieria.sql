-- Aislamiento por departamento (DEPT-01) -- auditoria de Alejandra Office (10/08/2026)
--
-- Ninguna de estas 6 tablas tenia columna `departamento`, asi que el backend
-- solo podia acotar por empresa_id: cualquier usuario no privilegiado veia
-- fases, hitos, plan semanal, instrucciones, visitas e ITP de TODOS los
-- departamentos de la obra, no solo el suyo. Grupo "Ingenieria" del plan de
-- fix acordado con el Director.
--
-- Dos casos distintos:
--   * fases_obra y plan_semanal YA estan declaradas (migrate_planificacion_produccion.sql,
--     aplicada:true) -- se les anade la columna con ALTER, no se puede volver
--     a declarar el CREATE.
--   * hitos_obra, instrucciones_obra, visitas_obra e itp_obra NUNCA se
--     declararon en ninguna migracion (100% DDL en runtime, ARC-011) -- se
--     declaran aqui por primera vez con su esquema EXACTO (verbatim contra
--     worker.js: ensureHitosObraTable, l.17442; instruccionesObra, l.19819;
--     ensureVisitasObraTable, l.20567/20560; itp_obra, l.20826), con
--     `departamento` ya incluido en el CREATE.
--
-- Riesgo: bajo. ALTER TABLE ADD COLUMN (nullable, sin default distinto de
-- NULL) es aditivo; CREATE TABLE IF NOT EXISTS con las 4 tablas nuevas no
-- toca ninguna fila existente de ninguna tabla, sea cual sea su estado.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- exige autorizacion explicita del Director. El DDL en runtime de
-- hitos_obra/instrucciones_obra/visitas_obra/itp_obra se deja intacto hasta
-- completar el paso 4 (verificar en produccion sin el DDL en caliente).

ALTER TABLE fases_obra ADD COLUMN departamento TEXT;
ALTER TABLE plan_semanal ADD COLUMN departamento TEXT;

CREATE TABLE IF NOT EXISTS hitos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  tipo TEXT DEFAULT 'general',
  responsable TEXT,
  alertar_dias INTEGER DEFAULT 7,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  departamento TEXT
);

CREATE TABLE IF NOT EXISTS instrucciones_obra (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER NOT NULL,
  numero            TEXT,
  titulo            TEXT NOT NULL,
  descripcion       TEXT,
  destinatario      TEXT,
  emitido_por       TEXT,
  prioridad         TEXT DEFAULT 'normal',
  estado            TEXT DEFAULT 'emitida',
  fecha_emision     TEXT,
  fecha_respuesta_limite TEXT,
  notas_respuesta   TEXT,
  rfi_id            INTEGER,
  created_at        TEXT DEFAULT (datetime('now')),
  departamento      TEXT
);

CREATE TABLE IF NOT EXISTS visitas_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  fecha TEXT NOT NULL,
  hora_entrada TEXT,
  hora_salida TEXT,
  nombre TEXT NOT NULL,
  empresa_visitante TEXT,
  rol TEXT DEFAULT 'otro',
  proposito TEXT,
  areas_visitadas TEXT,
  observaciones TEXT,
  autorizado_por TEXT,
  creado_por TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  departamento TEXT
);

CREATE TABLE IF NOT EXISTS itp_obra (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER NOT NULL,
  obra_id     INTEGER,
  titulo      TEXT NOT NULL,
  revision    TEXT DEFAULT 'R0',
  disciplina  TEXT,
  estado      TEXT NOT NULL DEFAULT 'activo',
  responsable TEXT,
  notas       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  departamento TEXT
);
