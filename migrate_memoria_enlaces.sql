-- Memoria enlazada estilo Obsidian (Parte 1 del plan "Cerebro de Alejandra:
-- memoria enlazada + control de flujo + prompts", 25/08/2026, aprobado y
-- autorizado por Adrian para aplicar contra D1 el mismo dia).
--
-- CORRECCION DE DISEÑO respecto al plan original: el plan asumia que
-- memory_save/memory_read escriben en `memoria_gobernada`. Verificado contra
-- el codigo real de los DOS workers (worker.js raiz y alejandra-agente/
-- worker.js): memory_save/memory_read siempre han escrito y leido
-- `alejandra_memoria` (la tabla "legada"). `memoria_gobernada` es una tabla
-- aparte, ya migrada (migrate_memoria_gobernada.sql, aplicada 2026-08-02) pero
-- SIN ningun INSERT en todo el repo -- solo se listan/confirman/rechazan
-- candidatas que nunca llegan a crearse, y esta vacia en produccion (0 filas
-- verificado antes de aplicar esta migracion). Enlazar una tabla vacia sin
-- flujo de escritura no aporta nada hoy; se enlaza `alejandra_memoria`, que es
-- la memoria que Alejandra usa de verdad en cada conversacion real.
--
-- Aditiva, sin tocar ninguna fila existente. slug es opcional (NULL
-- permitido y sin colision entre NULLs en el UNIQUE INDEX, comportamiento
-- estandar de SQLite) -- se rellena solo cuando memory_save lo recibe o lo
-- genera a partir del titulo.

ALTER TABLE alejandra_memoria ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_alejandra_memoria_slug ON alejandra_memoria(empresa_id, slug);

CREATE TABLE IF NOT EXISTS memoria_enlaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origen_id   INTEGER NOT NULL REFERENCES alejandra_memoria(id),
  destino_id  INTEGER NOT NULL REFERENCES alejandra_memoria(id),
  tipo_enlace TEXT DEFAULT 'relacionado',  -- 'relacionado' | 'parte_de' | 'corrige'
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enlaces_origen  ON memoria_enlaces(origen_id);
CREATE INDEX IF NOT EXISTS idx_enlaces_destino ON memoria_enlaces(destino_id);  -- backlinks
