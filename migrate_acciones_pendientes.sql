-- Migración: Acciones N2 pendientes de revisión humana asíncrona (ADR-0023)
-- Fecha: 2026-09-03
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_acciones_pendientes.sql --remote
-- NOTA: requiere aprobación humana explícita antes de ejecutar contra D1 remoto
--       (CLAUDE.md, ADR-0007; ADR-0023 decisión 5 del Director).
--
-- Cola persistente donde una tool N2 del piloto (enviar_gmail / programar_correo,
-- alejandra-agente) guarda la acción EXACTA que quiere ejecutar en vez de ejecutarla, hasta
-- que un humano la apruebe por cualquiera de los tres canales equivalentes (frase de chat
-- "CONFIRMO ENVIO <código>", botón de Telegram, pestaña del panel). El ejecutor único es el
-- cron */5 de alejandra-agente (ejecutarAccionesAprobadas). Tabla nueva, aditiva, no toca
-- ninguna tabla existente.
--
-- Transiciones (siempre con WHERE estado='<origen>' para que un doble clic o dos canales a
-- la vez no ejecuten dos veces):
--   pendiente -> aprobada | rechazada | caducada
--   aprobada  -> ejecutada | error

CREATE TABLE IF NOT EXISTS acciones_pendientes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL,
  empresa_id     INTEGER,
  worker         TEXT NOT NULL DEFAULT 'agente' CHECK(worker IN ('agente','api')),
  tool           TEXT NOT NULL,
  input          TEXT NOT NULL,          -- JSON con los argumentos exactos; nunca se re-derivan del modelo
  resumen        TEXT NOT NULL,          -- texto para el humano ("Enviar a X, asunto Y")
  codigo         TEXT NOT NULL,          -- hex6, el mismo hash que la frase de chat (codigoConfirmacionOp)
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK(estado IN ('pendiente','aprobada','rechazada','caducada','ejecutada','error')),
  solicitado_at  TEXT DEFAULT (datetime('now')),
  caduca_at      TEXT NOT NULL,          -- UTC 'YYYY-MM-DD HH:MM:SS'; lo que pasa de aquí se anula, nunca se ejecuta
  decidido_at    TEXT,
  decidido_por   TEXT,                   -- usuario_id (chat/panel) o telegram from.id (telegram)
  canal_decision TEXT CHECK(canal_decision IS NULL OR canal_decision IN ('chat','telegram','panel')),
  ejecutado_at   TEXT,
  resultado      TEXT,
  error_msg      TEXT,
  traza_id       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_acciones_pend_estado  ON acciones_pendientes(estado, caduca_at);
CREATE INDEX IF NOT EXISTS idx_acciones_pend_usuario ON acciones_pendientes(usuario_id, estado);
