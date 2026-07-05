-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 005: interruptor dev-bypass (continuación 15)
-- ══════════════════════════════════════════════════════════════════════════════
-- Adrian pidió poder activar/desactivar, solo para sí mismo (dev verificado por
-- esDeveloperAgente), dos de las protecciones existentes: el rate limiting del
-- chat y el aislamiento por empresa_id en consultar_bd/escribir_bd/exportar_datos.
-- Visible/editable desde panel.html (Alejandra Office, sección DevTools) y desde
-- la app Flutter (Ajustes, gateado por rol). Nunca afecta a otros usuarios ni
-- empresas -- ver validarScopeEmpresaBD/debeOmitirRateLimitDev en lib.js.
--
-- Los valores por defecto preservan el comportamiento actual del sistema, no
-- introducen ningún cambio de comportamiento por sí solos:
--   - dev_bypass_empresa_scope = 1: hoy el aislamiento por empresa_id YA se salta
--     siempre para un dev verificado (validarScopeEmpresaBD retornaba null
--     incondicionalmente si esDevVerificado) -- este default mantiene eso, pero
--     ahora de forma explícita, visible y con auditoría en alejandra_logs cada
--     vez que se cambia.
--   - dev_bypass_rate_limit = 0: hoy el rate limit SÍ se aplica también al dev
--     (nunca hubo bypass) -- este default mantiene eso; el dev puede activar el
--     bypass cuando lo necesite (ej. pruebas de carga) sin afectar a nadie más.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE agente_config ADD COLUMN dev_bypass_rate_limit INTEGER DEFAULT 0;
ALTER TABLE agente_config ADD COLUMN dev_bypass_empresa_scope INTEGER DEFAULT 1;
