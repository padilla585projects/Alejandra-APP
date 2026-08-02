# ADR-0008 — Definición de Nexo

- Identificador: ADR-0008
- Fecha: 2026-08-02
- Estado: **Aceptado** (2026-08-02)
- Decisores: Director del Proyecto
- Resuelve: ARC-003
- Desbloquea: F-2.2 («Nexo v1»); referenciado como dependencia por F-6.1 (Agentes)

## Por qué este documento no diseña nada

`ARCHITECT_BACKLOG.md` es explícito: *«Alcance no aprobado: integración, orquestación o
producto. No diseñar/implementar sin decisión.»* La única referencia de visión que existe es
una línea poética en `docs/architecture/CARTA-DEL-ARQUITECTO.md`: **«Nexo es su
conocimiento»**. Eso no es una especificación — es una intención sin forma de sistema.

Diseñar Nexo sin que el Director elija primero **qué tipo de cosa es** repetiría el error que
`MASTER_ROADMAP.md` ya identificó como riesgo: *«evitar reescribir los dos Workers o crear
Marketplace/multiagente antes de registries, permisos y observabilidad»*.

Este ADR no propone una arquitectura. Presenta **tres interpretaciones posibles y mutuamente
excluyentes** de lo que «Nexo» podría ser, con sus consecuencias, para que el Director elija
una antes de que exista una sola línea de diseño.

## Las tres interpretaciones

### A. Nexo como capa de integración

Un conjunto de conectores hacia fuentes externas de conocimiento (normativa, precios de
mercado, documentación de fabricantes) que Alejandra consulta bajo demanda. No decide nada
por sí mismo; enriquece el contexto de una respuesta.

- **Alcance:** bajo. Extiende `buscar_normativa`/`buscar_precios`, que ya existen como tools
  individuales.
- **Riesgo:** bajo. Es aditivo y no cambia el modelo de permisos actual.
- **Lo que NO sería:** un componente que coordina o memoriza nada por sí mismo.

### B. Nexo como capa de orquestación entre módulos

Un componente que decide qué módulo de Alejandra (checklist, planos, RFI, incidencias…)
atiende una solicitud y cómo se relacionan entre sí sus resultados. Se acerca a lo que
`docs/architecture/04-MOTOR-DE-DECISION.md` ya reserva para el Motor de Decisión.

- **Alcance:** medio-alto. Se solapa con el Motor de Decisión (ADR-0004) si no se delimita
  con precisión quién decide qué.
- **Riesgo:** acoplamiento. `ARCHITECT_BACKLOG.md` ya lo señala: *«acoplamiento y autoridad
  difusa»*.
- **Pregunta abierta:** si se elige B, ¿qué le queda al Motor de Decisión que no haga Nexo?

### C. Nexo como producto — coordinación multiagente

La lectura más ambiciosa: un sistema que coordina múltiples agentes especializados
(`F-6.1 — Delegación y agentes especializados`), con bandeja de tareas, límites y
supervisión.

- **Alcance:** alto. Es en la práctica adelantar la Época 6 dentro de la Época 2.
- **Riesgo:** el mayor. `MASTER_ROADMAP.md` ya lo descarta como prematuro: *«evitar…
  multiagente antes de registries, permisos y observabilidad»*.
- **Dependencias reales:** F-1.3 (Tool Registry), F-4.1 (Observabilidad), ARC-004
  (verificación independiente) — ninguna resuelta todavía.

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| Diseñar Nexo ya, con la interpretación que "parezca más razonable" | Descartada: es exactamente lo que ARC-003 prohíbe. Sin decisión previa, el diseño fija la decisión por la puerta de atrás |
| Posponer indefinidamente sin marco de decisión | Descartada: deja F-2.2 bloqueada sin un camino visible para desbloquearla |
| **Presentar las tres lecturas y pedir elección** | **Elegida.** Convierte «alcance no aprobado» en una pregunta concreta y cerrada |

## Consecuencias

- Elegir **A** desbloquea F-2.2 casi de inmediato: es una extensión de tools existentes.
- Elegir **B** exige antes delimitar la frontera con el Motor de Decisión (ADR-0004), así
  que en la práctica pospone F-2.2 hasta que esa frontera esté escrita.
- Elegir **C** exige resolver primero F-1.3 y F-4.1: F-2.2 quedaría, de facto, reordenada
  detrás de esas dos.
- No elegir mantiene F-2.2 en «Investigación», que es su estado actual — este ADR no cambia
  nada por sí solo.

## Pregunta para el Director

**¿Cuál de las tres interpretaciones —A, B o C— es la que tenías en mente al escribir «Nexo
es su conocimiento»?** Si es una cuarta que no está aquí, decirlo destraba el ADR igual de
bien: lo importante es tener una intención escrita antes de diseñar.

## Decisión (2026-08-02)

El Director elige la **interpretación A: Nexo como capa de integración** con sistemas
externos (normativa, precios de mercado, documentación de fabricantes). Se descartan
explícitamente B y C: Nexo **no** es el Motor de Decisión ni una capa de orquestación entre
módulos, y **no** es coordinación multiagente ni adelanta la Época 6.

Consecuencia directa: F-2.2 («Nexo v1») queda desbloqueada como extensión aditiva de tools
existentes (`buscar_normativa`, `buscar_precios` y similares), sin necesidad de resolver
primero la frontera con el Motor de Decisión (ADR-0004) ni con F-1.3/F-4.1, que solo eran
dependencias de las interpretaciones B y C.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-003
- `docs/architecture/CARTA-DEL-ARQUITECTO.md` — única mención de visión existente
- `docs/architecture/04-MOTOR-DE-DECISION.md` — frontera pendiente con la interpretación B
- `MASTER_ROADMAP.md` — F-2.2, riesgo de acoplamiento y autoridad difusa
