-- TELECOM-ELEVACION-01 (18/08/2026), continuación: Adrián -- "tambien da la opcion de
-- rear rack de pared o de pie". Dos tipos de armario, cada uno con su propia altura por
-- defecto (pared=12U, pie=42U) y su propio dibujo en el diagrama de elevación.
--
-- Columna aditiva, NOT NULL con DEFAULT -- los racks ya creados quedan como 'pie' (el
-- comportamiento que ya tenían: altura_u=42, dibujado de pie sobre el suelo).

ALTER TABLE telecom_racks ADD COLUMN tipo TEXT NOT NULL DEFAULT 'pie';
