-- Memoria persistente de Alejandra IA
CREATE TABLE IF NOT EXISTS alejandra_memoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'contexto', -- hecho | pendiente | contexto | aviso
  canal TEXT DEFAULT 'general',          -- telegram | app | panel | general
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  importancia INTEGER DEFAULT 1,         -- 1 (baja) a 5 (crítica)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Historial de conversación por canal (últimos mensajes)
CREATE TABLE IF NOT EXISTS alejandra_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canal TEXT NOT NULL,  -- telegram | app | panel
  rol TEXT NOT NULL,    -- user | assistant
  contenido TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
