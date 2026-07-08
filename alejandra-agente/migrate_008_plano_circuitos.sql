-- Añade columna circuitos_json a planos: permite guardar la lista estructurada
-- de circuitos/automaticos de un esquema (unifilar/electrico) para poder
-- editarlos despues (tool editar_plano) sin regenerar el plano adivinando datos.
ALTER TABLE planos ADD COLUMN circuitos_json TEXT;
