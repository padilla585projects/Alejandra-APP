-- ARC-012 — empresas.retencion_config
--
-- worker.js:13703 intenta crear esta columna con .catch(() => {}). La
-- verificacion del esquema real del 2026-08-02 demostro que no existe, por lo
-- que la politica de retencion de datos no se puede configurar (worker.js:13705)
-- ni se aplica (worker.js:12216, 13676, 13721). Tiene implicacion RGPD.
--
-- Riesgo: bajo. ADD COLUMN es aditivo y no altera ninguna fila existente. Las
-- empresas existentes quedan con retencion_config NULL, que el codigo ya trata
-- como "sin configurar" (worker.js:13722).
-- No idempotente: SQLite no admite ADD COLUMN IF NOT EXISTS.
-- Rollback: dejar la columna sin uso; no eliminarla.

ALTER TABLE empresas ADD COLUMN retencion_config TEXT;
