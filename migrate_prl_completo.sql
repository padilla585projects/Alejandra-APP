-- ============================================================
-- MIGRACIÓN PRL COMPLETO — v6.46
-- Módulo de Seguridad y Salud en Obra ampliado
-- RD 1627/1997, Ley 31/1995, RD 39/1997, Ley 32/2006
-- ============================================================

-- 1. RECONOCIMIENTOS MÉDICOS (LPRL art. 22 — obligatorio anual)
CREATE TABLE IF NOT EXISTS reconocimientos_medicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  usuario_id TEXT,
  externo_id INTEGER,
  nombre_trabajador TEXT NOT NULL,
  tipo TEXT DEFAULT 'anual',             -- anual, inicial, periodico, reintegro, tras_baja
  resultado TEXT DEFAULT 'apto',         -- apto, apto_con_restricciones, no_apto
  restricciones TEXT,                    -- descripción si apto_con_restricciones
  fecha_realizacion TEXT NOT NULL,
  fecha_caducidad TEXT NOT NULL,         -- normalmente +1 año
  dias_aviso INTEGER DEFAULT 30,
  centro_medico TEXT,
  medico_responsable TEXT,
  notas TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recmed_empresa ON reconocimientos_medicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_recmed_caducidad ON reconocimientos_medicos(fecha_caducidad);
CREATE INDEX IF NOT EXISTS idx_recmed_usuario ON reconocimientos_medicos(usuario_id);

-- 2. DOCUMENTOS DE OBRA (RD 1627/1997 — los 12 documentos obligatorios)
CREATE TABLE IF NOT EXISTS documentos_obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  -- Tipos: pss, ess, ebss, aviso_previo, apertura_centro, libro_incidencias,
  --        libro_subcontratacion, plan_emergencia, evaluacion_riesgos,
  --        coordinacion_actividades, seguro_rc, otro
  titulo TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente',       -- pendiente, en_tramite, vigente, vencido, no_aplica
  fecha_emision TEXT,
  fecha_caducidad TEXT,
  elaborado_por TEXT,                    -- técnico/empresa que lo elaboró
  aprobado_por TEXT,                     -- CSS, dirección facultativa, autoridad laboral
  r2_key TEXT,                           -- PDF subido a R2
  notas TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docobra_empresa_obra ON documentos_obra(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_docobra_tipo ON documentos_obra(tipo);
CREATE INDEX IF NOT EXISTS idx_docobra_estado ON documentos_obra(estado);

-- 3. PERMISOS DE TRABAJO (PTR — obligatorios para trabajos de alto riesgo)
CREATE TABLE IF NOT EXISTS permisos_trabajo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  -- Tipos: altura, electrico, espacio_confinado, demolicion, excavacion, soldadura, otro
  descripcion TEXT NOT NULL,
  ubicacion TEXT,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT,
  turno TEXT,                            -- manana, tarde, noche
  trabajadores TEXT,                     -- JSON: [{nombre, dni, carnet?}]
  riesgos TEXT,                          -- Riesgos identificados
  medidas_preventivas TEXT,
  epis_requeridos TEXT,                  -- EPIs obligatorios para este trabajo
  estado TEXT DEFAULT 'activo',          -- activo, completado, cancelado
  autorizado_por TEXT,                   -- Encargado/CSS que autoriza
  notas TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ptrabajo_empresa_obra ON permisos_trabajo(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_ptrabajo_tipo ON permisos_trabajo(tipo);
CREATE INDEX IF NOT EXISTS idx_ptrabajo_fecha ON permisos_trabajo(fecha_inicio);

-- 4. INSPECCIONES DE SEGURIDAD (periódicas/extraordinarias)
CREATE TABLE IF NOT EXISTS inspecciones_seg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER NOT NULL,
  tipo TEXT DEFAULT 'periodica',         -- periodica, inicial, extraordinaria, auditoria
  inspector TEXT NOT NULL,
  fecha TEXT NOT NULL,
  areas_inspeccionadas TEXT,             -- JSON array de áreas
  hallazgos TEXT,                        -- JSON: [{area, descripcion, gravedad, accion_requerida}]
  conformidades INTEGER DEFAULT 0,
  no_conformidades INTEGER DEFAULT 0,
  obs_menores INTEGER DEFAULT 0,
  puntuacion INTEGER,                    -- Score 0-100
  estado TEXT DEFAULT 'abierta',         -- abierta, cerrada
  fecha_cierre TEXT,
  proxima_inspeccion TEXT,
  r2_key TEXT,                           -- Informe PDF en R2
  notas TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inspeccion_empresa_obra ON inspecciones_seg(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_fecha ON inspecciones_seg(fecha);

-- 5. HISTORIAL DE REVISIONES DE EPIs (arneses, PEMP, equipos de altura)
CREATE TABLE IF NOT EXISTS epi_revisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  epi_asignado_id INTEGER,               -- FK epis_asignados.id
  inventario_id INTEGER,                 -- FK inventario_seg.id (para EPIs de inventario)
  nombre_epi TEXT,                       -- Nombre del equipo revisado
  tipo_revision TEXT DEFAULT 'periodica',-- inicial, periodica, post_incidente, pre_uso
  fecha_revision TEXT NOT NULL,
  resultado TEXT DEFAULT 'apto',         -- apto, apto_con_observaciones, no_apto_retirar
  observaciones TEXT,
  proxima_revision TEXT,
  revisado_por TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_epirevi_empresa ON epi_revisiones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_epirevi_epi ON epi_revisiones(epi_asignado_id);

-- 6. MEJORAS EN TABLA INCIDENCIAS (sin romper datos existentes)
ALTER TABLE incidencias ADD COLUMN tipo_incidente TEXT DEFAULT 'condicion_insegura';
-- Valores: accidente, casi_accidente, condicion_insegura, acto_inseguro, emergencia

ALTER TABLE incidencias ADD COLUMN accion_correctiva TEXT;
ALTER TABLE incidencias ADD COLUMN plazo_cierre TEXT;
ALTER TABLE incidencias ADD COLUMN responsable_cierre TEXT;
ALTER TABLE incidencias ADD COLUMN baja_laboral INTEGER DEFAULT 0;
ALTER TABLE incidencias ADD COLUMN dias_baja INTEGER DEFAULT 0;
ALTER TABLE incidencias ADD COLUMN fecha_cierre_real TEXT;
