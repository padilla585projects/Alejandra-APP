-- Registro de uso de tokens por llamada API (Anthropic + OpenAI)
CREATE TABLE IF NOT EXISTS alejandra_token_uso (
  id               INTEGER PRIMARY KEY,
  proveedor        TEXT NOT NULL,          -- 'anthropic', 'openai'
  modelo           TEXT NOT NULL,
  tipo             TEXT,                   -- 'clasificacion', 'chat', 'reflexion', 'web_search'
  tokens_entrada   INTEGER DEFAULT 0,
  tokens_salida    INTEGER DEFAULT 0,
  coste_usd        REAL    DEFAULT 0,
  usuario_id       TEXT,
  created_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_token_uso_created   ON alejandra_token_uso(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_uso_proveedor ON alejandra_token_uso(proveedor, modelo);
