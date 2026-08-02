# ADR-0012 — Arquitectura de la capa de presentación

- Identificador: ADR-0012
- Fecha: 2026-08-02
- Estado: **Aceptado** (2026-08-02)
- Decisores: Director del Proyecto
- Relacionado: `docs/architecture/FRONTEND_ARCHITECTURE.md`, `docs/architecture/02-PROPUESTA-ORGANIZACION.md`, `docs/07-UI-UX.md`

## Contexto

La interfaz vigente reside principalmente en cuatro documentos HTML monolíticos. Las dos superficies principales (`index.html` y `panel.html`) concentran presentación, navegación, estado, llamadas HTTP, estilos y numerosas features. Esta concentración impide que UI, UX, backend y núcleo cognitivo evolucionen con límites de integración pequeños y verificables.

La propuesta documentada no altera la aplicación existente ni implica adoptar un framework. Se necesita una decisión para que futuros cambios estructurales compartan una referencia y no creen una arquitectura accidental.

## Decisión

Adoptar `docs/architecture/FRONTEND_ARCHITECTURE.md` como arquitectura objetivo de la presentación:

- aplicaciones independientes para campo, oficina, administración y conversación;
- organización interna por `app`, rutas, feature, estado, adaptadores de datos y plataforma;
- paquetes explícitos para sistema de diseño, núcleo de presentación, clientes API, contratos, autorización pura y dominio puro;
- backend como autoridad única de autenticación, autorización, límites y acceso a datos;
- migración vertical, incremental, reversible y sin cambio funcional no autorizado;
- ninguna obligación de adoptar framework, bundler o despliegue separado en esta decisión.

La adopción autoriza planificar y ejecutar extracciones pequeñas conforme a las dependencias del roadmap, pero no una reescritura masiva ni cambios de comportamiento. Cada feature mantiene su validación y rollback propios.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Mantener los HTML monolíticos y aplicar convenciones informales | Descartada: no crea límites revisables ni evita nuevos acoplamientos o conflictos. |
| Reescribir todas las entradas de una vez con un framework | Descartada: alto riesgo, contradice la evolución por cambios pequeños y no preserva evidencia de regresión. |
| Adoptar ahora un framework concreto | Descartada: la necesidad comprobada es separación de responsabilidades; la tecnología no la resuelve por sí sola. |
| Arquitectura por aplicaciones, features y paquetes; migración gradual | **Aceptada**: hace explícitos los límites, mantiene opciones tecnológicas y permite trabajo paralelo. |

## Consecuencias

- Ventajas: menor superficie de conflicto, componentes consistentes, contratos HTTP centralizados y base para accesibilidad, temas e internacionalización.
- Costes: coexistencia temporal de código antiguo/nuevo, disciplina de límites y pruebas de regresión por vertical.
- Seguridad: el cliente deja de ser el lugar implícito de decisiones de acceso; la autorización de Worker no cambia ni se delega.
- Operación: no modifica Cloudflare, D1, R2, secretos, Workers, URLs públicas ni despliegues.
- Compatibilidad: se mantienen rutas y comportamiento actuales hasta validación explícita de cada extracción.

## Adopción y rollback

Adopción: iniciar con una única rebanada vertical de riesgo bajo y entregar su evidencia antes de ampliar. No se mueve código como consecuencia automática de este ADR fuera de esa rebanada aprobada.

Rollback: rechazar este ADR o sustituirlo por otro. Al ser una decisión documental, no tiene impacto en datos ni servicio.

## Referencias

- `docs/architecture/FRONTEND_ARCHITECTURE.md`
- `MASTER_ROADMAP.md` — línea P-1 propuesta
- `TASKS.md` — `P-ARCH-001`
