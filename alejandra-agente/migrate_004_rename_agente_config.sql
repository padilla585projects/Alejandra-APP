-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 004: Renombrar alejandra_config → agente_config
-- ══════════════════════════════════════════════════════════════════════════════
-- PROBLEMA: el worker principal usa alejandra_config como tabla clave-valor
-- (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT). El agente usaba el mismo
-- nombre con schema diferente (id, modo, auto_fix, max_iterations). Conflicto
-- silencioso en la misma D1. Se resuelve dando al agente su propia tabla.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Crear la nueva tabla con el schema correcto del agente
CREATE TABLE IF NOT EXISTS agente_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  modo TEXT DEFAULT 'autonomo',
  auto_fix INTEGER DEFAULT 1,
  max_iterations INTEGER DEFAULT 15,
  updated_at TEXT,
  UNIQUE(id)
);

-- 2. Si existía alejandra_config con el schema del agente, migrar los datos
-- (Si la tabla tenía el schema del worker principal este INSERT fallará limpiamente)
INSERT OR IGNORE INTO agente_config (id, modo, auto_fix, max_iterations, updated_at)
SELECT id, modo, auto_fix, max_iterations, updated_at
FROM alejandra_config
WHERE typeof(id) = 'integer' AND modo IS NOT NULL
LIMIT 1;

-- 3. Config inicial por defecto si no hay nada
INSERT OR IGNORE INTO agente_config (id, modo, auto_fix, max_iterations, updated_at)
VALUES (1, 'autonomo', 1, 15, datetime('now'));
