-- F-4.1.3: Añadir trace_id a alejandra_trazas para correlación de requests
-- Permite agrupar todas las trazas de una misma operación de chat.

ALTER TABLE alejandra_trazas ADD COLUMN trace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_trazas_trace ON alejandra_trazas(trace_id);
