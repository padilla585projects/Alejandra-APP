-- ══════════════════════════════════════════════════════════════════════════════
-- ALEJANDRA AGENTE — Migración 014: tope de gasto diario configurable
-- ══════════════════════════════════════════════════════════════════════════════
-- PANEL-ALEJANDRA-REAL-01 (16/09/2026): rehaciendo admin.html como panel real de
-- configuración/salud de Alejandra (no de toda la plataforma, eso ya lo cubre
-- DevTools en panel.html). TOPE_GASTO_DIARIO_USD vivía como constante fija (10)
-- en el código -- se mueve a agente_config para poder ajustarlo desde el panel
-- sin necesitar un deploy. El default preserva el comportamiento actual.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE agente_config ADD COLUMN tope_gasto_diario_usd REAL DEFAULT 10;
