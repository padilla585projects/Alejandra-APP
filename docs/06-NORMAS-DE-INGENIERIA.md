# Normas de ingeniería

1. Trabajar en ramas cortas y PRs pequeños; no mezclar documentación, seguridad y funcionalidades no relacionadas.
2. No hacer *push* a `main` como mecanismo de despliegue hasta que se apruebe el cambio de CI/CD descrito en ADR-0001.
3. Todo endpoint debe autenticar, autorizar y acotar empresa/departamento antes de acceder a D1 o R2.
4. Las operaciones destructivas y las acciones externas requieren validación explícita, trazabilidad y prueba negativa.
5. Los secretos solo viven en el gestor de secretos correspondiente; `.env.example` contiene únicamente marcadores.
6. Cada cambio de esquema D1 debe tener migración idempotente, ordenada, revisable y procedimiento de rollback o mitigación documentado.
7. No incorporar una herramienta IA sin contrato de entrada/salida, permiso mínimo, auditoría y pruebas.
8. Añadir pruebas proporcionales al riesgo: unitarias para políticas, integración para rutas y autorización, y regresión para incidentes.
9. Actualizar ADR, runbook o documentación cuando cambie una decisión operativa o arquitectónica.
10. Mantener UTF-8 y evitar archivos generados o secretos en Git.
