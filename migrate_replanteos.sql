-- Migración: Replanteo asistido por cámara (ADR-0024, fase 1: sobre foto)
-- Fecha: 2026-09-04
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_replanteos.sql --remote
-- NOTA: requiere aprobación humana explícita antes de ejecutar contra D1 remoto
--       (CLAUDE.md, ADR-0007). Tablas nuevas, aditivas, no tocan ninguna existente.
--       Hasta que se aplique, worker.js crea las tablas al primer uso (_ensureReplanteoTables,
--       mismo patrón que Sondas CPD) para no bloquear la funcionalidad.
--
-- replanteos: un recorrido marcado sobre una foto (fase 1) o capturado en AR (fase 2),
-- con su elemento (bandeja, tubo...), escala, obstáculos y la lista de material calculada
-- SIEMPRE por el servidor (calcularMaterialReplanteo). Un replanteo pertenece a una
-- empresa + obra + departamento (DEPT-01: el filtro va en el backend).
--
-- Estados: borrador -> calculado -> pedido (pedido_ids apunta a las filas de `pedidos`
-- creadas con referencia REPL-<id>).

CREATE TABLE IF NOT EXISTS replanteos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id      INTEGER NOT NULL,
  obra_id         INTEGER,
  departamento    TEXT    NOT NULL,
  titulo          TEXT    NOT NULL,
  elemento_key    TEXT    NOT NULL,          -- clave del catálogo (bandeja_rejilla, tubo_rigido...)
  elemento_json   TEXT,                      -- parámetros elegidos: {ancho_mm, diametro_mm, variante, ...}
  origen          TEXT    NOT NULL DEFAULT 'foto' CHECK(origen IN ('foto','ar')),
  foto_r2_key     TEXT,                      -- e<empresa>/replanteo/<obra>/<ts>_<nombre>
  foto_w          INTEGER,                   -- ancho natural de la foto en px
  foto_h          INTEGER,
  escala_px_m     REAL,                      -- píxeles (naturales) por metro; NULL si se dio longitud manual
  trazado_json    TEXT,                      -- {puntos:[{x,y}], obstaculos:[{seg,t,tipo,accion,dimension_m,nota}], referencia:{a,b,metros}}
  longitud_m      REAL,                      -- longitud total calculada (incluye desvíos)
  material_json   TEXT,                      -- [{key,nombre,cantidad,unidad,detalle}]
  reglas_json     TEXT,                      -- snapshot de las reglas del catálogo usadas en el cálculo
  notas           TEXT,
  estado          TEXT    NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','calculado','pedido')),
  pedido_ids      TEXT,                      -- JSON [ids de pedidos] creados desde este replanteo
  creado_por      TEXT,
  creado_en       TEXT DEFAULT (datetime('now')),
  actualizado_en  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_replanteos_empresa_obra ON replanteos(empresa_id, obra_id, departamento);

-- replanteo_catalogo: sobreescritura POR EMPRESA del catálogo base que vive en worker.js
-- (REPLANTEO_CATALOGO_BASE). Fase 1 solo la lee; el editor desde panel.html es fase 2.
CREATE TABLE IF NOT EXISTS replanteo_catalogo (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id      INTEGER NOT NULL,
  departamento    TEXT    NOT NULL,
  elemento_key    TEXT    NOT NULL,
  nombre          TEXT    NOT NULL,
  icono           TEXT,
  unidad          TEXT    NOT NULL DEFAULT 'm',
  opciones_json   TEXT,                      -- {anchos_mm:[...]} / {diametros_mm:[...]} / {variantes:[...]}
  reglas_json     TEXT    NOT NULL,          -- mismas claves que el catálogo base
  activo          INTEGER NOT NULL DEFAULT 1,
  actualizado_en  TEXT DEFAULT (datetime('now')),
  UNIQUE(empresa_id, departamento, elemento_key)
);
