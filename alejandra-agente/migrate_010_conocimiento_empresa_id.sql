-- SEC-KNOWLEDGE-01: Añadir empresa_id a alejandra_conocimiento para aislamiento cross-tenant
-- La tabla fue creada sin empresa_id, lo que permitía que todo el conocimiento fuera
-- visible por todas las empresas. Este fix añade la columna y migra los datos existentes.

-- 1. Añadir columna empresa_id (nullable para backward compatibility)
ALTER TABLE alejandra_conocimiento ADD COLUMN empresa_id TEXT;

-- 2. Crear índice para búsquedas por empresa
CREATE INDEX IF NOT EXISTS idx_conocimiento_empresa ON alejandra_conocimiento(empresa_id);

-- 3. Los datos existentes quedan con empresa_id=NULL (visibles por todas las empresas
-- como fallback). El código maneja NULL como "conocimiento global".
