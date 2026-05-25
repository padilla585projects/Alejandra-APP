-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 004: Crear agente_config (tabla propia del agente)
-- ══════════════════════════════════════════════════════════════════════════════
-- PROBLEMA: alejandra_config la usaba el agente con schema (id,modo,auto_fix,
-- max_iterations) pero el worker principal la usa como clave-valor (key,value).
-- SOLUCIÓN: el agente usa su propia tabla agente_config. Ambos workers comparten
-- la misma D1 sin conflicto.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agente_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  modo TEXT DEFAULT 'autonomo',
  auto_fix INTEGER DEFAULT 1,
  max_iterations INTEGER DEFAULT 15,
  updated_at TEXT,
  UNIQUE(id)
);

-- Configuración inicial por defecto
INSERT OR IGNORE INTO agente_config (id, modo, auto_fix, max_iterations, updated_at)
VALUES (1, 'autonomo', 1, 15, datetime('now'));
