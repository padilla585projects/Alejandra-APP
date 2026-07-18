-- Crear usuarios de prueba para testing de roles compuestos

-- 1. Actualizar Alberto (id=50) con roles_extra=["oficina"]
UPDATE usuarios SET
  email='alberto@test.local',
  roles_extra='["oficina"]',
  activo=1
WHERE id=50 AND nombre='Alberto';

-- 2. Crear María (oficina + electrico) - generar código único
INSERT OR IGNORE INTO usuarios (nombre, codigo, email, rol, departamento, roles_extra, empresa_id, activo)
VALUES ('María', 'MARIA001', 'maria@test.local', 'oficina', 'electrico', '[]', 1, 1);

-- 3. Crear Carlos (oficina + seguridad) - generar código único
INSERT OR IGNORE INTO usuarios (nombre, codigo, email, rol, departamento, roles_extra, empresa_id, activo)
VALUES ('Carlos', 'CARLOS001', 'carlos@test.local', 'oficina', 'seguridad', '[]', 1, 1);

-- Verificar cambios
SELECT id, nombre, email, rol, departamento, roles_extra FROM usuarios WHERE email LIKE '%test%' OR nombre='Alberto';
