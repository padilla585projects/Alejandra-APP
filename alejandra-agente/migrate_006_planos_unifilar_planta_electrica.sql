-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 006: amplía CHECK de "tipo" en tabla planos
-- Añade 'unifilar' (esquema de interconexión entre cuadros) y 'planta_electrica'
-- (plano de planta con canalizaciones/tomas/luminarias) a los tipos válidos.
-- SQLite no permite ALTER de un CHECK constraint directamente -- hay que
-- reconstruir la tabla. Diseñada para ser re-ejecutable sin pérdida de datos
-- (el workflow de deploy la relanza en cada push con "|| echo ya aplicada").
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS planos_tmp_006 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  usuario_id     INTEGER,
  tipo           TEXT    NOT NULL CHECK(tipo IN ('planta','electrico','mecanico','gantt','bandejas','unifilar','planta_electrica')),
  titulo         TEXT    NOT NULL,
  descripcion    TEXT,
  svg_data       TEXT    NOT NULL,
  metadatos      TEXT,
  creado_en      TEXT    DEFAULT (datetime('now')),
  actualizado_en TEXT    DEFAULT (datetime('now'))
);

INSERT INTO planos_tmp_006 (id, empresa_id, usuario_id, tipo, titulo, descripcion, svg_data, metadatos, creado_en, actualizado_en)
SELECT id, empresa_id, usuario_id, tipo, titulo, descripcion, svg_data, metadatos, creado_en, actualizado_en
FROM planos
WHERE id NOT IN (SELECT id FROM planos_tmp_006);

DROP TABLE IF EXISTS planos_backup_006;
ALTER TABLE planos RENAME TO planos_backup_006;
ALTER TABLE planos_tmp_006 RENAME TO planos;
DROP TABLE IF EXISTS planos_backup_006;
