-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 003: Corregir schema y token de acceso
-- Corrige la sintaxis INDEX inline (inválida en SQLite/D1)
-- ══════════════════════════════════════════════════════════════════════════════

-- Logs de acciones (auditoría) — sintaxis correcta para D1
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
CREATE INDEX IF NOT EXISTS idx_logs_usuario_empresa ON alejandra_logs(usuario_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON alejandra_logs(created_at DESC);

-- Historial de chat — sintaxis correcta para D1
CREATE TABLE IF NOT EXISTS chat_alejandra (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  empresa_id TEXT,
  mensaje TEXT NOT NULL,
  respuesta TEXT,
  canal TEXT DEFAULT 'web',
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_usuario_empresa ON chat_alejandra(usuario_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_alejandra(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_canal ON chat_alejandra(canal);

-- Memoria — sintaxis correcta para D1
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
CREATE INDEX IF NOT EXISTS idx_memoria_tipo ON alejandra_memoria(tipo);
CREATE INDEX IF NOT EXISTS idx_memoria_importancia ON alejandra_memoria(importancia DESC, created_at DESC);

-- Tabla de tokens (asegurar existe)
CREATE TABLE IF NOT EXISTS alejandra_tokens (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  tipo TEXT DEFAULT 'admin',
  descripcion TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT,
  expires_at TEXT
);

-- Config inicial (asegurar existe)
CREATE TABLE IF NOT EXISTS alejandra_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  modo TEXT DEFAULT 'autonomo',
  auto_fix INTEGER DEFAULT 1,
  max_iterations INTEGER DEFAULT 15,
  updated_at TEXT,
  UNIQUE(id)
);

-- Alert cache
CREATE TABLE IF NOT EXISTS alejandra_alert_cache (
  id INTEGER PRIMARY KEY,
  watcher TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  severidad TEXT,
  processed_at TEXT,
  UNIQUE(watcher, alert_key)
);

-- Token de uso (v5.92)
CREATE TABLE IF NOT EXISTS alejandra_token_uso (
  id INTEGER PRIMARY KEY,
  proveedor TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tipo TEXT,
  tokens_entrada INTEGER DEFAULT 0,
  tokens_salida INTEGER DEFAULT 0,
  coste_usd REAL DEFAULT 0,
  usuario_id TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_token_uso_created ON alejandra_token_uso(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_uso_proveedor ON alejandra_token_uso(proveedor, modelo);

-- Configuración inicial
INSERT OR IGNORE INTO alejandra_config (id, modo, auto_fix, max_iterations, updated_at)
VALUES (1, 'autonomo', 1, 15, datetime('now'));

-- Token de acceso al panel (renovado)
INSERT OR REPLACE INTO alejandra_tokens (token, tipo, descripcion, activo, created_at)
VALUES ('alejandra2026', 'admin', 'Token panel admin v5.93', 1, datetime('now'));
