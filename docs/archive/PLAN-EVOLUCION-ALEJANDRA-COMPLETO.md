# Plan completo — Evolución de conocimiento, razonamiento y observabilidad de Alejandra

## 1. Objetivo

Evolucionar la arquitectura de conocimiento y razonamiento del agente Alejandra sin rehacerlo ni reducir sus capacidades generales. Alejandra debe seguir siendo una ingeniera multidisciplinar capaz de responder, razonar, proponer soluciones, operar la aplicación y generar esquemas y planos.

La nueva arquitectura complementa al modelo con evidencia recuperable, herramientas de dominio, cálculos deterministas, reglas y verificación. No convierte a Alejandra en un sistema RAG limitado.

## 2. Contexto técnico

- Cloudflare Workers, D1 y R2.
- JavaScript vanilla.
- Frontend móvil PWA: `index.html`.
- Panel de oficina: `panel.html`.
- API principal: `worker.js`.
- Agente IA: `alejandra-agente/worker.js`.
- Funciones puras y pruebas: `alejandra-agente/lib.js` y `lib.test.js`.
- Anthropic Claude, con otros modelos como respaldo.
- Arquitectura multiempresa y multirrol.
- NEXUS: router de expertos, prompts modulares, herramientas, memoria, historial, cron y Service Binding al Worker principal.

## 3. Capacidades que Alejandra debe conservar y ampliar

Alejandra debe abarcar, como mínimo:

- electricidad industrial y edificios;
- baja y media tensión;
- cuadros, protecciones, cableado y puesta a tierra;
- fontanería, saneamiento y bombeo;
- climatización, ventilación y refrigeración;
- protección contra incendios;
- mecánica industrial;
- telecomunicaciones;
- obra civil;
- eficiencia energética y energías renovables;
- mantenimiento;
- planificación, costes y gestión de obra;
- prevención de riesgos laborales;
- documentación técnica y planos.

## 4. Política de respuesta

Alejandra puede responder desde conocimiento general del modelo cuando la consulta sea conceptual, no dependa de normativa concreta, no implique una decisión crítica, no necesite datos reales de empresa/obra y no requiera cálculos verificables.

Debe recuperar evidencia, usar herramientas y verificar cuando se solicite normativa, se cite una norma o artículo, exista riesgo para personas o instalaciones, se dimensione una instalación, se seleccionen equipos reales, se generen documentos o planos técnicos, se utilicen datos de obra o se ejecute una acción en la app.

No debe llamar a `buscar_conocimiento` para preguntas sencillas. Debe hacerlo cuando aporte precisión, trazabilidad o seguridad.

## 5. Principios y restricciones

- No romper funcionalidades existentes ni eliminar NEXUS.
- No modificar producción sin pruebas y revisión.
- No hacer un refactor masivo en un único commit.
- Implementar por fases pequeñas y reversibles.
- Mantener aislamiento por `empresa_id` y, cuando aplique, `obra_id`.
- Mantener compatibilidad con Cloudflare Workers.
- Añadir pruebas a cada componente nuevo.
- No introducir dependencias pesadas, servicios externos, vectores o bases de grafos sin justificar coste, complejidad y alternativa.
- Tratar documentos, OCR, recuperación y web como datos no confiables contra prompt injection.
- No guardar web, OCR o respuestas del modelo como conocimiento vigente automáticamente.
- Mantener autenticación, permisos y confirmaciones humanas para acciones críticas.
- No exponer secretos, prompts internos completos ni detalles sensibles.

## 6. Arquitectura objetivo

```text
Usuario / cron / evento
       ↓
trace_id
       ↓
Auth + sesión + Policy Engine
       ↓
Router NEXUS multidisciplinar
       ↓
Context Engine
 ├── sesión, permisos y obra
 ├── historial relevante
 ├── memoria scoped
 ├── conocimiento documental
 ├── conocimiento estructurado
 └── herramientas disponibles
       ↓
Planner / ejecución
 ├── herramientas semánticas
 ├── motor de reglas
 ├── cálculos deterministas
 ├── modelos descriptivos si existen datos
 └── generación de planos
       ↓
Verifier
 ├── permisos y propiedad
 ├── fuentes, autoridad y vigencia
 ├── cálculos y datos mínimos
 ├── contradicciones
 ├── acciones destructivas
 └── confirmación humana
       ↓
Respuesta / acción / plano
       ↓
Trazas, auditoría, métricas y evaluaciones
```

El modelo conserva el razonamiento general. La evidencia, reglas y cálculos se activan selectivamente.

## 7. Auditoría obligatoria antes de implementar

Antes de cada fase se debe revisar código real y no solo documentación. La auditoría debe localizar y documentar:

- módulos NEXUS y construcción de prompt;
- clasificación de expertos;
- definición y ejecución de tools;
- auth, sesión, permisos y aislamiento;
- memoria, historial y aprendizaje;
- consultas D1 y acceso R2;
- cron, tareas background y eventos;
- costes, logs, fallbacks y streaming;
- cálculos técnicos;
- generación, edición y almacenamiento de planos;
- migraciones, bindings y pruebas.

## 8. Separación de conocimiento

Los prompts deben mantener únicamente identidad, comportamiento, seguridad, autorización, política de herramientas, formato y protección contra prompt injection.

Debe extraerse progresivamente:

- normativa, legislación y artículos;
- tablas técnicas y criterios de cálculo;
- fichas de fabricante;
- procedimientos técnicos;
- recomendaciones de mantenimiento;
- conocimiento energético;
- pliegos, proyectos y decisiones de obra;
- experiencia histórica verificable.

Estructura objetivo sugerida:

```text
alejandra-agente/
  knowledge/
    repository.js
    authority.js
    retriever.js
    safety.js
  domain/
    electrical.js
    obra-state.js
  verification/
    evidence.js
    actions.js
  rules/
    registry.js
    engine.js
```

## 9. Modelo de conocimiento

Crear migraciones D1 versionadas para documentos, fragmentos, autoridad, ámbito y estados. El conocimiento puede ser:

- global oficial (`empresa_id = NULL`);
- privado de empresa;
- específico de obra.

Tipos mínimos:

- `normativa_oficial`;
- `norma_tecnica`;
- `fabricante`;
- `procedimiento_empresa`;
- `pliego_obra`;
- `proyecto`;
- `decision_obra`;
- `experiencia_historica`;
- `manual_equipo`;
- `conocimiento_general`.

Cada entrada debe incluir título, descripción, tipo, especialidad, organismo/fabricante, versión, publicación, vigencia, país/comunidad, URL, `r2_key`, estado, autoridad, hash, `empresa_id`, `obra_id`, creador, aprobador y fechas.

Jerarquía de precedencia:

1. normativa obligatoria vigente;
2. proyecto, pliego y contrato;
3. instrucción aprobada de dirección facultativa;
4. procedimiento interno aprobado;
5. fabricante oficial;
6. experiencia histórica;
7. memoria;
8. web no verificada.

Si hay contradicción, Alejandra debe explicarla y aplicar la fuente de mayor precedencia para ese ámbito.

## 10. Herramienta `buscar_conocimiento`

Contrato orientativo:

```json
{
  "consulta": "...",
  "especialidad": "electricidad",
  "tipos": ["normativa_oficial"],
  "empresa_id": 4,
  "obra_id": 17,
  "fecha_referencia": "2026-08-01",
  "limite": 8
}
```

Respuesta:

```json
{
  "resultados": [
    {
      "documento_id": 12,
      "titulo": "Documento",
      "tipo": "normativa_oficial",
      "especialidad": "electricidad",
      "seccion": "Apartado 4",
      "contenido": "Fragmento limitado y relevante",
      "fuente_url": "https://...",
      "version": "2026",
      "estado": "vigente",
      "nivel_autoridad": 100,
      "fecha_vigencia_desde": "2026-01-01",
      "pagina_inicio": 15,
      "pagina_fin": 16,
      "score": 0.91
    }
  ],
  "contradicciones": [],
  "advertencias": []
}
```

Debe filtrar por ámbito, comprobar vigencia, priorizar autoridad, devolver evidencia limitada y envolver el contenido como no confiable. La primera versión usará búsqueda léxica D1; embeddings/vectorización se evaluarán después con corpus y necesidades reales.

## 11. Memoria

Separar visual y lógicamente:

- memoria personal: preferencias de usuario;
- memoria operativa: decisiones estables de empresa/obra;
- memoria temporal: observaciones caducables;
- propuestas de memoria;
- contenido rechazado o caducado.

Cada memoria debe incluir propietario, empresa, obra, fuente, confianza, estado de validación, creación y caducidad. `memory_save` no podrá convertir contenido web o normativo no verificado en conocimiento permanente.

## 12. Herramientas semánticas y SQL

Mantener `consultar_bd` y `escribir_bd` inicialmente para desarrollador verificado, diagnóstico e interacciones explícitas. Introducir herramientas de dominio gradualmente:

- `obtener_personal_activo`;
- `buscar_persona_por_nombre`;
- `obtener_fichajes_dia`;
- `registrar_ausencia`;
- `registrar_presencia`;
- `obtener_stock_bobinas`;
- `obtener_equipos_revision`;
- `obtener_incidencias_abiertas`;
- `obtener_documentos_vigentes`;
- `obtener_costes_obra`;
- `obtener_desviacion_presupuesto`;
- `obtener_estado_planificacion`;
- `obtener_materiales_pendientes`.

Cada tool debe usar SQL probado, parametrizado, con scope, permisos, JSON estable, tests y errores observables.

## 13. Cálculos y perfiles técnicos

Crear perfiles para eléctrico, fontanería, saneamiento, climatización, mecánica, PCI, telecomunicaciones, energía, PRL, planificación, costes y documentación técnica.

Preparar contratos para:

- `calcular_linea_electrica`;
- `calcular_caida_tension`;
- `seleccionar_proteccion`;
- `calcular_cortocircuito`;
- `dimensionar_tuberia`;
- `calcular_perdida_carga`;
- `seleccionar_bomba`;
- `calcular_carga_termica`;
- `dimensionar_conducto`;
- `calcular_caudal_ventilacion`;
- `seleccionar_equipo_climatizacion`;
- `validar_plano_tecnico`.

El LLM coordina y explica; no inventa resultados. La primera implementación debe auditar y adaptar los cálculos eléctricos existentes antes de ampliar disciplinas.

## 14. Estado consolidado de obra y reglas

Crear `obtener_estado_obra({ obra_id })`, calculado bajo demanda y con caché breve solo si aporta valor. Debe incluir fase, avance, desviaciones, personal, incidencias, materiales críticos, equipos, documentos, decisiones y riesgos.

Crear reglas explícitas y reproducibles, por ejemplo:

- revisión vencida → equipo no asignable;
- avance real bajo previsto → alerta;
- reconocimiento caducado + trabajo en altura → bloquear asignación.

No crear un lenguaje de reglas complejo en la primera versión.

## 15. Verificador y evidencia

Toda conclusión técnica relevante debe tener representación interna de:

- conclusión;
- datos utilizados;
- fuentes;
- supuestos;
- contradicciones;
- confianza;
- datos faltantes;
- acción recomendada.

El verificador comprueba auth, rol, empresa, obra, propiedad, vigencia, contradicciones, coherencia de cálculo, parámetros obligatorios, acciones destructivas y confirmación humana. Priorizar lógica determinista.

## 16. Planos técnicos

Alejandra debe seguir generando y mejorando planos. El SVG deja de ser la única fuente de verdad.

Crear modelo intermedio JSON versionado con:

- tipo;
- elementos;
- conexiones;
- propiedades técnicas;
- posiciones;
- capas;
- leyenda;
- referencias;
- supuestos;
- estado de validez;
- revisión.

Salidas derivadas: SVG editable, HTML/SVG, PDF y DXF posterior si es viable.

Tipos iniciales previstos:

- unifilar eléctrico;
- cuadro eléctrico;
- bandejas;
- fontanería;
- saneamiento;
- bombeo;
- hidráulico de climatización;
- conductos;
- proceso;
- layout industrial conceptual.

La primera cobertura estructurada se limita a unifilar, eléctrico y bandejas. Los contratos de hidráulica, saneamiento y HVAC se reservan sin afirmar validación técnica hasta implementar cálculos.

Estados:

```text
conceptual → preliminar → calculado → pendiente_revision → validado → aprobado
```

Alejandra puede generar conceptual y preliminar. `calculado` requiere cálculo determinista. `validado` y `aprobado` requieren autoridad humana. El usuario confirma antes de guardar; cada modificación crea revisión y no sobrescribe silenciosamente.

## 17. Eventos y energía

Diseñar, sin completar todavía, eventos como `ausencia_registrada`, `material_recibido`, `documento_subido`, `plano_actualizado`, `revision_caducada`, `incidencia_creada` y `presupuesto_modificado`.

Preparar herramientas energéticas futuras sin modelos ficticios: estadística descriptiva, medias móviles, umbrales y cálculos deterministas antes que predicción avanzada.

## 18. Evaluaciones

Crear suites JSON para normativa, herramientas, permisos, planificación, costes, energía, seguridad y contradicciones.

Evaluar selección de tool, permisos, evidencia, datos faltantes, ausencia de alucinaciones, cálculos, prompt injection, aislamiento entre empresas y contradicciones.

## 19. Cerebro de Alejandra

Futura pestaña dentro de DevTools de `panel.html`, exclusiva para `superadmin` y `desarrollador`, siempre validada en backend.

Secciones:

1. resumen;
2. observabilidad y diagnóstico;
3. Grafo Nexo;
4. inspector de nodo;
5. memoria;
6. conocimiento;
7. contexto de respuesta;
8. herramientas;
9. evaluaciones;
10. costes y rendimiento.

No permitirá SQL directo.

### Grafo Nexo

No será una base de grafos separada. D1 sigue siendo fuente de verdad y el grafo es una proyección navegable.

Entidades: notas, documentos, normas, fabricantes, productos, empresas, obras, planos, cálculos, incidencias, decisiones, equipos, personas, materiales y tareas.

Relaciones: confirmadas, sugeridas, obsoletas o contradictorias. Debe permitir búsqueda, filtros, backlinks, fuente, vigencia, profundidad controlada, relaciones directas, impacto y tabla alternativa.

No cargar el grafo completo. Iniciar desde nodo/búsqueda, cargar como máximo 25 relaciones, usar cursor, profundidad inicial máxima 2 y vista tabla para grafos grandes.

### Inspector

Mostrar título, tipo, ámbito, empresa, obra, versión, estado, autoridad, confianza, vigencia, fuente, aprobador, relaciones, contradicciones e historial.

Acciones controladas: aprobar, rechazar, obsoleto, revisión, fusión de duplicados, alias, aprobación de relaciones, recalcular índices y verificar. Las mutaciones requieren confirmación y auditoría.

### Librería visual

Evaluar Cytoscape.js primero por compatibilidad con JavaScript puro, layouts y licencia MIT. Cargar bajo demanda solo dentro de DevTools. Evaluar Sigma.js si pruebas reales requieren más escala. No fijar dependencia antes de prototipo y medición de bundle.

## 20. Observabilidad y diagnóstico

Cada petición, cron, evento y tarea background recibirá `trace_id`; cada operación tendrá `span_id` y `parent_span_id` opcional.

Propagación:

```text
entrada → auth → sesión → router → contexto → memoria → conocimiento → tools
→ D1/R2 → modelo → fallback → verifier → respuesta → notificaciones
→ historial → cron/eventos → planos → evaluaciones
```

Evento estructurado orientativo:

```json
{
  "trace_id": "tr_...",
  "span_id": "sp_...",
  "parent_span_id": "sp_...",
  "timestamp": "...",
  "nivel": "info",
  "componente": "nexus_router",
  "evento": "experto_seleccionado",
  "usuario_id": "35",
  "empresa_id": 4,
  "obra_id": 17,
  "canal": "panel",
  "duracion_ms": 42,
  "resultado": "ok",
  "metadata": {}
}
```

Niveles: `debug`, `info`, `warning`, `error`, `critical`.

Registrar petición, auth, sesión, experto, módulos, memoria, conocimiento, entidades, tools permitidas/solicitadas/ejecutadas/fallidas, D1, R2, modelo, fallback, verifier, contradicciones, confirmación, respuesta, historial, notificaciones y error final.

No confundir “sin datos” con “consulta fallida”. Los fallos recuperables deben conservar el error, impacto, fallback y degradación enviada al usuario.

### Trazas y auditoría

Tablas futuras:

```text
trazas
traza_eventos
auditoria_acciones
```

`trazas` resume cada petición; `traza_eventos` forma la línea temporal; `auditoria_acciones` guarda cambios de negocio y administración con actor, antes/después saneado, motivo y `trace_id`.

Sanitizar siempre API keys, tokens, cookies, passwords, Authorization, PII innecesaria, contenido de archivos, prompts completos y SQL/parámetros sensibles. Para SQL, guardar operación, tablas, hash, duración y filas afectadas.

Retención inicial orientativa, pendiente de volumen y requisitos legales:

- debug: 7 días;
- info: 30 días;
- warning/error: 90 días;
- auditoría crítica: configurable, propuesta mínima 1 año.

Métricas: éxito/error por tool, experto y modelo; latencia media y percentiles; tokens, coste, contexto, fallbacks, respuestas vacías, consultas sin resultado/fallidas, D1/R2, permisos, aislamiento, memoria, contradicciones, verificador y cron.

Alertas: respuestas vacías, error alto de tool, latencia/coste anómalo, fallos D1/R2, aislamiento/permisos, fallback excesivo, cron ausente, memoria contaminada y fallo del verificador.

Preparar `reproducir_traza` en simulación: misma entrada y contexto equivalente, tools mock o de solo lectura, sin escrituras, notificaciones, despliegues ni acciones destructivas. Una traza fallida puede convertirse en evaluación anonimizada.

## 21. Orden de implementación

1. Auditoría y diseño.
2. PR 1: barreras P0/P1 de seguridad.
3. PR 2: modelo canónico de conocimiento.
4. PR 3: `buscar_conocimiento`.
5. PR 4: policy y router NEXUS multidisciplinar.
6. PR 5: memoria separada.
7. PR 6: evidencia y cálculos eléctricos.
8. PR 7: modelo intermedio y revisiones de planos.
9. PR 8: tools semánticas y reducción gradual de SQL libre.
10. PR 9: estado de obra y reglas.
11. PR 10: verificador y evaluaciones.
12. PR 11A: trace/span, sanitización y eventos estructurados.
13. PR 11B: propagación por chat, tools, D1/R2, cron y Service Binding.
14. PR 11C: retención, métricas y alertas.
15. PR 11D: endpoints y línea temporal DevTools.
16. PR 11E: inspector de fallo, reproducción y conversión a eval.
17. PR 12: entidades, relaciones, historial y contradicciones del Nexo.
18. PR 13: API administrativa del Cerebro.
19. PR 14: interfaz Cerebro para resumen, memoria, conocimiento, herramientas y tablas.
20. PR 15: grafo progresivo e inspector de nodo.
21. PR 16: aprobaciones, impacto y visualización de evaluaciones.

## 22. Criterios comunes de aceptación

- Tests existentes siguen pasando y se añaden tests nuevos.
- No hay fuga cross-tenant.
- No se expone contenido sensible.
- No se despliega automáticamente.
- Migraciones aditivas, versionadas y revisables.
- Cada PR documenta alcance, riesgos, archivos, pruebas, compatibilidad, rollback y limitaciones.
- Ningún plano conceptual se presenta como aprobado.
- Si falta evidencia suficiente, Alejandra lo declara.
- El sistema no guarda automáticamente respuesta, web u OCR como conocimiento permanente.

## 23. Decisiones pendientes

1. Autorizar PR 1 como corrección previa de seguridad.
2. Elegir corpus inicial: normativa REBT, PRL, fabricante, procedimiento de empresa y pliego de obra.
3. Confirmar España como jurisdicción por defecto, con país/comunidad cuando aplique.
4. Confirmar primera cobertura de planos estructurados: unifilar, eléctrico y bandejas.
5. Mantener `superadmin` como aprobador técnico inicial hasta introducir permisos específicos.
6. Definir retención definitiva después de medir volumen de trazas.
