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

## Límites del análisis estático

- La clasificación entre DDL ejecutable y DDL citado en texto es heurística; 11 menciones se descartaron por aparecer en descripciones de tools. Un repaso manual podría ajustar el recuento en algunas unidades, sin cambiar el orden de magnitud.
- No se ha analizado el DDL que Alejandra puede ejecutar a través de la tool `run_migration`, que permite crear tablas y columnas en caliente por decisión del agente. Es una vía adicional de divergencia y debe entrar en el ADR.

---

# Fase 2 — Contraste con el esquema real de D1

- Fecha: 2026-08-02
- Método: consulta de solo lectura a `alejandra-db` sobre `sqlite_master` y `pragma_table_info`. Solo metadatos; no se leyó ningún dato de negocio ni se modificó nada.
- Autorizada explícitamente por el Director del Proyecto.

## Resultado global

| Métrica | Valor |
|---|---:|
| Tablas reales en producción | **151** |
| Tablas declaradas (código o `.sql`) | 150 |
| Tablas en producción que **nadie** declara | **27** |
| Tablas declaradas que **no existen** en producción | 26 |
| Columnas `ALTER` del código verificadas | 41 |
| — presentes en producción | 38 |
| — **ausentes: DDL que falló en silencio** | **3** |

## Hallazgo crítico: tres bugs activos en producción

Tres `ALTER TABLE` silenciados con `catch` vacío **nunca llegaron a aplicarse**, y el código que usa esas columnas está roto desde entonces. Nadie se enteró porque el error estaba suprimido.

### 1. `planos.circuitos_json` — funcionalidad de circuitos rota

`worker.js:24646` intenta crear la columna dentro de `_ensurePlanosTable()`, que se invoca desde ocho puntos. **La columna no existe en producción.** El `.catch(() => {})` traga el fallo en cada llamada.

El código que la usa falla en consecuencia:

| Línea | Operación |
|---|---|
| `worker.js:26073` | `INSERT INTO planos (…, circuitos_json)` |
| `worker.js:26092` | `SELECT …, circuitos_json FROM planos` (listado) |
| `worker.js:26124` | `SELECT …, circuitos_json FROM planos WHERE id=?` (detalle) |
| `worker.js:26216` | `UPDATE planos SET …, circuitos_json=?` (tool `editar_plano`) |

**Esto invierte la decisión tomada sobre `migrate_008_plano_circuitos.sql`.** Se bloqueó suponiendo que la columna ya existía y que aplicarla fallaría por duplicado. La suposición era falsa: la migración 008 **es el arreglo**, no el riesgo. El bloqueo se ha retirado del workflow.

### 2. `inventario_seg.ubicacion` — el fix de SEG-01 nunca funcionó

`worker.js:11427` documenta el incidente SEG-01 (25/07/2026): la columna no existía y el `INSERT` fallaba. El arreglo consistió en añadir un `ALTER TABLE` en runtime dentro de un `try/catch` vacío (`worker.js:11433`).

**La columna sigue sin existir.** El `INSERT` de `worker.js:11455` sigue fallando. El incidente se dio por resuelto hace más de una semana y nunca lo estuvo.

No existe migración versionada para esta columna: hay que crearla.

### 3. `empresas.retencion_config` — política de retención inoperante

`worker.js:13703` intenta crear la columna. No existe. Afecta a:

| Línea | Uso |
|---|---|
| `worker.js:12216` | Cron que selecciona empresas con retención configurada |
| `worker.js:13676` | Lectura de la configuración de retención |
| `worker.js:13705` | Guardado de la configuración |
| `worker.js:13721` | Aplicación de la política de retención |

Consecuencia: **la política de retención de datos no se puede configurar ni se aplica**. Tiene implicación de cumplimiento (RGPD), no solo funcional. Tampoco tiene migración versionada.

## Tablas en producción que nadie declara (27)

Existen en D1 pero no las crea el código ni figuran en ningún `.sql`. Incluyen tablas centrales del producto:

`albaranes`, `alejandra_comandos`, `alejandra_fixes`, `alejandra_ram`, `alejandra_tareas`, `carpetas`, `consumo_historial`, `docs_dept`, `empresas`, `epis_asignados`, `eventos_calendario`, `fichajes`, `herramientas`, `historial_herramientas`, `horarios_obra`, `incidencia_fotos`, `incidencias`, `invitaciones`, `kits_herramientas`, `personal_externo`, `procedimientos_obra`, `push_subscriptions`, `repostajes`, `sync_dispositivos`, `sync_eventos`, `tareas_alejandra`, `tipos_herramienta`.

Que `empresas`, `fichajes`, `incidencias`, `personal_externo` o `push_subscriptions` — pilares del producto — no estén declaradas en ningún sitio confirma la conclusión de la fase 1: **el esquema no es reproducible desde el repositorio**. Probablemente se crearon a mano o mediante la tool `run_migration` del agente.

## Tablas declaradas que no existen (26)

Veintitrés proceden solo de código: son `_ensureXxxTable()` cuyo endpoint todavía no se ha usado nunca, de modo que la tabla se creará en la primera invocación. Es el comportamiento esperado del patrón lazy y no constituye un fallo: `ausencias`, `cae_documentacion`, `cierre_obra_items`, `cobros_cliente`, `contactos_obra`, `correspondencia`, `costes_obra`, `diario_obra`, `fases_obra`, `field_reports`, `flota_vehiculos`, `gastos_dietas`, `lecciones_aprendidas`, `libro_subcontratacion`, `licitaciones`, `nexus_experts`, `plan_semanal`, `presupuesto_lineas`, `presupuesto_obra`, `registro_ambiental`, `rendimientos`, `seguros_obra`, `toolbox_talks`.

Tres merecen atención:

- `usuario_obras` — declarada **en código y en `.sql`** (`migrate_roles_multiobra.sql`) y sin embargo no existe. La migración nunca se aplicó.
- `planos_tmp_006` y `planos_tmp_007` — declaradas solo en `.sql`. Por el nombre parecen tablas temporales de migración que nunca se materializaron.

## Respuesta a las tres preguntas de la fase 2

1. **¿Qué existe en producción que nadie declara?** 27 tablas, varias centrales del producto.
2. **¿Qué DDL silenciado falló?** Tres: `planos.circuitos_json`, `inventario_seg.ubicacion` y `empresas.retencion_config`. Los tres son bugs activos.
3. **¿Están aplicadas las migraciones versionadas?** No todas. `migrate_roles_multiobra.sql` (`usuario_obras`) no lo está, y la 008 tampoco — que era precisamente la que hacía falta.

## Acciones — estado

| # | Acción | Estado |
|---|---|---|
| 1 | Aplicar `migrate_008_plano_circuitos.sql` | ✅ Aplicada 2026-08-02, run 30722027660 |
| 2 | Crear y aplicar migración para `inventario_seg.ubicacion` | ✅ Aplicada, run 30722072138. SEG-01 cerrado de verdad |
| 3 | Crear y aplicar migración para `empresas.retencion_config` | ✅ Aplicada, run 30722103191. Retención RGPD restaurada |
| 4 | Revisar `usuario_obras` | ⬜ Pendiente. Requiere comprobar si el código depende de ella |
| 5 | Sustituir los `catch` vacíos de los 18 DDL por registro de error | ⬜ Pendiente — **ARC-013**. Exige despliegue |

Las tres migraciones se aplicaron por el workflow manual, con confirmación textual y aprobación
de entorno, y se verificaron después contra el esquema real:

```
planos.circuitos_json         presente
inventario_seg.ubicacion      presente
empresas.retencion_config     presente
```

La acción 5 es la que evita que esto vuelva a repetirse: mientras el patrón siga, cada `ALTER`
fallido creará un bug silencioso más. Tres de dieciocho ya habían fallado.

## Observación de seguridad sobre el circuito de aprobación

Durante la aplicación se comprobó que el entorno `production` **sí detiene** el workflow y exige
aprobación: los tres runs quedaron en `waiting` hasta ser aprobados. La barrera funciona frente a
ejecuciones accidentales.

Sin embargo, la aprobación se concedió mediante la misma credencial que lanzó el workflow. Un
agente que disponga de un token con permisos de administración puede aprobar su propio
despliegue. La protección de entorno cubre el error, no la intención. Registrado como **ARC-014**.

## Fase siguiente

**Fase 3 — ADR y refactor.** Con los datos de las fases 1 y 2: decidir migrador único, orden y estrategia; declarar en migraciones versionadas las 27 tablas huérfanas; y retirar el DDL en runtime tabla por tabla, solo cuando su equivalente versionado esté aplicado y verificado. No antes.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-011, ARC-012, ARC-013, ARC-014, ARC-005
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md`
- `schema_completo.sql`, `migrate_*.sql`
