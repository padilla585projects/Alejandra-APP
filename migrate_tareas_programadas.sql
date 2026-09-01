-- Migración: Tareas programadas (TAREAS-PROGRAMADAS-01)
-- Fecha: 2026-09-01
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_tareas_programadas.sql --remote
-- NOTA: requiere aprobación humana antes de ejecutar contra D1 remoto (CLAUDE.md).
--
-- Adrián pidió poder pedirle a Alejandra que programe acciones futuras ("mándale un
-- correo a X a las 17:00", "avísame a las 17:00 para Y"). Tabla nueva, aditiva, no toca
-- ninguna tabla existente.

CREATE TABLE IF NOT EXISTS tareas_programadas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id             INTEGER NOT NULL,
  empresa_id             INTEGER,
  tipo                   TEXT NOT NULL CHECK(tipo IN ('email_gmail','recordatorio')),
  fecha_hora_programada  TEXT NOT NULL, -- UTC, 'YYYY-MM-DD HH:MM:SS'
  estado                 TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviada','cancelada','error')),
  payload                TEXT NOT NULL, -- JSON: {para,asunto,cuerpo} | {titulo,mensaje}
  error_msg              TEXT,
  creado_at              TEXT DEFAULT (datetime('now')),
  ejecutado_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_tareas_programadas_pendientes ON tareas_programadas(estado, fecha_hora_programada);
CREATE INDEX IF NOT EXISTS idx_tareas_programadas_usuario ON tareas_programadas(usuario_id);
