-- ARC-012 — inventario_seg.ubicacion
--
-- El incidente SEG-01 (25/07/2026) se "arreglo" anadiendo esta columna con un
-- ALTER TABLE en tiempo de ejecucion dentro de un try/catch vacio
-- (worker.js:11433). La verificacion del esquema real del 2026-08-02 demostro
-- que la columna NUNCA llego a crearse: el fallo quedaba suprimido y el INSERT
-- de worker.js:11455 seguia rompiendose.
--
-- Riesgo: bajo. ADD COLUMN es aditivo y no altera ninguna fila existente.
-- No idempotente: SQLite no admite ADD COLUMN IF NOT EXISTS. Si se ejecuta dos
-- veces fallara con "duplicate column name", que es el comportamiento deseado.
-- Rollback: SQLite no permite DROP COLUMN de forma segura en esta version; la
-- mitigacion es dejar la columna sin uso, no eliminarla.

ALTER TABLE inventario_seg ADD COLUMN ubicacion TEXT;
