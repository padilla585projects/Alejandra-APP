# Plan de PRs pequeños y revisables

Este plan empieza después de aprobar la Fase 0. Cada PR debe mantener compatibilidad y no mezclar cambios ajenos.

## PR-01 — Entrega deliberada

- Objetivo: separar validación continua de promoción a producción conforme a ADR-0001.
- Alcance: workflows GitHub Actions, permisos de entornos y runbook de entrega.
- Riesgos: bloquear una entrega urgente o configurar mal la promoción.
- Pruebas: CI sobre PR, ejecución manual en entorno controlado y healthcheck sin migración.
- Rollback: restaurar workflow previo solo con aprobación de responsable; promover el último commit sano.
- Dependencias: aceptación de ADR-0001 y acceso de administrador a GitHub/Cloudflare.

## PR-02 — Inventario y gobierno de datos

- Objetivo: convertir bindings, secretos, migraciones y objetos R2 en inventarios verificables.
- Alcance: manifiestos documentales, validadores de configuración sin secretos y runbooks.
- Riesgos: revelar metadatos sensibles o identificar una inconsistencia heredada.
- Pruebas: ejecución local sin valores secretos; revisión de permisos remotos en solo lectura.
- Rollback: revertir solo documentación/validadores; no cambia recursos.
- Dependencias: PR-01 para evitar despliegue involuntario.

## PR-03 — Base de calidad sin cambio funcional

- Objetivo: establecer sintaxis, pruebas de agente, controles de seguridad y cobertura mínima del Worker web.
- Alcance: scripts versionados, CI y primeras pruebas de autenticación/autorización puras.
- Riesgos: falsos positivos o aumento temporal de mantenimiento.
- Pruebas: ejecución local y CI; ningún acceso remoto.
- Rollback: revertir scripts/CI; el producto no cambia.
- Dependencias: PR-01.

## PR-04 — Contratos y catálogo de superficie

- Objetivo: documentar rutas API, tools IA, permisos, dueños y contratos de error.
- Alcance: catálogo generado o mantenido, matriz de autorización y ADR si aparece una decisión nueva.
- Riesgos: descubrir diferencias entre documentación y ejecución.
- Pruebas: contratos de rutas y negativas por permisos sobre casos representativos.
- Rollback: revertir el catálogo si fuese incorrecto; no migrar comportamiento en esta PR.
- Dependencias: PR-02 y PR-03.

## PR-05 — Primera extracción vertical piloto

- Objetivo: validar la estructura propuesta con un dominio pequeño y de bajo riesgo.
- Alcance: una ruta/servicio/repositorio, pruebas y compatibilidad del contrato existente.
- Riesgos: regresión en un endpoint compartido.
- Pruebas: unitarias, integración del endpoint y regresión de autorización.
- Rollback: revertir la PR conservando la ruta monolítica previa.
- Dependencias: PR-03, PR-04 y selección explícita del dominio.

## PR-06 — Gobierno de IA y archivos

- Objetivo: formalizar permisos y auditoría para tools, memoria y R2.
- Alcance: matriz tool-permiso, propiedad de archivos, retención y pruebas de IDOR.
- Riesgos: restricciones que afecten flujos legítimos.
- Pruebas: casos autorizados/no autorizados por empresa, departamento y rol; revisión humana de herramientas sensibles.
- Rollback: feature flags o reversión dirigida, nunca retirar controles de seguridad sin análisis.
- Dependencias: PR-02, PR-03, PR-04 y validación de compliance.
