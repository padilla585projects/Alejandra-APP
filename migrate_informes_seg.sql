-- INFORMES-SEG-SEMANAL-01 (13/08/2026): informe interno semanal de Seguridad y Salud
-- Laboral por obra, a partir de la plantilla real que usa Levitec (S31 Informe semanal).
-- Autorizado explícitamente por Adrián. Aditivo, no toca ninguna tabla existente.

CREATE TABLE informes_seg_semanal (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  semana_inicio     TEXT NOT NULL,
  semana_numero     INTEGER,
  anio              INTEGER,
  numero_documento  TEXT,
  revision          TEXT DEFAULT 'XX',
  disciplina        TEXT DEFAULT 'Seguridad y Salud Laboral',
  aspectos_criticos TEXT,
  observaciones     TEXT,
  otros_puntos      TEXT,
  estado            TEXT NOT NULL DEFAULT 'borrador',
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  cerrado_por       TEXT,
  cerrado_at        TEXT
);

CREATE INDEX idx_informes_seg_semanal_busqueda ON informes_seg_semanal (empresa_id, obra_id, semana_inicio);

CREATE TABLE informes_seg_actividades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id    INTEGER NOT NULL,
  informe_id    INTEGER NOT NULL,
  fecha         TEXT NOT NULL,
  actividad     TEXT NOT NULL,
  contratista   TEXT,
  orden         INTEGER DEFAULT 0,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_informes_seg_actividades_informe ON informes_seg_actividades (informe_id);

CREATE TABLE informes_seg_fotos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  actividad_id   INTEGER NOT NULL,
  r2_key         TEXT NOT NULL,
  nombre_archivo TEXT,
  mime_type      TEXT,
  subido_por     TEXT,
  orden          INTEGER DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_informes_seg_fotos_actividad ON informes_seg_fotos (actividad_id);
