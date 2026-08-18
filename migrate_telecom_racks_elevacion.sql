-- TELECOM-ELEVACION-01 (18/08/2026): Adrian -- "lo quiero hacer mas visual todo"
-- (IDF/racks/paneles). Diagrama de elevacion de rack con arrastrar-y-soltar: cada
-- modulo se coloca en su posicion U real dentro del armario.
--
-- Columnas aditivas, nullable/con DEFAULT -- los racks y modulos ya existentes quedan
-- con altura_u=42 (estandar de suelo) y pos_u_inicio=NULL (sin colocar en el diagrama
-- todavia, aparecen en la lista "Sin colocar" hasta que se arrastren a su sitio).

ALTER TABLE telecom_racks ADD COLUMN altura_u INTEGER NOT NULL DEFAULT 42;
ALTER TABLE telecom_patch_panels ADD COLUMN pos_u_inicio INTEGER;
ALTER TABLE telecom_patch_panels ADD COLUMN pos_u_altura INTEGER NOT NULL DEFAULT 1;
