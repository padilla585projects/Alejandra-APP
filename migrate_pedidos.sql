-- Migración #15: Módulo de Pedidos
-- ⚠️ Ejecutar en D1 nueva (alejandra-db) ANTES del deploy del worker
-- Todos los roles (incluido operario) pueden crear y actualizar pedidos
-- Solo encargado/admin pueden borrar pedidos
-- Comando:
-- curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/d65ead2b2967bf68ff3848a36cd7b1b4/d1/database/0c9eccde-78f1-476d-ac68-bf452bec0c62/query" \
--   -H "Authorization: Bearer <TOKEN_D1_NUEVO>" \
--   -H "Content-Type: application/json" \
--   -d "{\"sql\":\"CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, empresa_id INTEGER DEFAULT 1, obra_id INTEGER, departamento TEXT DEFAULT 'electrico', referencia TEXT, descripcion TEXT NOT NULL, cantidad REAL DEFAULT 1, unidad TEXT DEFAULT 'ud', proveedor TEXT, estado TEXT DEFAULT 'pendiente', solicitado_por TEXT, notas TEXT, fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP, fecha_recepcion TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\"}"

CREATE TABLE IF NOT EXISTS pedidos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id      INTEGER DEFAULT 1,
  obra_id         INTEGER,
  departamento    TEXT DEFAULT 'electrico',
  referencia      TEXT,
  descripcion     TEXT NOT NULL,
  cantidad        REAL DEFAULT 1,
  unidad          TEXT DEFAULT 'ud',
  proveedor       TEXT,
  estado          TEXT DEFAULT 'pendiente',
  solicitado_por  TEXT,
  notas           TEXT,
  fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP,
  fecha_recepcion TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
