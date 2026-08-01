# Inventario de DDL en tiempo de ejecución — ARC-011, fase 1

- Fecha: 2026-08-02
- Alcance: análisis estático de `worker.js` y `alejandra-agente/worker.js` contra los 25 ficheros `.sql` versionados
- Método: extracción automatizada, clasificación entre DDL ejecutable y DDL citado en textos, y contraste con `schema_completo.sql` y las 24 migraciones
- **No se ha consultado D1.** Todo lo que sigue procede de leer código. La comparación con el esquema real de producción es la fase 2 y requiere autorización.

## Resumen

| Métrica | Valor |
|---|---:|
| Sentencias DDL ejecutables desde código | **173** |
| — en `worker.js` | 147 |
| — en `alejandra-agente/worker.js` | 26 |
| Menciones en descripciones de tools o prompts (no ejecutables) | 11 |
| Tablas creadas desde código | **109** |
| Tablas declaradas en ficheros `.sql` | 45 |
| Columnas añadidas por `ALTER` desde código | 41 |
| Columnas `ALTER` en ficheros `.sql` | 18 |
| DDL con el error silenciado | **18** |

## Hallazgo principal

**105 de las 150 tablas del sistema existen únicamente porque el código las crea en caliente.** Ninguna migración versionada las declara.

Consecuencia directa: **el esquema de producción no se puede reconstruir desde el repositorio.** Si D1 se perdiera, restaurar el esquema exigiría levantar el Worker y provocar el paso por cada endpoint hasta que cada `_ensureXxxTable()` fuese creando su tabla. No existe orden, ni manifiesto, ni verificación.

`schema_completo.sql` no es completo: cubre menos de un tercio del esquema real. El nombre induce a error.

Esto convierte a ARC-011 en un riesgo de continuidad de negocio, no solo de gobierno técnico.

## Reparto del esquema

### Tablas que solo existen porque el código las crea (105)

Corresponden a los dominios incorporados después de la base original: obra, calidad, seguridad, compras, económico, documental y los propios de Alejandra.

`accidentes_incidentes`, `accion_items`, `actas_replanteo`, `actas_reunion`, `ai_usage`, `alejandra_conocimiento`, `alejandra_errores`, `alejandra_preguntas`, `alertas_config`, `alquileres`, `ats_jha`, `ausencias`, `auth_nonces`, `cae_documentacion`, `carnets`, `catalogo_precios`, `certificaciones`, `certificaciones_lineas`, `checklist_ejecuciones`, `checklist_plantillas`, `checklist_registros`, `checklists_plantillas`, `cierre_obra_items`, `cobros_cliente`, `comparativos_oferta`, `consumos_material`, `contactos_obra`, `contratos_amendments`, `contratos_obra`, `control_calidad`, `conversacion_resumen`, `correspondencia`, `costes_obra`, `cronograma_pagos`, `cubicaciones_obra`, `diario_obra`, `docs_notas`, `ensayos_materiales`, `entregables`, `entregas_material`, `equipos_medicion`, `escandallo_precios`, `escaneos_remotos`, `evaluaciones_proveedores`, `facturas_proveedor`, `fases_obra`, `field_reports`, `flota_vehiculos`, `flujo_caja`, `formacion_obra`, `fotos_obra`, `garantias`, `gastos_dietas`, `graficos`, `historial_mantenimientos`, `hitos_obra`, `instrucciones_obra`, `itp_items`, `itp_obra`, `lecciones_aprendidas`, `libro_subcontratacion`, `licencias_obra`, `licitaciones`, `login_attempts`, `materiales_obra`, `ncrs_obra`, `nexus_experts`, `normativa_index`, `obs_seguridad`, `oc_lineas`, `ordenes_cambio`, `ordenes_compra`, `ordenes_trabajo`, `partes_maquinaria`, `partes_trabajo`, `plan_semanal`, `planos_obra`, `precios_materiales`, `presupuesto_lineas`, `presupuesto_obra`, `proveedores_gestion`, `punch_list`, `rdp_registros`, `registro_ambiental`, `registro_hormigonado`, `rendimientos`, `reset_tokens`, `residuos_obra`, `rfis`, `riesgos_obra`, `seg_registro_comentarios`, `seg_registro_fotos`, `seg_registros`, `seguros_obra`, `solicitudes_cambio`, `solicitudes_material`, `subcontratas`, `submittals`, `tareas_obra`, `timesheets`, `toolbox_talks`, `transmittals_obra`, `turnos`, `vincular_tokens`, `visitas_obra`.

Nota: `checklist_plantillas` y `checklists_plantillas` coexisten, con y sin `s`. Conviene comprobar si son dos tablas reales o un error tipográfico que duplicó una.

### Tablas declaradas en `.sql` que el código no crea (41)

Son las del núcleo original y las del agente: `usuarios`, `obras`, `bobinas`, `pemp`, `carretillas`, `pedidos`, `proveedores`, `sesiones`, `archivos`, `documentos_obra`, `historial`, `logs`, `config`, `permisos_trabajo`, `inspecciones_seg`, `inventario_seg`, `movimientos_seg`, `epi_revisiones`, `reconocimientos_medicos`, `tipos_*`, `energias_carretilla`, `historial_carretillas`, `historial_pemp`, `sugerencias`, `telecom_*`, `alejandra_*`, `agente_config`, `chat_alejandra`, `planos_tmp_006`, `planos_tmp_007`.

Dependen por completo de que su migración se haya aplicado. Ninguna red de seguridad en runtime las recrearía.

### Tablas definidas en los dos sitios (4)

`alejandra_alert_cache`, `chat_mensajes`, `planos`, `usuario_obras`.

Doble fuente de verdad: las columnas pueden divergir entre el `.sql` y el `CREATE` del código sin que nada lo detecte.

## Columnas duplicadas

Una sola, y es la que ya conocíamos:

| Columna | Fichero `.sql` | Código |
|---|---|---|
| `planos.circuitos_json` | `alejandra-agente/migrate_008_plano_circuitos.sql` | `worker.js:24646` |

Confirma por análisis independiente la decisión de bloquear la migración 008: aplicarla fallaría por columna duplicada. Es el único caso de colisión directa; el resto de columnas añadidas desde código (40) no tienen equivalente versionado.

## DDL con el error silenciado (18)

Si cualquiera de estas sentencias falla, no queda rastro. Un fallo silencioso aquí produce el patrón ya visto en incidentes anteriores: consultas que fallan en producción contra columnas que nunca llegaron a crearse.

| Objeto | Ubicación | Supresión |
|---|---|---|
| `reset_tokens.usado` | `worker.js:6304` | catch vacío |
| `reset_tokens.empresa_id` | `worker.js:6305` | catch vacío |
| `login_attempts.email` | `worker.js:6429` | catch vacío |
| `inventario_seg.ubicacion` | `worker.js:11433` | try/catch vacío |
| `auth_nonces` | `worker.js:12494` | catch vacío |
| `empresas.retencion_config` | `worker.js:13703` | catch vacío |
| `partes_trabajo.updated_at` | `worker.js:14399` | try/catch vacío |
| `partes_trabajo.modificado_por` | `worker.js:14400` | try/catch vacío |
| `fotos_obra.ubicacion` | `worker.js:14763` | catch vacío |
| `fotos_obra.fecha_foto` | `worker.js:14764` | catch vacío |
| `escaneos_remotos.num_albaran` | `worker.js:15314` | try/catch vacío |
| `tareas_obra.departamento` | `worker.js:16116` | catch vacío |
| `rfis.departamento` | `worker.js:16317` | catch vacío |
| `actas_reunion.updated_at` | `worker.js:16563` | catch vacío |
| `actas_reunion.departamento` | `worker.js:16564` | catch vacío |
| `control_calidad.departamento` | `worker.js:16673` | catch vacío |
| `punch_list.departamento` | `worker.js:17300` | catch vacío |
| `planos.circuitos_json` | `worker.js:24646` | catch vacío |

Cinco de ellas son la misma columna `departamento` repetida en tablas distintas: corresponde a la incorporación del filtro por departamento y es el grupo con mayor probabilidad de haber quedado a medias en alguna tabla.

`partes_trabajo.updated_at` y `partes_trabajo.modificado_por` aparecen **dos veces cada una** en el código (líneas 14236-14238 y 14399-14400), lo que sugiere que la misma migración se reintrodujo sin advertir que ya existía.

## Límites de este inventario

- **No se ha comparado con D1 real.** Puede haber tablas o columnas en producción que ningún sitio declare, y DDL que lleve meses fallando en silencio sin que nadie lo sepa.
- La clasificación entre DDL ejecutable y DDL citado en texto es heurística; 11 menciones se descartaron por aparecer en descripciones de tools. Un repaso manual podría ajustar el recuento en algunas unidades, sin cambiar el orden de magnitud.
- No se ha analizado el DDL que Alejandra puede ejecutar a través de la tool `run_migration`, que permite crear tablas y columnas en caliente por decisión del agente. Es una vía adicional de divergencia y debe entrar en el ADR.

## Fase siguiente

**Fase 2 — contraste con D1 real.** Requiere autorización explícita para consulta de solo lectura. Objetivo: obtener el esquema efectivo y compararlo con este inventario para responder tres preguntas:

1. ¿Qué tablas y columnas existen en producción que no declara ni el código ni los `.sql`?
2. ¿Qué DDL silenciado ha fallado y dejado una columna sin crear?
3. ¿Están aplicadas las 24 migraciones versionadas, o alguna nunca llegó a ejecutarse?

**Fase 3 — ADR y refactor.** Con los datos anteriores: decidir migrador único, orden y estrategia; retirar el DDL en runtime tabla por tabla, solo cuando su equivalente versionado esté aplicado y verificado. No antes.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-011, ARC-005
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md` — migración 008 bloqueada
- `schema_completo.sql`, `migrate_*.sql`
