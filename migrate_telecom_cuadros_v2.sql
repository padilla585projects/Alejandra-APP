-- TELECOM-CUADRO-02 (18/08/2026): Adrian -- "se nos olvido el otro modelo que teniamos...
-- cuadro exterior donde podiamos elegir un switch gestionado" -- "que los metemos en un
-- cuadro electrico adaptado para ello y se cuelga en el exterior (en una farola por
-- ejemplo)" -- "al igual que los IDF podriamos tener un cuadro de plastico exterior
-- dibujado donde meteriamos cosas, por ejemplo el switch, fuente alimentacion, fuente POE
-- para camara si necesitara, un hub de fibra tambien etc".
--
-- El cuadro de campo deja de ser "un switch con marca/modelo/num_puertos" y pasa a ser una
-- caja (IP65, colgada de una farola/pared) que contiene componentes sueltos montados en un
-- carril DIN: switch gestionado, fuente de alimentacion, inyector POE, hub de fibra,
-- personalizado -- mismo patron de paleta arrastrable que los racks (marcas conocidas +
-- personalizado en blanco).
--
-- Adrian tambien aclaro la conexion real: "ese switch va a un IDF pero con fibra claro" /
-- "asique en el IDF se conectaria al panel de fibra" / "que tambien tendriamos que
-- seleccionar las bocas para decir que ahi conectado" -- el cuadro sube por fibra a un
-- PUERTO REAL de un panel de fibra dentro de un IDF concreto (antes solo apuntaba a "el
-- IDF" en abstracto via idf_destino_id).
--
-- Verificado antes de migrar (solo lectura, autorizado): telecom_cuadros_campo y
-- telecom_cuadros_campo_puertos tienen 0 filas en produccion -- no hace falta migrar datos
-- existentes. Las columnas marca/modelo/num_puertos de telecom_cuadros_campo se dejan sin
-- usar en vez de borrarlas (no hay DROP en esta migracion).

ALTER TABLE telecom_cuadros_campo ADD COLUMN puerto_conexion_id INTEGER;

CREATE TABLE telecom_cuadro_componentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuadro_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'switch',   -- switch | fuente | poe | fibra | otro
  marca TEXT,
  num_puertos INTEGER,                    -- solo switch/fibra -- fuente/poe no tienen puertos gestionados
  pos_orden REAL NOT NULL DEFAULT 0,      -- orden horizontal en el carril DIN (indexado por fracciones, sin reindexar al reordenar)
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telecom_cuadro_componente_puertos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  componente_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'libre',
  destino TEXT,
  cable_label TEXT,
  categoria TEXT,
  notas TEXT,
  actualizado_por INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
