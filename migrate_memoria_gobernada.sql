-- F-2.1 (Época 2) -- Memoria gobernada, contrato de ADR-0013 (ARC-002)
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: aplicarla
-- contra D1 exige autorizacion explicita del Director (CLAUDE.md, "Que
-- requiere decision humana" -- toda migracion D1 es irreversible sobre datos
-- reales). Ver migrate_manifiesto.json.
--
-- Tabla NUEVA, sin relacion con la tabla legada `alejandra_memoria`
-- (migrate_alejandra_memoria.sql, ya en produccion via memory_save/memory_read
-- de ambos Workers): esa tabla no tiene empresa_id, procedencia, confianza,
-- caducidad ni estado -- exactamente lo que ARC-002 senala como ausente y que
-- ADR-0013 exige. No se fusiona ni se migra su contenido aqui: eso es una
-- decision aparte (dominio ADR-0013, fuera de esta tarea) y las tools
-- memory_save/memory_read/memory_delete siguen excluidas del catalogo de
-- ADR-0010 por el mismo motivo (ver TASKS.md/HANDOFF.md).
--
-- Compartida por worker.js y alejandra-agente/worker.js (misma alejandra-db,
-- regla de "UNA Alejandra, DOS cerebros" de CLAUDE.md): cualquier lectura o
-- escritura real que se implemente despues debe decidir conscientemente si
-- aplica a los dos Workers, no solo a uno.
--
-- Ningun Worker escribe ni lee esta tabla todavia. `nucleo-cognitivo/src/
-- memory.js` sigue siendo interfaz pura (lanza error explicito) hasta que
-- esta migracion se aplique con autorizacion y ARC-008 permita trazabilidad
-- completa de una decision que consulte memoria (ADR-0013 §8).
--
-- Columnas <-> contrato de ADR-0013:
--   empresa_id, ambito, usuario_id      -> §2 (aislamiento por tenant y personal/compartida)
--   origen, tarea_id, metodo, categoria -> §1 (lista blanca) y §3 (procedencia)
--   confianza                           -> §4
--   caduca_en                           -> §5 (6 meses por defecto; 12 si metodo='procedimiento' aprobado)
--   version_anterior_id, estado         -> §6 (correccion versionada, nunca UPDATE destructivo)
--   aprobada_por                        -> §2 (aprobacion encargado+ para memoria compartida o candidata)
--
-- Nota: §6 describe un tercer valor de estado, 'sustituido', para la version
-- reemplazada por una correccion. `nucleo-cognitivo/src/memory.js`
-- (ESTADOS_VALIDOS) solo declara hoy 'candidata_pendiente_validacion' y
-- 'confirmada' porque son los dos unicos que consume el contrato de consulta
-- (§8); 'sustituido' vive a nivel de esquema para el historial de versiones
-- y no necesita aparecer en ESTADOS_VALIDOS mientras ningun codigo lo escriba
-- o lo consulte. Ampliar ESTADOS_VALIDOS es trabajo del paso de activacion,
-- no de esta declaracion de esquema.
--
-- Riesgo de aplicar (paso 2, futuro): bajo. CREATE TABLE/INDEX con
-- IF NOT EXISTS, aditivo, sin tocar ninguna fila existente de ninguna tabla.

CREATE TABLE IF NOT EXISTS memoria_gobernada (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id          TEXT NOT NULL,
  ambito              TEXT NOT NULL DEFAULT 'personal',  -- 'personal' | 'compartida' (§2)
  usuario_id          TEXT NOT NULL,                      -- quien declaro/posee el recuerdo
  categoria           TEXT NOT NULL,                      -- lista blanca §1: hechos_operativos | preferencias_trabajo | procedimientos_internos | correcciones
  contenido           TEXT NOT NULL,
  origen              TEXT NOT NULL,                      -- usuario_id concreto | 'system' | nombre de tool (§3)
  tarea_id            TEXT,                                -- tarea/conversacion de origen, si existe (§3)
  metodo              TEXT NOT NULL,                      -- 'declarado' | 'corregido' | 'procedimiento' | 'inferido' (§3)
  estado              TEXT NOT NULL DEFAULT 'candidata_pendiente_validacion', -- + 'confirmada' | 'sustituido' (§3/§6)
  confianza           TEXT NOT NULL,                      -- 'alta' | 'media' | 'baja' (§4)
  fecha_creacion      TEXT NOT NULL DEFAULT (datetime('now')),
  caduca_en           TEXT NOT NULL,                      -- nunca NULL por defecto (§5)
  version_anterior_id INTEGER REFERENCES memoria_gobernada(id), -- correccion versionada, no UPDATE destructivo (§6)
  aprobada_por        TEXT,                                -- usuario_id que aprobo compartida/candidata (§2/§3)
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memoria_gobernada_empresa ON memoria_gobernada(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_memoria_gobernada_caduca  ON memoria_gobernada(caduca_en);
