-- Aislamiento por departamento (DEPT-01) -- auditoria de Alejandra Office (10/08/2026)
-- Grupo "Documental": contactos, contratos, submittals y transmittals de obra.
--
-- contactos_obra YA esta declarada (migrate_relaciones_obra.sql, aplicada:true)
-- -- se le anade la columna con ALTER. contratos_obra, submittals y
-- transmittals_obra nunca se declararon (100% DDL en runtime, ARC-011) -- se
-- declaran aqui por primera vez, esquema EXACTO verbatim contra worker.js
-- (contratos_obra l.18292, submittals l.18399, transmittals_obra l.18716),
-- con `departamento` incluido en el CREATE.
--
-- Riesgo: bajo, mismo patron aditivo que el resto de este lote (ver
-- migrate_dept_ingenieria.sql para el detalle del criterio).
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia.

ALTER TABLE contactos_obra ADD COLUMN departamento TEXT;

CREATE TABLE IF NOT EXISTS contratos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER,
  obra_id INTEGER,
  numero TEXT,
  tipo TEXT DEFAULT 'subcontrata',
  titulo TEXT NOT NULL,
  contratista TEXT,
  contacto_id INTEGER,
  importe_original REAL DEFAULT 0,
  importe_actual REAL DEFAULT 0,
  estado TEXT DEFAULT 'borrador',
  fecha_firma TEXT,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  descripcion TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  departamento TEXT
);

CREATE TABLE IF NOT EXISTS submittals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER,
  obra_id INTEGER,
  numero TEXT,
  tipo TEXT DEFAULT 'material',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  especificacion TEXT,
  fabricante TEXT,
  modelo TEXT,
  estado TEXT DEFAULT 'pendiente',
  prioridad TEXT DEFAULT 'normal',
  responsable TEXT,
  revisor TEXT,
  revision TEXT DEFAULT 'A',
  fecha_envio TEXT,
  fecha_limite TEXT,
  fecha_respuesta TEXT,
  notas TEXT,
  notas_revision TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  departamento TEXT
);

CREATE TABLE IF NOT EXISTS transmittals_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  numero TEXT,
  asunto TEXT NOT NULL,
  de_quien TEXT,
  para_quien TEXT,
  fecha_envio TEXT,
  fecha_limite TEXT,
  tipo TEXT DEFAULT 'envio',
  estado TEXT DEFAULT 'enviado',
  referencia TEXT,
  documentos TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  departamento TEXT
);
