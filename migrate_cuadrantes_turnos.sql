-- Migración: Cuadrantes de turnos (Seguridad — PRL)
-- Fecha: 2026-09-18
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_cuadrantes_turnos.sql --remote
-- NOTA: requiere aprobación humana explícita antes de ejecutar contra D1 remoto
--       (CLAUDE.md, ADR-0007). Tablas nuevas, aditivas, no tocan ninguna existente.
--       Hasta que se aplique, worker.js crea las tablas al primer uso
--       (_ensureCuadrantesTurnosTables, mismo patrón que Replanteos/Sondas CPD).
--
-- Reparto semanal de turnos para cubrir una franja horaria de la obra (ej. 7:00-19:00)
-- con horas objetivo/semana por trabajadora (lo que pase se marca hora extra) y rotación
-- justa entre semanas. Módulo separado de `turnos` (calendario libre Mañana/Tarde/Noche/
-- Libre, sin horas objetivo/extra ni aislamiento por departamento): no se reutiliza esa
-- tabla porque ya la consumen syncRRHH, el export RGPD y el aviso de Telegram.

CREATE TABLE IF NOT EXISTS cuadrantes_turnos (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id             INTEGER NOT NULL,
  obra_id                INTEGER,
  departamento           TEXT    NOT NULL,
  nombre                 TEXT    NOT NULL,
  hora_inicio            TEXT    NOT NULL,
  hora_fin               TEXT    NOT NULL,
  dias_semana            TEXT    NOT NULL,       -- ej. "LMXJV" (mismo alfabeto que horarios_obra.dias_semana)
  personas_simultaneas   INTEGER NOT NULL DEFAULT 1,
  horas_objetivo_semana  REAL    NOT NULL DEFAULT 40,
  fecha_inicio           TEXT    NOT NULL,
  semanas                INTEGER NOT NULL DEFAULT 4,
  estado                 TEXT    NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','publicado')),
  creado_por             TEXT,
  creado_en              TEXT DEFAULT (datetime('now')),
  actualizado_en         TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cuadrantes_turnos_empresa ON cuadrantes_turnos(empresa_id, obra_id, departamento);

CREATE TABLE IF NOT EXISTS cuadrante_trabajadoras (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cuadrante_id  INTEGER NOT NULL,
  usuario_id    INTEGER,          -- NULL si es una trabajadora externa (sin usuario en la app)
  nombre        TEXT    NOT NULL,
  color         TEXT    NOT NULL DEFAULT '#2563eb',
  activo        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_cuadrante_trabajadoras_cuadrante ON cuadrante_trabajadoras(cuadrante_id);

CREATE TABLE IF NOT EXISTS cuadrante_asignaciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cuadrante_id   INTEGER NOT NULL,
  trabajadora_id INTEGER NOT NULL,
  fecha          TEXT    NOT NULL,
  hora_inicio    TEXT    NOT NULL,
  hora_fin       TEXT    NOT NULL,
  horas          REAL    NOT NULL,
  es_extra       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cuadrante_asignaciones_cuadrante_fecha ON cuadrante_asignaciones(cuadrante_id, fecha);
