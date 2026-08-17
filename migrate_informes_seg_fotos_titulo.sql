-- INFORMES-SEG-FOTO-TITULO-01 (17/08/2026): Adrian -- "cuando se anadan fotos al informe
-- diario se tiene que poder anadir un titulo a la foto para que luego en el informe salga
-- a pie de foto". Columna aditiva, nullable -- las fotos ya subidas se quedan sin titulo.

ALTER TABLE informes_seg_fotos ADD COLUMN titulo TEXT;
