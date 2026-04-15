-- ============================================================
-- ALEJANDRA APP — Schema completo v3.11
-- ============================================================

-- Obras
CREATE TABLE IF NOT EXISTS obras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  activa INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bobinas
CREATE TABLE IF NOT EXISTS bobinas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT,
  seccion TEXT,
  longitud REAL,
  proveedor TEXT,
  num_albaran TEXT,
  estado TEXT DEFAULT 'disponible',
  obra_id INTEGER,
  obra_nombre TEXT,
  departamento TEXT DEFAULT 'electrico',
  fecha_entrada TEXT,
  fecha_devolucion TEXT,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PEMP
CREATE TABLE IF NOT EXISTS pemp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula TEXT NOT NULL UNIQUE,
  tipo TEXT,
  marca TEXT,
  proveedor TEXT,
  energia TEXT,
  estado TEXT DEFAULT 'disponible',
  obra_id INTEGER,
  obra_nombre TEXT,
  departamento TEXT DEFAULT 'electrico',
  fecha_entrada TEXT,
  fecha_devolucion TEXT,
  fecha_revision TEXT,
  fecha_proxima_revision TEXT,
  fecha_averia TEXT,
  fecha_reparacion TEXT,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carretillas
CREATE TABLE IF NOT EXISTS carretillas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricula TEXT NOT NULL UNIQUE,
  tipo TEXT,
  marca TEXT,
  proveedor TEXT,
  energia TEXT,
  estado TEXT DEFAULT 'disponible',
  obra_id INTEGER,
  obra_nombre TEXT,
  departamento TEXT DEFAULT 'electrico',
  fecha_entrada TEXT,
  fecha_devolucion TEXT,
  fecha_revision TEXT,
  fecha_proxima_revision TEXT,
  fecha_averia TEXT,
  fecha_reparacion TEXT,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial bobinas
CREATE TABLE IF NOT EXISTS historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bobina_id INTEGER,
  bobina_codigo TEXT,
  accion TEXT,
  obra_id INTEGER,
  obra_nombre TEXT,
  usuario TEXT,
  notas TEXT,
  fecha TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial PEMP
CREATE TABLE IF NOT EXISTS historial_pemp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemp_id INTEGER,
  matricula TEXT,
  accion TEXT,
  obra_id INTEGER,
  obra_nombre TEXT,
  usuario TEXT,
  notas TEXT,
  destino TEXT,
  fecha TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial carretillas
CREATE TABLE IF NOT EXISTS historial_carretillas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carretilla_id INTEGER,
  matricula TEXT,
  accion TEXT,
  obra_id INTEGER,
  obra_nombre TEXT,
  usuario TEXT,
  notas TEXT,
  destino TEXT,
  fecha TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'operario',
  obra_id INTEGER,
  obra_nombre TEXT,
  departamento TEXT DEFAULT 'electrico',
  activo INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones (tokens)
CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  usuario_id INTEGER,
  nombre TEXT NOT NULL DEFAULT 'Usuario',
  rol TEXT NOT NULL DEFAULT 'operario',
  obra_id INTEGER,
  obra_nombre TEXT,
  departamento TEXT DEFAULT 'electrico',
  es_admin INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogos
CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipos_cable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipos_pemp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipos_carretilla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS energias_carretilla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

-- Sugerencias
CREATE TABLE IF NOT EXISTS sugerencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  texto TEXT NOT NULL,
  categoria TEXT DEFAULT 'general',
  usuario TEXT,
  obra TEXT,
  leida INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT,
  mensaje TEXT,
  usuario TEXT,
  obra TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventario seguridad
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
