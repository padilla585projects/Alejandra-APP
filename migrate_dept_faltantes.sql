-- Aislamiento por departamento (DEPT-01) -- correccion de un fallo propio (10/08/2026)
--
-- Las migraciones migrate_dept_ingenieria.sql, migrate_dept_documental.sql,
-- migrate_dept_cambios_calidad.sql y migrate_dept_compras_material.sql
-- declararon 12 tablas como "CREATE TABLE IF NOT EXISTS ... departamento TEXT"
-- asumiendo que nunca se habian creado. Verificacion posterior contra D1 real
-- (solo lectura, SELECT name FROM sqlite_master) confirmo que las 12 YA
-- EXISTIAN en produccion, creadas por el DDL en runtime del propio worker.js
-- (mismo patron ARC-011: existen porque el codigo las crea la primera vez que
-- se usa el endpoint, no porque ninguna migracion las declarase). Al ya
-- existir, el CREATE TABLE IF NOT EXISTS fue un no-op silencioso para las 12
-- -- ninguna recibio la columna `departamento`.
--
-- Verificado tras aplicar las 4 migraciones originales (10/08/2026):
--   PRAGMA table_info -- las 12 sin columna departamento.
--   sqlite_master -- las 12 SI existen en produccion.
--
-- Correccion: ALTER TABLE ADD COLUMN para las 12, mismo patron que las 7
-- tablas que ya se sabia que existian (fases_obra, plan_semanal,
-- contactos_obra, ordenes_cambio, ordenes_compra, checklist_plantillas,
-- checklist_ejecuciones).
--
-- Riesgo: bajo. ALTER TABLE ADD COLUMN (nullable) es aditivo, sin tocar
-- ninguna fila existente.

ALTER TABLE hitos_obra ADD COLUMN departamento TEXT;
ALTER TABLE instrucciones_obra ADD COLUMN departamento TEXT;
ALTER TABLE visitas_obra ADD COLUMN departamento TEXT;
ALTER TABLE itp_obra ADD COLUMN departamento TEXT;
ALTER TABLE contratos_obra ADD COLUMN departamento TEXT;
ALTER TABLE submittals ADD COLUMN departamento TEXT;
ALTER TABLE transmittals_obra ADD COLUMN departamento TEXT;
ALTER TABLE ncrs_obra ADD COLUMN departamento TEXT;
ALTER TABLE riesgos_obra ADD COLUMN departamento TEXT;
ALTER TABLE entregas_material ADD COLUMN departamento TEXT;
ALTER TABLE consumos_material ADD COLUMN departamento TEXT;
ALTER TABLE solicitudes_material ADD COLUMN departamento TEXT;
