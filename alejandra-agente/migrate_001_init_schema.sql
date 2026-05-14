-- ALEJANDRA AGENTE — D1 Schema initialization
CREATE TABLE IF NOT EXISTS alejandra_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  modo TEXT DEFAULT 'autonomo',
  auto_fix INTEGER DEFAULT 1,
  max_iterations INTEGER DEFAULT 15,
  updated_at TEXT,
  UNIQUE(id)
);

CREATE TABLE IF NOT EXISTS alejandra_tokens (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  tipo TEXT DEFAULT 'admin',
  descripcion TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS alejandra_logs (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT,
  empresa_id TEXT,
  accion TEXT,
  parametros TEXT,
  resultado TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_alejandra (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  empresa_id TEXT,
  mensaje TEXT NOT NULL,
  respuesta TEXT,
  canal TEXT DEFAULT 'web',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS alejandra_memoria (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT,
  empresa_id TEXT,
  tipo TEXT,
  titulo TEXT NOT NULL,
  contenido TEXT,
  importancia INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS alejandra_alert_cache (
  id INTEGER PRIMARY KEY,
  watcher TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  severidad TEXT,
  processed_at TEXT,
  UNIQUE(watcher, alert_key)
);

INSERT OR IGNORE INTO alejandra_config (id, modo, auto_fix, max_iterations, updated_at)
VALUES (1, 'autonomo', 1, 15, datetime('now'));

INSERT OR IGNORE INTO alejandra_tokens (token, tipo, descripcion, activo, created_at)
VALUES ('admin_inicial_setup_alejandra_2026', 'admin', 'Token inicial para panel admin', 1, datetime('now'));
