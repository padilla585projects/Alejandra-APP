# Suite de obra/oficina: ingeniería, CAD y modelos por tarea

Fecha: 2026-10-01. Estado: **Idea / Investigación**. No constituye ADR aceptado,
fase nueva ni autorización de implementación. Origen: requisitos de Adrián y
auditoría IA-COMP-01, docs/features/comparacion-modelos-ia.md.

## Objetivo de producto

Alejandra debe asistir con rigor técnico a todos los departamentos de obra,
crear y manejar CAD, usar las herramientas autorizadas de la suite y ayudar
a usuarios en Office. La voz es secundaria. Se permite estudiar varios modelos
según tarea y seguir incorporando herramientas/capacidades de forma escalable.
No acreditar competencia por declararla en el prompt; demostrarla con resultados.

## Propuestas derivadas de carencias observadas

| Propuesta | Base existente | Valor adicional que falta acreditar | Prueba de aceptación propuesta |
|---|---|---|---|
| Expediente técnico integrado | Cálculos, planos, documentación, replanteos, pedidos | Requisitos→fuentes→cálculo→plano→materiales, con trazabilidad y verificación entre etapas | Cambiar una condición y obtener impacto consistente en cálculo, plano y cantidades, sin afirmar éxito ante tool fallida. |
| CAD con geometría estructurada | Importación DXF, SVG y exportación DXF | Unidades, capas, bloques, cotas, IDs y edición local de entidades sin pérdidas | Importar→editar una entidad→exportar→reabrir; verificar dimensiones, topología y elementos no modificados. |
| Coordinación geométrica multidisciplinar | Detector textual de conflictos y planos | Interferencias de bandejas/tubos/conductos/estructura mediante geometría común | Detectar una interferencia conocida y descartar otra con separación real, con tolerancias y referencias al plano. |
| Comparación de revisiones con impacto | Planos, transmittals, RFIs, materiales/costes | Identificar cambios geométricos/técnicos y explicar consecuencias en cantidades, compras y coordinación | Comparar dos revisiones controladas y justificar diferencias de material y tareas sin duplicar pedidos. |
| Plan semanal con restricciones comprobables | Plan semanal, cronograma, tareas, stock, pedidos | Detectar automáticamente qué impide ejecutar: material, plano/revisión, equipo o predecesora | Reprogramar propuesta ante falta de material conservando dependencias; no modificar plan sin el consentimiento exigido. |
| Expediente as-built y entrega de instalación | Fotos, calidad, ensayos, equipos, documentación | Relacionar geometría instalada, activo, prueba, ficha y revisión final como evidencia consultable | Un activo se localiza en plano y recupera ficha, prueba y cambio de revisión; detectar expediente incompleto. |
| Conocimiento técnico verificable por oficio | Módulos de prompt, buscar_normativa/conocimiento | Fuentes con vigencia, supuestos, unidades y cálculos contrastados; retirar referencias no verificadas | Un caso con norma antigua no se usa como vigente; una fórmula errónea no se consolida por repetirla. |
| Asistente Office que verifica lo realizado | Chat, guías, control de app, planes y tools | Postcondición de cada acción y recuperación explícita de pasos fallidos | Si falla un paso, no anunciar «Plan completado» ni continuar con efectos dependientes; ayudar al usuario con el estado real. |

Son extensiones de flujos existentes, no ocho módulos duplicados. Antes de construir:
identificar fuente de verdad, contratos y propietarios de cada etapa, dependencias
de ADR, operación por rol, datos de prueba y coste. Primero corregir carencias reales
de calculadores, aislamiento de contexto y resultados de Office documentadas en la auditoría.

## Escalabilidad de herramientas y proveedores

Usar los contratos y registros ya definidos por ADR-0010 y la arquitectura cognitiva.
Cada capacidad debe declarar entradas/salidas, unidades, permisos, efectos, versión,
límites, verificador y evidencia de funcionamiento. Agregar más tools o modelos no
equivale a habilitarlos para todo usuario. Mantener una identidad de Alejandra y medir
éxito completo por tarea, en lugar de acumular asistentes con reglas incompatibles.

Hipótesis de selección: modelo económico para clasificación/lecturas/extracción,
modelo técnico para requisitos y cálculos asistidos, modelo de mayor capacidad
para coordinación y planificación CAD, visión para fotos/planos. Los cálculos y la
geometría verificables se ejecutan con herramientas; el modelo local participa en
la misma evaluación y no se presupone sustituto universal de los proveedores.

## Modelo local y prueba del pool

Adrián propone conectar Alejandra al pool cuando el modelo local esté preparado.
**PENDIENTE:** identificar qué pool/sistema es, su contrato, relación con la suite
y tarea de prueba. No se encuentra referencia en la documentación operativa/arquitectónica
revisada; se ha solicitado aclaración, sin inventar red, servicio o arquitectura.

Prueba propuesta una vez definido:
1. Mismo corpus sintético y rúbricas que proveedores remotos, con contexto equivalente.
2. Lecturas y tools simuladas, después entorno de prueba integrado con permisos reales.
3. Caso técnico representativo de una disciplina y un caso CAD con verificador geométrico.
4. Medir aciertos, abstenciones correctas, errores críticos, llamadas de herramientas,
   tiempo completo, memoria/cómputo y coste operativo; el modelo local tampoco cuesta cero.
5. Comprobar indisponibilidad/recuperación y política de derivación, sin afirmar éxito
   por una conexión HTTP correcta ni usar datos de producción como corpus improvisado.

No se programa una conexión ni se crea automatización hasta conocer el contrato y alcance.
