-- Migración: multi-rol por usuario
-- Ejecutar UNA sola vez en D1 (alejandra-db)

ALTER TABLE usuarios ADD COLUMN roles_extra TEXT DEFAULT NULL;
