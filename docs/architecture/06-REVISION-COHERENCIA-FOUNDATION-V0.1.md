# Revisión de coherencia — Foundation v0.1

- Fecha: 2026-08-01
- Alcance: Libro Maestro, Plan Director, ADN, Arquitecturas Técnica/Cognitiva, Normas, reglas/backlog arquitectónicos, documentos maestros y ADRs.
- Método: revisión documental estática; no se modificó código ni infraestructura.

## Resultado

La fundación es coherente en sus principios principales: documentación versionada, seguridad y permisos, evolución incremental, no implementación sin aprobación, y separación entre arquitectura actual y objetivo. ADR-0003 refuerza coherentemente el principio de control humano y de verificación.

## Contradicciones importantes: no resueltas

| ID | Documentos | Contradicción | Impacto | Acción requerida |
|---|---|---|---|---|
| COH-001 | `LIBRO MAESTRO DEL PROYECTO.txt` / `ARCHITECT_RULES.md` | El Libro Maestro se declara fuente superior, pero no está versionado en Git; las reglas establecen que solo la documentación versionada es oficial. | Alto: no hay precedencia verificable en el repositorio. | Decidir si versionar y normalizar el Libro Maestro o reemplazarlo mediante ADR/documento maestro versionado. |
| COH-002 | `docs/02-ADN.md` / `PROJECT_STATE.md` / ADR-0002 | ADN dice que Fase 1 fue aprobada; estado y ADR-0002 la declaran pendiente/propuesta. | Alto: no está claro qué contrato cognitivo está congelado. | Director/Arquitecto deben decidir si ADR-0002 se acepta, se ajusta o se rechaza. |

## Observaciones no bloqueantes

- Plan Director prohíbe implementar QA/Nexo 2.0 en fases aún no autorizadas; Arquitectura Cognitiva los describe como componentes objetivo y no implementados. Se considera coherente mientras se mantenga esta distinción.
- El Libro Maestro propone una ambición transversal para cualquier empresa; el Manifiesto actual delimita el producto presente a gestión industrial y de obra. Es una diferencia de horizonte, no contradicción, pero deberá declararse como visión/plazo cuando se normalice el Libro Maestro.

## Estado de congelación

**Foundation v0.1 queda congelada como línea base documental operativa, con dos decisiones bloqueantes pendientes (COH-001 y COH-002).** No autoriza iniciar el desarrollo del Núcleo Cognitivo hasta resolverlas mediante decisión documentada/ADR.

## Referencias

- `ARCHITECT_RULES.md`
- `ARCHITECT_BACKLOG.md`
- ADR-0001, ADR-0002, ADR-0003
