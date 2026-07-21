-- DEPT-01 (21/07/2026) — Aislamiento de datos por departamento
-- Añade la columna `departamento` a las tablas que antes no la tenían y que
-- ahora necesitan filtrado por departamento (construcción no debe ver lo de
-- eléctrico ni mecánicas y viceversa; Seguridad ve todo por su función
-- transversal de seguridad de obra).
--
-- El resto de tablas del Grupo A (tareas_obra, rfis, control_calidad,
-- punch_list, actas_reunion) ya se autogestionan la columna vía su función
-- ensureXTable(env) en worker.js (ALTER TABLE ... ADD COLUMN envuelto en
-- .catch(()=>{})), así que no necesitan entrada aquí.
--
-- Estas dos tablas NO tienen ensureXTable(), así que la migración se aplicó
-- una sola vez a mano contra producción (ejecutado 21/07/2026 vía MCP D1).
-- Este archivo queda como registro histórico, por convención del proyecto
-- (ver otros migrate_*.sql).

ALTER TABLE documentos_obra ADD COLUMN departamento TEXT;
ALTER TABLE inspecciones_seg ADD COLUMN departamento TEXT;
