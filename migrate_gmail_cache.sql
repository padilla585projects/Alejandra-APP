-- CORREOS-PANEL-01 (17/08/2026): panel de correos por usuario (Alejandra Office).
-- Autorizado explicitamente por Adrian. Aditivo, no toca ninguna tabla existente.

CREATE TABLE gmail_mensajes_cache (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL,
  gmail_id      TEXT NOT NULL,
  de            TEXT,
  asunto        TEXT,
  fecha         TEXT,
  resumen       TEXT,
  leido_app     INTEGER NOT NULL DEFAULT 0,
  categoria_app TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(usuario_id, gmail_id)
);

CREATE INDEX idx_gmail_cache_usuario ON gmail_mensajes_cache (usuario_id, fecha DESC);
