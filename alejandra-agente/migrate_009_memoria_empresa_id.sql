-- migrate_009_memoria_empresa_id.sql
-- ADR-0007: D1 migration -> REQUIERE AUTORIZACIÓN HUMANA (no autónomo).
-- Objetivo: habilitar el scope per-tenant de alejandra_memoria (ADR/seg-ch).
--
-- EVIDENCIA PREVIA (lectura, production alejandra-db):
--   total filas = 169
--   - 24 resolubles via usuarios.id (empresa_id INTEGER real)
--   - 142 sentinelas system/cron/getaway/adrian
--   - 3 huérfanos: 'encargado_juan'(2) + 'fcm_token' UUID(1)
--   - 0 anon
--   usuarios tiene 6 tenants distintos; empresa_id es INTEGER.
--
-- ORDEN DE APLICACIÓN (security-positive): DDL -> backfill -> despliegue código.
--   En prod actual el código OLD ya inyecta todo sin scope (la fuga). Tras el
--   backfill los datos están clasificados; el scope solo queda activo al
--   desplegar el worker. Nunca hay ventana nueva de exposición cross-tenant.

-- STEP 1: esquema. ADD COLUMN es ADD de columna (SQLite) — rápido, sin rewrite,
-- bloquea escrituras brevemente. Todas las filas quedan NULL inicialmente.
ALTER TABLE alejandra_memoria ADD COLUMN empresa_id TEXT;

-- STEP 2: backfill per-tenant. Regla por segmento:
-- 2a) usuarios reales -> empresa_id resuelto de usuarios (clasifican a su empresa).
UPDATE alejandra_memoria
SET empresa_id = (SELECT u.empresa_id
                   FROM usuarios u
                   WHERE u.id = alejandra_memoria.usuario_id)
WHERE usuario_id IS NOT NULL
  AND usuario_id NOT LIKE 'anon:%'
  AND usuario_id NOT IN ('system','cron','getaway','adrian')
  AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = alejandra_memoria.usuario_id);
-- -> esperado: 24 filas

-- 2b) anónimos -> 'default' (coherente con empresa_id de sesión anónima en /api/chat).
UPDATE alejandra_memoria
SET empresa_id = 'default'
WHERE usuario_id LIKE 'anon:%';
-- -> esperado: 0 filas (pero regla future-proof)

-- 2c) sentinelas + huérfanos -> 'system' (aislados del negocio).
--     Queda atrapa TODO lo que 2a/2b dejaron NULL.
UPDATE alejandra_memoria
SET empresa_id = 'system'
WHERE empresa_id IS NULL
  AND ( usuario_id IN ('system','cron','getaway','adrian')
        OR usuario_id IS NULL
        OR usuario_id LIKE 'anon:%'
        OR NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = alejandra_memoria.usuario_id)
        );
-- -> esperado: 145 filas  (169 - 24)

-- Verificación (post-aplicación):
--   SELECT COUNT(*) FROM alejandra_memoria WHERE empresa_id IS NULL;  -- debe ser 0
--   SELECT COUNT(*) FROM alejandra_memoria WHERE usuario_id NOT LIKE 'anon:%' AND usuario_id NOT IN ('system','cron','getaway','adrian') AND EXISTS(SELECT 1 FROM usuarios u WHERE u.id=usuario_id) AND empresa_id <> (SELECT u.empresa_id FROM usuarios u WHERE u.id=alejandra_memoria.usuario_id); -- debe ser 0

-- ROLLBACK:
--   Datos:  UPDATE alejandra_memoria SET empresa_id = NULL;  -- re-NULL (columna queda, datos revertidos)
--   DDL:    ALTER TABLE alejandra_memoria DROP COLUMN empresa_id;  -- si D1 lo soporta (>=SQLite 3.35)
--   Si DROP COLUMN no soportado, dejar columna NULL + código fail-closed (WHERE empresa_id IS NULL excluded por el read)
