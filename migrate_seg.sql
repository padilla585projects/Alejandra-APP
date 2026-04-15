CREATE TABLE IF NOT EXISTS tipos_material_seg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'individual',
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO tipos_material_seg (nombre, tipo) VALUES
  ('Arnés','individual'),
  ('Retráctil','individual'),
  ('Eslinga','individual'),
  ('Valla','cantidad'),
  ('Cono','cantidad'),
  ('Señal','cantidad'),
  ('Baliza','cantidad');

CREATE TABLE IF NOT EXISTS inventario_seg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_material TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'individual',
  codigo TEXT,
  nombre TEXT,
  cantidad_total INTEGER DEFAULT 1,
  cantidad_disponible INTEGER DEFAULT 1,
  estado TEXT DEFAULT 'disponible',
  fecha_entrada TEXT,
  fecha_caducidad TEXT,
  destino_actual TEXT,
  notas TEXT,
  registrado_por TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_seg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  accion TEXT NOT NULL,
  cantidad INTEGER DEFAULT 1,
  destino TEXT,
  usuario TEXT,
  notas TEXT,
  fecha TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
