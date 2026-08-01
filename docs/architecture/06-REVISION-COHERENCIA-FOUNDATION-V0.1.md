# Revisión de coherencia — Foundation v0.1

- Fecha: 2026-08-01
- Alcance: Libro Maestro, Plan Director, ADN, Arquitecturas Técnica/Cognitiva, Normas, reglas/backlog arquitectónicos, documentos maestros y ADRs.
- Método: revisión documental estática; no se modificó código ni infraestructura.

## Resultado

La fundación es coherente en sus principios principales: documentación versionada, seguridad y permisos, evolución incremental, no implementación sin aprobación, y separación entre arquitectura actual y objetivo. ADR-0003 refuerza coherentemente el principio de control humano y de verificación.

## Contradicciones importantes: resueltas el 2026-08-01

| ID | Documentos | Contradicción | Impacto | Resolución |
|---|---|---|---|---|
| COH-001 | Libro Maestro / `ARCHITECT_RULES.md` | El Libro Maestro se declaraba fuente superior, pero no estaba versionado en Git; las reglas establecen que solo la documentación versionada es oficial. | Alto: no había precedencia verificable en el repositorio. | **Cerrada por ADR-0005.** El original quedó versionado en `docs/archive/LIBRO-MAESTRO-ORIGINAL.txt` sin autoridad normativa; el contenido vigente vive en `MASTER_PLAN.md`. La jerarquía documental es ahora explícita y verificable. |
| COH-002 | `docs/02-ADN.md` / `PROJECT_STATE.md` / ADR-0002 | ADN decía que Fase 1 fue aprobada; estado y ADR-0002 la declaraban pendiente/propuesta. | Alto: no estaba claro qué contrato cognitivo estaba congelado. | **Cerrada por ADR-0002**, aceptado como arquitectura objetivo con implementación bloqueada por ARC-001/002/003/004/005. El contrato congelado es `docs/02-ADN.md` + `docs/03-ARQUITECTURA-COGNITIVA.md`. |

Ninguna de las dos resoluciones modificó código, infraestructura ni producción.

## Observaciones no bloqueantes

- Plan Director prohíbe implementar QA/Nexo 2.0 en fases aún no autorizadas; Arquitectura Cognitiva los describe como componentes objetivo y no implementados. Se considera coherente mientras se mantenga esta distinción.
- El Libro Maestro propone una ambición transversal para cualquier empresa; el Manifiesto actual delimita el producto presente a gestión industrial y de obra. Es una diferencia de horizonte, no contradicción, pero deberá declararse como visión/plazo cuando se normalice el Libro Maestro.

## Estado de congelación

**Foundation v0.1 queda congelada como línea base documental operativa, sin bloqueos de
coherencia abiertos.** COH-001 y COH-002 se resolvieron el 2026-08-01 mediante ADR-0005 y
ADR-0002 respectivamente.

Esto **no autoriza** iniciar el desarrollo del Núcleo Cognitivo. El bloqueo ya no es de
coherencia documental, sino de dependencias técnicas explícitas: entrega segura (ARC-005 /
ADR-0001), evaluación de riesgo (ARC-001), gobierno de memoria (ARC-002), definición de Nexo
(ARC-003) y QA/Verifier (ARC-004). El siguiente trabajo aprobado es la fase F-0.1.

## Referencias

- `ARCHITECT_RULES.md`
- `ARCHITECT_BACKLOG.md`
- ADR-0001, ADR-0002, ADR-0003, ADR-0005
