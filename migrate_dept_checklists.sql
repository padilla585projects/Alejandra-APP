-- Aislamiento por departamento (DEPT-01) -- auditoria de Alejandra Office (10/08/2026)
-- Grupo "Checklists": plantillas y ejecuciones de checklist de calidad.
--
-- Decision del Director (10/08/2026): checklists deben acotarse por
-- departamento, no ser transversales -- cada departamento gestiona sus
-- propios checklists de calidad.
--
-- Ambas tablas YA estan declaradas (migrate_checklists.sql, aplicada:true) --
-- se les anade la columna con ALTER, no se puede volver a declarar el CREATE.
--
-- Riesgo: bajo. ALTER TABLE ADD COLUMN (nullable) es aditivo, sin tocar
-- ninguna fila existente.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia.

ALTER TABLE checklist_plantillas ADD COLUMN departamento TEXT;
ALTER TABLE checklist_ejecuciones ADD COLUMN departamento TEXT;
