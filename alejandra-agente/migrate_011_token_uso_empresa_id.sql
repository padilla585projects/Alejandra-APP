-- F-4.1.1: Añadir empresa_id a alejandra_token_uso para costes por empresa
-- La tabla fue creada sin empresa_id, lo que hacía imposible desglosar costes por tenant.

ALTER TABLE alejandra_token_uso ADD COLUMN empresa_id TEXT;
CREATE INDEX IF NOT EXISTS idx_token_uso_empresa ON alejandra_token_uso(empresa_id);
