# ADR-0010 — Catálogo de tools y matriz de permisos

- Identificador: ADR-0010
- Fecha: 2026-08-02
- Estado: **Aceptado** (2026-08-02)
- Decisores: Director del Proyecto
- Resuelve: ARC-006
- Desbloquea: F-1.3 («Capability/Tool Registry, Verifier y QA»)

## Contexto: lo que ya existe, sin catálogo

`alejandra-agente/worker.js` declara **69 tools**. Su control de acceso hoy vive repartido en
tres `Set` de nombres en `lib.js`, construidos a base de incidentes puntuales (SEC-ANON-01,
ARC-017, y las anteriores SEC-AUDIT-01/02):

| Conjunto | Tamaño | Qué controla |
|---|---:|---|
| `TOOLS_REQUIEREN_SESION` | 61 | No alcanzables sin sesión válida |
| `TOOLS_SOLO_DEV_VERIFICADO` | 7 | Solo para identidad de desarrollador verificada |
| `TOOLS_PROHIBIDAS_CRON` | 9 | Vedadas al cron aunque entre como dev verificado |
| Alcanzables sin sesión | **7** | `buscar_web`, `calcular_cable`, `calcular_bandeja`, `calcular_proteccion`, `pensar`, `planificar`, `buscar_normativa` |

`worker.js` (raíz) declara **34 tools** adicionales, todas de desarrollador (`sql_query`,
`run_migration`, `github_*`…), con su propio mecanismo de gating independiente.

**El patrón funciona, pero no escala.** Cada vez que aparece un agujero (SEC-ANON-01,
ARC-017) alguien tiene que **acordarse** de añadir el nombre al `Set` correcto. No hay nada
que impida declarar una tool nueva y olvidarla en las tres listas — que es exactamente lo que
pasó con las 34 tools de SEC-ANON-01 y las 9 de ARC-017 antes de corregirse hoy mismo.

ARC-006 lo dice con precisión: *«Herramientas sensibles y D1/R2 compartidos exigen contratos
y pruebas negativas»*. Contrato es la palabra clave — hoy no hay contrato, hay listas.

## Decisión propuesta

**El nivel de acceso pasa de estar en listas externas a ser metadato declarado en la propia
tool.** Coherente con lo que ya fija ADR-0006: *«El nivel debe ser una propiedad DECLARADA de
la tool, no una inferencia»*.

```js
// Antes: el nivel vive en un Set aparte, fácil de olvidar
{ name: 'consultar_personal', description: '...', input_schema: {...} }

// Propuesto: el nivel es parte de la declaración de la tool
{
  name: 'consultar_personal',
  description: '...',
  input_schema: {...},
  acceso: 'sesion',        // 'publico' | 'sesion' | 'dev_verificado'
  cron: 'permitido',       // 'permitido' | 'prohibido' — independiente de `acceso`
  nivel_riesgo: 'N1',      // en términos de ADR-0006
}
```

Un registro (`Capability/Tool Registry`, F-1.3) valida en el arranque que **toda** tool
declarada tenga `acceso` y `nivel_riesgo`. Sin ellos, no se registra — el equivalente al
`--check` que hoy hace `scripts/inventario-rutas.js` sobre las rutas HTTP, aplicado a las
tools del modelo.

`filtrarToolsPorAuth()` y `filtrarToolsCron()` dejan de consultar tres `Set` externos y pasan
a filtrar por el campo `acceso`/`cron` de cada tool. El comportamiento no cambia; cambia
dónde vive la fuente de verdad.

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| Mantener las listas de `lib.js`, documentarlas mejor | Descartada: ya están documentadas con comentarios extensos (ver SEC-ANON-01, ARC-017) y aun así se olvidaron 34 y 9 tools respectivamente. El problema no es la documentación, es que la fuente de verdad está separada de la declaración |
| Un YAML/JSON externo de permisos, no en el código | Descartada: añade una fuente más que sincronizar; el objetivo es lo contrario — una sola fuente |
| **Metadato en la propia declaración de la tool, validado al registrar** | **Elegida.** Hace estructuralmente imposible declarar una tool sin decidir su acceso, en vez de depender de que alguien se acuerde |

## Consecuencias

- F-1.3 puede especificarse con un criterio de aceptación concreto: *migrar las 69+34 tools
  existentes al nuevo formato sin cambiar su comportamiento actual*, verificable comparando
  el resultado de `filtrarToolsPorAuth()` antes y después, tool por tool.
- Las pruebas negativas que hoy existen (las 5 de SEC-ANON-01, las 4 de ARC-017) siguen
  siendo válidas: verifican comportamiento observable, no la lista interna.
- No implica reescribir las 103 tools de golpe: la migración puede ser incremental,
  añadiendo el metadato tool por tool sin retirar los `Set` hasta que la última tool esté
  migrada.
- `worker.js` (raíz) y `alejandra-agente/worker.js` tienen hoy mecanismos de gating
  **independientes**. Este ADR no los unifica en un registro compartido — eso repetiría el
  riesgo que `CLAUDE.md` ya señala sobre «UNA Alejandra, DOS cerebros»: cualquier fusión
  prematura de sus mecanismos de seguridad es más riesgo que beneficio hasta que ambos estén
  estables por separado.

## Preguntas para el Director

1. **¿Se acepta el criterio de tres campos** (`acceso`, `cron`, `nivel_riesgo`), o falta
   alguno — por ejemplo, ¿hace falta un campo de aislamiento por empresa explícito, dado lo
   que reveló SEC-ANON-01?
2. **¿La migración se hace de una vez o incremental?** Recomendación: incremental, tool por
   tool, para no repetir el patrón de cambio masivo que `AGENTS.md` prohíbe.
3. **¿Este registro es compartido entre los dos workers, o cada uno mantiene el suyo?**
   Recomendación: cada uno el suyo, por la razón de «dos cerebros» arriba — unificar es un
   ADR aparte, no parte de este.

## Decisión (2026-08-02)

El Director acepta el criterio de tres campos (`acceso`, `cron`, `nivel_riesgo`) sin
añadir campos nuevos, y acepta las recomendaciones del documento para las preguntas 2 y 3:
migración **incremental**, tool por tool, sin retirar los `Set` de `lib.js` hasta que la
última tool esté migrada; y **registro independiente por worker** — este ADR no unifica el
gating de `worker.js` y `alejandra-agente/worker.js`, coherente con la regla de «dos
cerebros» de `CLAUDE.md`.

`nivel_riesgo` usa los niveles N0–N3 de ADR-0006 ya aceptado; en particular, `run_migration`
debe declararse `nivel_riesgo: 'N3'` cuando se migre, reflejando que ADR-0006 la sacó del
alcance autónomo del agente.

Consecuencia directa: F-1.3 queda especificada con el criterio de aceptación del documento —
migrar las 69+34 tools existentes sin cambiar su comportamiento observable, verificable
comparando `filtrarToolsPorAuth()` antes y después.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-006, ARC-016, ARC-017
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — niveles de riesgo que este catálogo declara
- `alejandra-agente/lib.js` — `TOOLS_REQUIEREN_SESION`, `TOOLS_SOLO_DEV_VERIFICADO`, `TOOLS_PROHIBIDAS_CRON`
- `scripts/inventario-rutas.js` — mismo patrón aplicado a rutas HTTP, ya en CI
- `CLAUDE.md` — «UNA Alejandra, DOS cerebros»
