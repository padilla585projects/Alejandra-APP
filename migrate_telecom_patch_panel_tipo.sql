-- Migración: tipo y marca de módulo en patch panels de Telecom
-- Fecha: 2026-08-12
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_telecom_patch_panel_tipo.sql
-- NOTA: requiere aprobación humana antes de ejecutar contra D1 remoto (CLAUDE.md).

ALTER TABLE telecom_patch_panels ADD COLUMN tipo  TEXT DEFAULT 'cobre';
ALTER TABLE telecom_patch_panels ADD COLUMN marca TEXT;
