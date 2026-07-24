-- ROLES-02: asignación adicional de obras para Project Manager y Jefe de obra.
-- No sustituye usuarios.obra_id: esa columna sigue siendo la obra principal
-- y mantiene la compatibilidad de Encargados y Oficiales existentes.
CREATE TABLE IF NOT EXISTS usuario_obras (
  usuario_id INTEGER NOT NULL,
  obra_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  asignado_por INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, obra_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_obras_usuario ON usuario_obras(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_obras_obra ON usuario_obras(obra_id);
