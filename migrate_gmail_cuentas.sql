-- CORREOS-PANEL-01-v4 (17/08/2026): Adrian -- "tener dos cuentas a la vez e ir cambiando
-- una a otra rapido". gmail_oauth_tokens tiene usuario_id como PRIMARY KEY -- no admite
-- dos cuentas por usuario. Se crea gmail_cuentas (varias filas por usuario_id, con un flag
-- "activa") y se migra la cuenta ya conectada. gmail_oauth_tokens se queda sin usar, no se
-- borra (autorizado explicitamente no borrar nada existente).

CREATE TABLE gmail_cuentas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id             INTEGER NOT NULL,
  empresa_id             INTEGER,
  email_conectado        TEXT,
  refresh_token_cifrado  TEXT,
  iv                     TEXT,
  scope                  TEXT,
  activa                 INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(usuario_id, email_conectado)
);

CREATE INDEX idx_gmail_cuentas_usuario ON gmail_cuentas (usuario_id);

INSERT INTO gmail_cuentas (usuario_id, empresa_id, email_conectado, refresh_token_cifrado, iv, scope, activa, created_at, updated_at)
  SELECT usuario_id, empresa_id, email_conectado, refresh_token_cifrado, iv, scope, 1, created_at, updated_at FROM gmail_oauth_tokens;

ALTER TABLE gmail_mensajes_cache ADD COLUMN cuenta_id INTEGER;

UPDATE gmail_mensajes_cache SET cuenta_id = (
  SELECT id FROM gmail_cuentas WHERE gmail_cuentas.usuario_id = gmail_mensajes_cache.usuario_id AND activa = 1 LIMIT 1
);
