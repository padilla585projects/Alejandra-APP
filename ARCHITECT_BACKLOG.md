# Backlog arquitectónico — Alejandra 2.0

- Actualizado: 2026-08-01
- Foundation: v0.1 congelada como línea base, sin bloqueos documentales activos (COH-001 y COH-002 cerrados)

## Cómo usarlo

Cada ítem conserva estado, evidencia, impacto, alternativas y fase/ADR de destino. Un ítem aprobado se enlaza a especificación, ADR y PR; no se implementa desde este documento.

## Ítems abiertos

| ID | Estado | Tema | Impacto | Evidencia / siguiente decisión |
|---|---|---|---|---|
| ARC-001 | Pendiente | Modelo de riesgo y aprobación humana | Alto | ADR-0003 fija evaluación obligatoria; faltan umbrales, responsables y catálogo de acciones. Requiere ADR. |
| ARC-002 | Pendiente | Gobierno de memoria | Alto | Definir privacidad, tenant, procedencia, confianza, caducidad, corrección y borrado. Requiere ADR y compliance. |
| ARC-003 | Investigación | Definición de Nexo | Alto | Alcance no aprobado: integración, orquestación o producto. No diseñar/implementar sin decisión. |
| ARC-004 | Pendiente | QA y verificación independiente | Alto | Determinar controles deterministas, revisión humana, métricas y trazas. |
| ARC-005 | Mitigado localmente | Promoción deliberada a producción | Crítico | ADR-0001 aceptado; los workflows versionados separan CI, despliegues, migraciones y secretos. Pendiente verificar controles remotos de GitHub. |
| ARC-006 | Pendiente | Catálogo de tools y matriz de permisos | Alto | Herramientas sensibles y D1/R2 compartidos exigen contratos y pruebas negativas. |
| ARC-007 | Investigación | Fronteras de dominio y extracción incremental | Medio | Monolitos actuales; elegir vertical piloto tras contratos y pruebas. |
| ARC-008 | Pendiente | Observabilidad y métricas cognitivas | Medio | Definir coste, confianza, calidad, degradación, trazas y retención. |
| ARC-009 | Cerrado | Precedencia documental / Libro Maestro | Alto | COH-001 cerrado por ADR-0005: `MASTER_PLAN.md` es la referencia versionada y el original quedó archivado sin autoridad normativa. |
| ARC-010 | Cerrado | Estado del contrato cognitivo | Alto | COH-002 cerrado por ADR-0002: contrato cognitivo aceptado como arquitectura objetivo; implementación bloqueada por dependencias explícitas. |

## Criterio de priorización

Primero se resuelven bloqueos de coherencia, riesgos críticos de seguridad/producción y límites de permisos/datos; después modularidad/optimización. Ninguna prioridad sustituye aprobación explícita.

## Revisión de Fase 2

No se ha añadido alcance funcional fuera del Motor de Decisión. Las dependencias detectadas durante el diseño ya estaban registradas en ARC-001, ARC-003, ARC-004 y ARC-006; no se crean decisiones nuevas hasta la revisión de ADR-0004.

## Referencia de planificación

`MASTER_ROADMAP.md` organiza el orden y las dependencias globales. Este backlog conserva riesgos, deuda y decisiones pendientes; no duplica fases ni tareas inmediatas.

## Actualización de F-0.1

ARC-005 queda mitigado en los workflows versionados: CI, despliegue, D1 y secretos están separados. Permanece pendiente la validación remota y la configuración manual de los entornos `production` y `github-pages`, protección de `main` y mínimo privilegio de secretos/tokens.
