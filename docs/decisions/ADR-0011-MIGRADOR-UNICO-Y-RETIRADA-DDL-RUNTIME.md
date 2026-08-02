# ADR-0011 — Migrador único y retirada del DDL en runtime

- Identificador: ADR-0011
- Fecha: 2026-08-02
- Estado: **Propuesto** — requiere decisión del Director
- Decisores: Director del Proyecto — `PENDIENTE`
- Resuelve: ARC-011 fase 3
- Depende de: ARC-013 (ya corregido — el DDL en runtime deja rastro), ARC-015 (ya corregido
  con datos reales de D1)

## Contexto: la magnitud confirmada, con datos de producción

ARC-011 fases 1 y 2 (2026-08-02) establecieron por análisis estático y contraste con D1 que
**el esquema no es reproducible desde el repositorio**. Con la consulta de metadatos
autorizada hoy mismo, la magnitud queda confirmada con datos frescos, no una foto de hace
horas:

| Métrica | Valor confirmado hoy |
|---|---:|
| Tablas reales en D1 | **153** |
| Tablas cuyo `CREATE` no vive en ningún `.sql` versionado | ~100 (fase 1: 105 de 150) |
| Tablas en D1 que ningún `CREATE` del repositorio declara | 27 (fase 2) — incluidas `empresas`, `fichajes`, `incidencias` |
| Migraciones `.sql` versionadas, sin manifiesto de orden ni de aplicación | 28 (20 en raíz, 8 en el agente) |

Este ADR no repite ese diagnóstico — remite a
`docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`. Decide qué hacer con él.

**Lo que ya cambió desde el diagnóstico original.** ARC-013 sustituyó los `catch` vacíos por
`runDDL()`, que registra cualquier fallo real. Eso no arregla la falta de reproducibilidad,
pero significa que un DDL que falle a partir de ahora **se ve**, en vez de sumarse en
silencio a la lista de discrepancias. La fase 3 ya no parte de una base completamente ciega.

## Decisión propuesta: migración por verticales, nunca de golpe

**No se propone una migración masiva.** `AGENTS.md` lo prohíbe explícitamente («no hacer
refactors masivos») y el propio ADR-0006 clasifica el DDL como N3 — no recuperable si algo
sale mal. Un intento de declarar las 100+ tablas de una vez es exactamente el tipo de cambio
que este proyecto ya decidió no hacer.

Se propone un ciclo por **vertical de negocio** (checklists, incidencias, RFI, planos…),
repetido tantas veces como verticales existan:

1. **Declarar.** Escribir la migración `.sql` para las tablas de ese vertical, con el
   esquema exacto que hoy tiene D1 — no el que el código *debería* crear, el que
   **realmente** tiene.
2. **Aplicar en un entorno de verificación** (o, si no existe, con `IF NOT EXISTS` contra el
   real, que es aditivo y no destructivo) y confirmar que coincide columna por columna.
3. **Retirar el DDL en runtime SOLO de ese vertical**, dejando el `CREATE TABLE IF NOT
   EXISTS`/`ALTER` original comentado con referencia a la migración que lo sustituye, no
   borrado — para que un `git blame` explique por qué desapareció.
4. **Verificar en producción** que el vertical sigue funcionando sin el DDL en caliente.
5. Solo entonces, pasar al siguiente vertical.

Un vertical con este ciclo fallido no bloquea a los demás — es la ventaja de no hacerlo de
golpe.

## El manifiesto de migraciones

Las 28 `.sql` actuales no tienen forma de saber, desde el repositorio, cuáles están
aplicadas en D1. Se propone un fichero `migrate_manifiesto.json` con:

```json
{ "migraciones": [
  { "archivo": "migrate_roles_multiobra.sql", "aplicada": false, "verificado": "2026-08-02" },
  { "archivo": "migrate_008_plano_circuitos.sql", "aplicada": true, "run": "30722027660" }
]}
```

Se llena consultando D1 una vez —el mismo método de solo lectura usado hoy para ARC-015— y a
partir de ahí lo mantiene el workflow de migración: cada aplicación exitosa marca su propia
entrada. Esto habría evitado el incidente de la migración 008 (bloqueada por diagnóstico
incorrecto, luego desbloqueada al comprobar contra D1 real).

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| Migración masiva de las ~100 tablas de una vez | Descartada: contradice `AGENTS.md` y es N3 sin red de seguridad — si algo sale mal a mitad, no hay forma de saber qué parte del esquema quedó a medias |
| Dejar el DDL en runtime indefinidamente, solo con `runDDL()` registrando errores | Descartada: es la situación actual tras ARC-013. Mejor que antes, pero el esquema sigue sin ser reproducible — si se pierde D1, sigue sin haber de dónde reconstruirlo |
| **Migración por vertical, con manifiesto de estado** | **Elegida.** Acotada, reversible por partes, y deja rastro de qué falta en todo momento |

## Consecuencias

- El primer vertical a migrar debería ser el de menor riesgo y mayor beneficio para
  practicar el ciclo — candidato razonable: `checklists` (`checklist_plantillas`,
  `checklists_plantillas`, `checklist_registros`, `checklist_ejecuciones`), ya auditado hoy
  en ARC-015 y con su esquema real ya verificado.
- Las 27 tablas huérfanas (sin `CREATE` en ningún sitio) son las de mayor riesgo porque no
  hay ni siquiera un punto de partida en código — su vertical necesita más tiempo de
  reconstrucción del esquema antes del paso 1.
- `run_migration`, la tool de Alejandra, sigue siendo una vía de divergencia mientras
  ADR-0006 no se acepte. Este ADR no la toca — es dependencia cruzada con ADR-0006, no de
  este documento.

## Preguntas para el Director

1. **¿Se acepta el orden por vertical**, empezando por `checklists`?
2. **¿El manifiesto es un fichero versionado en el repo**, como se propone, o debe vivir en
   D1 mismo (una tabla `_migraciones_aplicadas`)? Un fichero es más visible en revisión de
   código; una tabla es más difícil de desincronizar de la realidad.
3. **¿Cuánto tiempo entre verticales?** No es una pregunta técnica: es cuánto ritmo quiere
   el Director para este trabajo frente al resto del roadmap.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-011, ARC-013, ARC-015
- `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md` — diagnóstico completo de fases 1 y 2
- `AGENTS.md` — prohibición de refactors masivos
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — DDL clasificado N3
- `docs/decisions/ADR-0007-AUTONOMIA-DE-AGENTES-EN-DESARROLLO.md` — migraciones D1 exigen decisión humana
