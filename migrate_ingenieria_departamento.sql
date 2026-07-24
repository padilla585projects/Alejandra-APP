-- INGENIERIA-01: Oficina tecnica pasa a ser el departamento Ingenieria.
-- El rol `oficina` no cambia: es un permiso de acceso independiente.
UPDATE usuarios SET departamento = 'ingenieria' WHERE departamento = 'oficina';
UPDATE sesiones SET departamento = 'ingenieria' WHERE departamento = 'oficina';
UPDATE invitaciones SET departamento = 'ingenieria' WHERE departamento = 'oficina';
UPDATE empresas SET departamentos = REPLACE(departamentos, 'oficina', 'ingenieria') WHERE departamentos LIKE '%oficina%';
