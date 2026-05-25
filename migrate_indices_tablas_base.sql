-- ============================================================
-- ALEJANDRA APP — Índices para tablas originales (sin índices)
-- Aplicar: npx wrangler d1 execute alejandra-db --remote --file=migrate_indices_tablas_base.sql
-- Columnas verificadas contra D1 real (25/05/2026)
-- ============================================================

-- Bobinas: empresa_id y obra_id confirma en PRAGMA table_info
CREATE INDEX IF NOT EXISTS idx_bobinas_empresa     ON bobinas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_bobinas_obra        ON bobinas(obra_id);
CREATE INDEX IF NOT EXISTS idx_bobinas_estado      ON bobinas(estado);
CREATE INDEX IF NOT EXISTS idx_bobinas_empresa_obra ON bobinas(empresa_id, obra_id);

-- PEMP
CREATE INDEX IF NOT EXISTS idx_pemp_empresa        ON pemp(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pemp_obra           ON pemp(obra_id);
CREATE INDEX IF NOT EXISTS idx_pemp_estado         ON pemp(estado);

-- Carretillas
CREATE INDEX IF NOT EXISTS idx_carretillas_empresa ON carretillas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_carretillas_obra    ON carretillas(obra_id);
CREATE INDEX IF NOT EXISTS idx_carretillas_estado  ON carretillas(estado);

-- Sesiones: getAuth() hace lookup por token en cada request → índice crítico
CREATE INDEX IF NOT EXISTS idx_sesiones_token      ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario    ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expires    ON sesiones(expires_at);

-- Usuarios: búsquedas por email y empresa (google_id no existe — columna es google_pending)
CREATE INDEX IF NOT EXISTS idx_usuarios_email      ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa    ON usuarios(empresa_id);

-- Obras
CREATE INDEX IF NOT EXISTS idx_obras_empresa       ON obras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_activa        ON obras(activa);

-- Historial (movimientos de bobinas)
CREATE INDEX IF NOT EXISTS idx_historial_bobina    ON historial(bobina_id);
CREATE INDEX IF NOT EXISTS idx_historial_obra      ON historial(obra_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha     ON historial(created_at DESC);

-- Inventario seguridad
CREATE INDEX IF NOT EXISTS idx_inventario_seg_empresa ON inventario_seg(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inventario_seg_obra    ON inventario_seg(obra_id);
