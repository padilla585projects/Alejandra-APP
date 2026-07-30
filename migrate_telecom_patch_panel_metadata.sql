-- Metadatos técnicos visibles en la tarjeta del patch panel.
ALTER TABLE telecom_patch_panels ADD COLUMN red_vlan TEXT;
ALTER TABLE telecom_patch_panels ADD COLUMN switch_asociado TEXT;
ALTER TABLE telecom_patch_panels ADD COLUMN subred TEXT;
ALTER TABLE telecom_patch_panels ADD COLUMN posicion_u TEXT;
ALTER TABLE telecom_patch_panels ADD COLUMN notas_config TEXT;
