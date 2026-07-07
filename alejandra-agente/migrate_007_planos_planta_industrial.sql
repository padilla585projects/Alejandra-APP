-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 007: amplía CHECK de "tipo" en tabla planos
-- Añade 'planta_industrial' (plano de planta con instalación eléctrica de nave
-- industrial / CPD-datacenter / obra de gran envergadura) a los tipos válidos.
-- SQLite no permite ALTER de un CHECK constraint directamente -- hay que
-- reconstruir la tabla. Diseñada para ser re-ejecutable sin pérdida de datos
-- (el workflow de deploy la relanza en cada push con "|| echo ya aplicada").
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS planos_tmp_007 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  usuario_id     INTEGER,
  tipo           TEXT    NOT NULL CHECK(tipo IN ('planta','electrico','mecanico','gantt','bandejas','unifilar','planta_electrica','planta_industrial')),
  titulo         TEXT    NOT NULL,
  descripcion    TEXT,
  svg_data       TEXT    NOT NULL,
  metadatos      TEXT,
  creado_en      TEXT    DEFAULT (datetime('now')),
  actualizado_en TEXT    DEFAULT (datetime('now'))
);

INSERT INTO planos_tmp_007 (id, empresa_id, usuario_id, tipo, titulo, descripcion, svg_data, metadatos, creado_en, actualizado_en)
SELECT id, empresa_id, usuario_id, tipo, titulo, descripcion, svg_data, metadatos, creado_en, actualizado_en
FROM planos
WHERE id NOT IN (SELECT id FROM planos_tmp_007);

DROP TABLE IF EXISTS planos_backup_007;
ALTER TABLE planos RENAME TO planos_backup_007;
ALTER TABLE planos_tmp_007 RENAME TO planos;
DROP TABLE IF EXISTS planos_backup_007;
