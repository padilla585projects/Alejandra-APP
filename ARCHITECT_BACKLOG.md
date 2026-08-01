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
| ARC-005 | Mitigado localmente | Promoción deliberada a producción | Crítico | ADR-0001 aceptado; los workflows versionados separan CI, despliegues, migraciones y secretos. Pendiente verificar controles remotos de GitHub. La mitigación cubre las migraciones lanzadas por workflow, no el DDL que el propio Worker ejecuta en producción: ver ARC-011. |
| ARC-006 | Pendiente | Catálogo de tools y matriz de permisos | Alto | Herramientas sensibles y D1/R2 compartidos exigen contratos y pruebas negativas. |
| ARC-007 | Investigación | Fronteras de dominio y extracción incremental | Medio | Monolitos actuales; elegir vertical piloto tras contratos y pruebas. |
| ARC-008 | Pendiente | Observabilidad y métricas cognitivas | Medio | Definir coste, confianza, calidad, degradación, trazas y retención. Incluye un endpoint de salud real: los `GET /health` actuales devuelven 200 sin comprobar D1/R2 y con versión escrita a mano, por lo que F-0.1 tuvo que retirar los healthchecks automáticos de despliegue (ver runbook). |
| ARC-009 | Cerrado | Precedencia documental / Libro Maestro | Alto | COH-001 cerrado por ADR-0005: `MASTER_PLAN.md` es la referencia versionada y el original quedó archivado sin autoridad normativa. |
| ARC-010 | Cerrado | Estado del contrato cognitivo | Alto | COH-002 cerrado por ADR-0002: contrato cognitivo aceptado como arquitectura objetivo; implementación bloqueada por dependencias explícitas. |
| ARC-011 | Pendiente | Esquema D1 definido por DDL en tiempo de ejecución | Crítico | El esquema real no lo definen las migraciones versionadas: `worker.js` ejecuta ~108 `CREATE TABLE IF NOT EXISTS` y ~51 `ALTER TABLE` en producción, varios silenciados con `.catch(() => {})` (ej. `worker.js:24646`, que duplica `migrate_008`); el agente añade ~20 `CREATE`. `schema_completo.sql` y los 24 `migrate_*.sql` son parciales. Limita el alcance real de ARC-005: F-0.1 controla las migraciones del workflow, no las del código. Requiere inventario del esquema real (solo lectura), decisión sobre migrador único y ADR. |

## Criterio de priorización

Primero se resuelven bloqueos de coherencia, riesgos críticos de seguridad/producción y límites de permisos/datos; después modularidad/optimización. Ninguna prioridad sustituye aprobación explícita.

## Revisión de Fase 2

No se ha añadido alcance funcional fuera del Motor de Decisión. Las dependencias detectadas durante el diseño ya estaban registradas en ARC-001, ARC-003, ARC-004 y ARC-006; no se crean decisiones nuevas hasta la revisión de ADR-0004.

## Referencia de planificación

`MASTER_ROADMAP.md` organiza el orden y las dependencias globales. Este backlog conserva riesgos, deuda y decisiones pendientes; no duplica fases ni tareas inmediatas.

## Actualización de F-0.1

ARC-005 queda mitigado en los workflows versionados: CI, despliegue, D1 y secretos están separados. Permanece pendiente la validación remota y la configuración manual de los entornos `production` y `github-pages`, protección de `main` y mínimo privilegio de secretos/tokens.

### Alcance real de F-0.1 respecto al esquema (ARC-011)

Debe quedar registrado sin ambigüedad qué resuelve y qué no resuelve esta fase:

| F-0.1 | Alcance |
|---|---|
| ✅ Controla | Las migraciones ejecutadas por GitHub Actions: manuales, una a una, con confirmación, entorno protegido y sin `\|\| echo` que oculte fallos. |
| ❌ No elimina | Los cambios de esquema que `worker.js` ejecuta por su cuenta en producción, fuera de todo workflow y de toda aprobación. |
| ❌ No resuelve | La divergencia entre el esquema versionado (`schema_completo.sql` + 24 `migrate_*.sql`) y el esquema creado dinámicamente desde código. |

Consecuencia: la promoción deliberada a producción está mitigada **para el código**, no para el
esquema. Un despliegue aprobado puede seguir alterando la estructura de D1 sin que nadie lo
apruebe, porque el DDL viaja dentro del propio Worker.

### Trabajo futuro obligatorio (no pertenece a F-0.1)

1. **Inventariar** todos los `CREATE TABLE`, `ALTER TABLE` y demás cambios de esquema ejecutados
   desde código, en ambos Workers, con ubicación, tabla afectada y si están silenciados.
2. **Contrastar** ese inventario con el esquema real de D1 mediante consulta autorizada de solo
   lectura, y con las migraciones versionadas, para obtener la divergencia efectiva.
3. **Convertirlos progresivamente** en migraciones versionadas, idempotentes y verificables, con
   un migrador único, orden explícito y registro de aplicación.
4. **Retirar el DDL en runtime** solo después de que su equivalente versionado esté aplicado y
   verificado, vertical por vertical, nunca en bloque.
5. Requiere ADR propio antes de tocar código.

Este refactor **no se ejecuta dentro de F-0.1**. F-0.1 se limita a dejar el riesgo registrado,
acotado y con la migración 008 bloqueada para que no se dispare por accidente.
