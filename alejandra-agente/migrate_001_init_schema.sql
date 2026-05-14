-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — D1 Schema initialization
-- Tables: alejandra_config, alejandra_tokens, alejandra_logs, chat_alejandra
-- ══════════════════════════════════════════════════════════════════════════════

-- Configuración de autonomía (modo, auto_fix, max_iterations)
CREATE TABLE IF NOT EXISTS alejandra_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  modo TEXT DEFAULT 'autonomo', -- 'autonomo' o 'confirmacion'
  auto_fix INTEGER DEFAULT 1,   -- 1 = can do direct_fix without asking
  max_iterations INTEGER DEFAULT 15,
  updated_at TEXT,
  UNIQUE(id)
);

-- Tokens administrativos para panel web
CREATE TABLE IF NOT EXISTS alejandra_tokens (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  tipo TEXT DEFAULT 'admin', -- 'admin', 'integración'
  descripcion TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT,
  expires_at TEXT
);

-- Logs de acciones (auditoría)
CREATE TABLE IF NOT EXISTS alejandra_logs (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT,
  empresa_id TEXT,
  accion TEXT,
  parametros TEXT,
  resultado TEXT,
  status TEXT, -- 'ok', 'error', 'pending'
  created_at TEXT,
  INDEX idx_usuario_empresa (usuario_id, empresa_id),
  INDEX idx_created_at (created_at DESC)
);

-- Historial de chat (memoria conversacional)
CREATE TABLE IF NOT EXISTS chat_alejandra (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  empresa_id TEXT,
  mensaje TEXT NOT NULL,
  respuesta TEXT,
  canal TEXT DEFAULT 'web', -- 'web', 'telegram', 'app'
  created_at TEXT,
  INDEX idx_usuario_empresa_chat (usuario_id, empresa_id),
  INDEX idx_created_at_chat (created_at DESC),
  INDEX idx_canal (canal)
);

-- Memoria de Alejandra (aprendizajes, contexto, errores)
-- Reutiliza schema del worker principal
CREATE TABLE IF NOT EXISTS alejandra_memoria (
  id INTEGER PRIMARY KEY,
  usuario_id TEXT,
  empresa_id TEXT,
  tipo TEXT, -- 'hecho', 'pendiente', 'contexto', 'aviso', 'aprendizaje', 'error'
  titulo TEXT NOT NULL,
  contenido TEXT,
  importancia INTEGER DEFAULT 1, -- 1=baja, 2=media, 3=alta
  created_at TEXT,
  INDEX idx_tipo (tipo),
  INDEX idx_importancia_created (importancia DESC, created_at DESC)
);

-- Alerta caché con TTL por severidad
CREATE TABLE IF NOT EXISTS alejandra_alert_cache (
  id INTEGER PRIMARY KEY,
  watcher TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  severidad TEXT, -- 'CRITICAL', 'HIGH', 'MEDIUM'
  processed_at TEXT,
  UNIQUE(watcher, alert_key)
);

-- Insertar configuración inicial
INSERT OR IGNORE INTO alejandra_config (id, modo, auto_fix, max_iterations, updated_at)
VALUES (1, 'autonomo', 1, 15, datetime('now'));

-- Crear primer token admin (UUID hardcoded para setup inicial)
INSERT OR IGNORE INTO alejandra_tokens (token, tipo, descripcion, activo, created_at)
VALUES ('admin_inicial_setup_alejandra_2026', 'admin', 'Token inicial para panel admin', 1, datetime('now'));
