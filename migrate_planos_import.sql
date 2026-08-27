-- CAD-IMPORTAR-01 (26/08/2026), Parte 3 del plan de compatibilidad CAD.
-- Adrián autorizó explícitamente esta migración ("dale") tras verificar en producción
-- que la Parte 2 (importar DXF, vía columna "metadatos" JSON) funcionaba correctamente.
-- Columnas dedicadas para distinguir origen y guardar la key del archivo original + una
-- capa de anotaciones aparte (sin tocar nunca el SVG importado). Ver el plan completo en
-- C:\Users\Adrian\.claude\plans\radiant-moseying-diffie.md.

ALTER TABLE planos ADD COLUMN origen TEXT NOT NULL DEFAULT 'generado' CHECK(origen IN ('generado','importado'));
ALTER TABLE planos ADD COLUMN archivo_original_key TEXT;
ALTER TABLE planos ADD COLUMN anotaciones_svg TEXT;
