-- Modulo de racks/cableado para el departamento de telecomunicaciones.
-- Jerarquia: obra -> IDF (por planta/ubicacion) -> rack -> patch panel -> puerto.
CREATE TABLE IF NOT EXISTS telecom_idf (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  notas TEXT,
  creado_por TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telecom_idf_obra ON telecom_idf(obra_id, empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_telecom_idf_nombre
  ON telecom_idf(empresa_id, obra_id, nombre COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS telecom_racks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idf_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telecom_racks_idf ON telecom_racks(idf_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_telecom_racks_nombre
  ON telecom_racks(empresa_id, idf_id, nombre COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS telecom_patch_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rack_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  num_puertos INTEGER NOT NULL DEFAULT 24,
  red_vlan TEXT,
  switch_asociado TEXT,
  subred TEXT,
  posicion_u TEXT,
  notas_config TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telecom_pp_rack ON telecom_patch_panels(rack_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_telecom_pp_nombre
  ON telecom_patch_panels(empresa_id, rack_id, nombre COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS telecom_puertos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patch_panel_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  estado TEXT DEFAULT 'libre',
  destino TEXT,
  cable_label TEXT,
  categoria TEXT,
  notas TEXT,
  actualizado_por TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patch_panel_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_telecom_puertos_pp ON telecom_puertos(patch_panel_id);
