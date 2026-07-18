-- Migración: tabla chat_mensajes para chat del equipo privado por usuario
-- Fecha: 2026-07-18

CREATE TABLE IF NOT EXISTS chat_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  obra_id INTEGER,
  usuario_id INTEGER,
  usuario_nombre TEXT NOT NULL DEFAULT 'Usuario',
  rol TEXT DEFAULT '',
  mensaje TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (obra_id) REFERENCES obras(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_empresa_usuario ON chat_mensajes(empresa_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_chat_empresa_obra ON chat_mensajes(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_mensajes(created_at DESC);
