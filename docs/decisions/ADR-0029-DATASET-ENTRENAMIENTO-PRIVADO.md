# ADR-0029 — Dataset de entrenamiento privado (turnos buenos anonimizados en R2)

- Identificador: ADR-0029
- Fecha: 2026-10-03
- Estado: **Aceptado — por el Director en chat el 03/10/2026** («Sí, guardado privado»)
- Decisores: Director del Proyecto (Adrián)
- Depende de: ADR-0028 (pool de IA propio: es el modelo que se quiere entrenar), ADR-0027
  (patrón `e<empresa>/` en R2 y escritura condicional por etag), ADR-0007 (borrados en R2 y
  aceptación de ADR son humanos), ADR-0013 (gobierno de memoria)
- Implementación: `alejandra-agente/dataset-entrenamiento.js` (E/S en R2),
  funciones puras en `alejandra-agente/lib.js` (`anonimizarTexto`, `anonimizarValor`,
  `esCorreccionUsuario`, `evaluarTurnoDataset`, `construirRegistroDataset`,
  `esClaveDatasetPrivada`), cableado en `alejandra-agente/worker.js`, pruebas en
  `alejandra-agente/dataset.test.js`, exportación manual en
  `scripts/ai-benchmark/exportar-dataset.mjs`

## Contexto

El pool de IA propio (ADR-0028) sirve hoy modelos genéricos (`alejandra:1.0` → qwen3.6). Para
que un modelo pequeño (LoRA sobre un 7–8B) haga bien el trabajo de Alejandra hacen falta
ejemplos reales del oficio: preguntas de obra, qué herramientas se llaman, con qué argumentos y
cómo se responde. Esos ejemplos solo existen en las conversaciones reales, que contienen datos
personales de trabajadores, clientes y obras.

Decisión del Director en chat (03/10/2026): acumular turnos reales **buenos** de Alejandra,
**anonimizados automáticamente**, en R2 **privado**, para entrenar más adelante. **Nunca** en el
repositorio (es público). **Exportar solo cuando él lo pida.**

## Decisión

1. **Apagado por defecto, con interruptor.** Solo funciona si el Worker `alejandra-agente`
   tiene la variable `DATASET_ENTRENAMIENTO` con el valor exacto `1`. Sin ella (o con cualquier
   otro valor) no se hace **ninguna** operación de R2 ni de D1: ni lectura, ni escritura, ni
   listado (cubierto por test). Es una variable de texto, no un secreto; la pone Adrián en el
   panel de Cloudflare (Workers → `alejandra-agente` → Settings → Variables). No va en
   `wrangler.toml` porque un bloque `[vars]` reemplaza en cada despliegue las variables del
   panel (mismo motivo que ADR-0028 §2).
2. **Solo R2, nunca D1** (incidente D1-ESCRITURAS-01: no se añade ninguna escritura D1 por
   petición). Mismo bucket del tenant (`FILES`), tres prefijos:

   | Prefijo | Qué es |
   |---|---|
   | `dataset/e<empresa>/pendiente/<usuario_hash>.json` | **Una ranura por usuario** con su último turno apto, a la espera de veredicto |
   | `dataset-bueno/e<empresa>/<aaaa-mm>/<aaaa-mm-dd>-<id>.json` | Turnos promovidos («buenos»): un registro JSON por objeto |
   | `dataset-cuota/e<empresa>/<aaaa-mm-dd>.json` | Contador diario por empresa (escritura condicional por etag, como ADR-0027) |

   El id de empresa va en la **ruta** (para poder atender un borrado por empresa, igual que
   ADR-0027); **dentro** del registro solo va `empresa_hash`.
3. **«Buen turno» diferido.** Al terminar un turno de `/api/chat/stream`:
   1. se resuelve la ranura pendiente del usuario **con su mensaje nuevo**: si es una corrección
      se **descarta**; si no, se **promueve** a `dataset-bueno/`;
   2. si el turno nuevo es apto y queda cupo, se escribe en la ranura.

   El cron horario del agente (6 veces al día) promueve las ranuras con **más de 6 horas** sin
   siguiente mensaje (máx. 5 listados y 50 promociones por ejecución). Una corrección que llega
   después de esas 6 horas ya no descarta (el turno se considera bueno).
   `/api/chat` (sin streaming) no captura turnos (no tiene traza de tools), pero su mensaje sí
   resuelve la ranura pendiente.
4. **Heurística de corrección** (`esCorreccionUsuario`, conservadora): el mensaje empieza por
   «no», «mal», «error», «incorrecto», «falso», «tampoco», «espera»…, o contiene «eso no», «no
   es así/eso/correcto», «te has equivocado», «te equivocas», «corrige», «rectifica», «está
   mal», «no funciona», «no me sirve», «no has guardado/hecho…», «te lo has inventado», «no
   existe», «otra vez mal», «que no»… Un falso positivo solo pierde un ejemplo.
5. **Turno apto** (`evaluarTurnoDataset`), todo a la vez:
   - sesión verificada (los anónimos `anon:` y la empresa `default` no entran) y no es el cron;
   - sin adjuntos en el mensaje (un turno que describe una foto que el dataset no tiene enseña
     a inventar);
   - ninguna tool rechazada, ninguna con error (`clasificarResultadoTool`), ninguna con barrera
     de confirmación pendiente (`CONFIRMO BORRADO`, `CONFIRMO ENVIO`, revisión N2) y ninguna
     que devolviera una imagen;
   - el turno no se cortó por tiempo, la verificación anti-confabulación no tuvo que corregir
     el texto, y la respuesta no está vacía ni es un mensaje de error;
   - no hubo búsqueda web previa al bucle (va al prompt, no es una `tool_call`: sin ella la
     respuesta parecería salir de la nada);
   - no es el saludo instantáneo por regex (no aporta nada).

   Cada registro es **un solo turno** (pregunta → tools → respuesta): no incluye el historial
   previo ni la memoria que el prompt real llevaba. Las respuestas que dependen de turnos
   anteriores quedan con menos contexto que el original; el filtrado fino se hará al preparar
   el entrenamiento.
6. **Límites.** Máximo **100 turnos capturados por empresa y día** (contador por etag; la
   primera escritura del día crea el contador sin condición, así que dos turnos simultáneos en
   ese instante pueden pasarse en uno). Registro máximo **64 KB**; mensaje del usuario recortado
   a 4 000 caracteres, respuestas a 6 000, cada resultado de tool a 2 000 y cada argumento a
   2 000. Lo que no cabe, no se guarda.
7. **Nunca se borra desde el código.** Descartar o vaciar una ranura es **sobrescribirla** con
   un marcador vacío (`{"estado":"descartado"|"promovido"}`): el registro anterior deja de
   existir, pero el código no llama nunca a `FILES.delete` (test). Borrar en R2 es humano.
8. **Acceso: solo Adrián, y solo fuera de la app.** Los tres prefijos no se sirven por
   `GET /files/<key>`, ninguna tool del agente los lee, escribe ni lista (ni siquiera con sesión
   de desarrollador), y `listar_archivos` los oculta (`esClaveDatasetPrivada`). Además los
   objetos no llevan `customMetadata.usuario_id`, así que el aislamiento por empresa ya los
   trataba como no accesibles. La única vía es `wrangler r2 object get` con la cuenta de
   Cloudflare de Adrián.
   - **Segundo cerebro (`worker.js`, Telegram):** no captura nada (el dataset es solo del
     agente). Sus tools `r2_list` (dev) y el listado del panel de desarrollador pueden ver los
     **nombres** de las claves (`dataset-bueno/e7/2026-10/…`), que no contienen datos
     personales; no hay ninguna ruta que lea su contenido sin comprobar la empresa dueña, y
     `r2_delete` sigue con su barrera humana. Se decide conscientemente no tocarlo.
9. **Exportación manual.** `scripts/ai-benchmark/exportar-dataset.mjs` lista y descarga con
   `wrangler r2 object get` (solo lectura) y junta un JSONL **fuera del repo** (por defecto en
   `%TEMP%`). Solo lo ejecuta Adrián cuando quiera entrenar. `.gitignore` excluye
   `dataset-alejandra*.jsonl`, `*.dataset.jsonl` y `dataset-export/` por si acaso.

### Formato del registro

Una línea JSONL estilo OpenAI por turno:

```json
{"messages":[
  {"role":"system","content":"Eres Alejandra, la asistente de una empresa instaladora … Experto: app. …"},
  {"role":"user","content":"¿Dónde está <PERSONA_2>?"},
  {"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"listar_personal","arguments":"{…}"}}]},
  {"role":"tool","tool_call_id":"call_1","content":"{…recortado y anonimizado…}"},
  {"role":"assistant","content":"<PERSONA_2> está en <OBRA_1>."}],
 "tools":[{"type":"function","function":{"name":"listar_personal","description":"…","parameters":{…}}}],
 "meta":{"experto":"app","modelo":"claude-sonnet-4-6","empresa_hash":"…","fecha":"2026-10-03","n_tools":1,"version":1}}
```

El `system` es un resumen fijo **sin datos de sesión** (ni usuario, ni empresa, ni fecha, ni
pantalla, ni memoria). `tools` lleva solo los esquemas de las tools usadas en el turno. Los ids
de llamada se renumeran (`call_1`, `call_2`…).

### Anonimización (determinista, antes de escribir en R2)

Se aplica al mensaje del usuario, a los textos del asistente, a los **argumentos** de las tools
y a sus **resultados** (recorriendo el JSON si lo es).

| Qué | Marcador |
|---|---|
| URLs completas (firmadas o no) | `<URL>` |
| Bearer, JWT, claves `sk-…`/`ghp_…`/`AIza…`, hex ≥32, cadenas tipo token ≥40, `password:`/`token=`… | `<TOKEN>` |
| Imágenes/binarios en línea (`data:…;base64,`) | `<BINARIO>` |
| Rutas del bucket (`chat_files/…`, `e<n>/…`, `fotos/…`, `informes/…`…) | `<ARCHIVO>` |
| Correo electrónico | `<EMAIL>` |
| IBAN (con o sin espacios/guiones) | `<IBAN>` |
| Tarjeta (16 dígitos en 4 grupos) | `<TARJETA>` |
| DNI (8 dígitos + letra) y NIE (X/Y/Z + 7 + letra) | `<DNI>` |
| CIF | `<CIF>` |
| Teléfonos españoles (+34/0034 opcional; 6xx, 7xx, 8xx, 9xx; con espacios, puntos o guiones) | `<TELEFONO>` |
| Matrículas (1234 BCD y antiguas M-1234-AB) | `<MATRICULA>` |
| Direcciones (calle, c/, avda., plaza, paseo, ctra., ronda, polígono… + nombre + número o s/n) | `<DIRECCION>` |
| Nombres de personas conocidos (nombre completo y cada palabra de ≥3 letras, sin tildes ni mayúsculas) | `<PERSONA_n>` (estable dentro del turno) |
| Nombres de obra | `<OBRA_n>` |
| Empresa, cliente, proveedor | `<EMPRESA>` |
| Claves `token`, `password`, `authorization`, `firma`… en argumentos/resultados | `<TOKEN>` |
| Claves `adjuntos`, `imagen`, `base64`… | `<ADJUNTO_ELIMINADO>` |

**De dónde salen los nombres** (sin ninguna consulta extra a D1): el nombre del usuario de la
sesión (ya cargado), y los que aparecen en los argumentos y resultados del propio turno bajo
claves de persona (`operario`, `encargado`, `responsable`, `trabajador`, `apellidos`,
`creado_por`… y `nombre` cuando el mismo objeto tiene `dni`/`telefono`/`email`/`rol`…), de obra
(`obra`, `nombre_obra`, `proyecto`…) o de empresa (`empresa`, `razon_social`, `cliente`,
`proveedor`…), y en texto plano con forma «Operario: Nombre Apellido» / «Obra: X». Se aprenden
de **todo** el turno antes de sustituir, así que un nombre que solo sale en un resultado se
sustituye también en la pregunta y en la respuesta.

**Lo que NO cubre** (riesgo residual, ver §Riesgos): nombres de personas que no aparecen en
ningún campo estructurado del turno ni son el usuario de la sesión (p. ej. «dile a Paco que…»
sin que ninguna tool devuelva a Paco); nombres de obra en texto libre sin la forma «Obra: X»;
códigos postales y ciudades; números de serie o de pedido que casualmente parezcan un teléfono
(se sustituyen de más, no de menos); datos personales dentro de PDF o fotos (no entran: los
turnos con adjuntos o imágenes se descartan enteros).

### Base legal y RGPD — **PENDIENTE de revisión legal de Adrián**

Esto **no** es asesoramiento legal; son los puntos que Adrián debe revisar (con asesoría si
hace falta) **antes de activar el interruptor** en producción:

- **Base jurídica.** Opciones: interés legítimo (art. 6.1.f RGPD: mejorar el servicio con datos
  seudonimizados, con prueba de ponderación documentada) o consentimiento (art. 6.1.a). Con
  clientes empresa, encaje probable como **encargado del tratamiento**: el contrato/DPA con
  cada empresa cliente debería permitir este uso secundario o hay que pedirlo. **PENDIENTE.**
- **Seudonimización, no anonimización plena.** Los hashes de empresa/usuario son de un id
  pequeño con sal fija en el código (repositorio público): son reversibles por fuerza bruta.
  El dataset sigue siendo **dato personal seudonimizado** a efectos del RGPD mientras quepa la
  reidentificación. Tratarlo como tal.
- **Informar a los usuarios.** Actualizar la política de privacidad / aviso en la app
  indicando que se guardan conversaciones seudonimizadas para mejorar el asistente, con
  derecho de oposición. **PENDIENTE.**
- **Derecho de supresión/oposición.** Atención por empresa (prefijo `e<empresa>/`) o, para un
  usuario concreto, por su ranura (`usuario_hash`); los registros promovidos no guardan el
  hash de usuario, así que un borrado selectivo por persona dentro de `dataset-bueno/` no es
  posible: hay que borrar la empresa entera o aceptar esa limitación. **PENDIENTE de decidir.**
- **Transferencias.** El entrenamiento se hará en el pool propio (en casa de Adrián, España).
  Si algún día se entrena fuera (nube de terceros), revisar transferencias internacionales.
- **Registro de actividades de tratamiento** y, si procede, **EIPD**. **PENDIENTE.**

### Retención y borrado

- Propuesta: **180 días** desde la fecha del registro. **No hay borrado automático**: el código
  nunca borra en R2 (ADR-0007). Adrián (u otro humano autorizado) ejecuta la retención con
  wrangler sobre `dataset-bueno/e*/<aaaa-mm>/` de meses antiguos y `dataset-cuota/`.
- **Borrado por empresa a petición**: lo ejecuta un humano sobre `dataset/e<empresa>/`,
  `dataset-bueno/e<empresa>/` y `dataset-cuota/e<empresa>/`.
- Si en el futuro se quiere una caducidad automática, es un ADR/enmienda nueva con decisión
  humana (como la de 30 días de ADR-0027).

## Alternativas descartadas

- **D1** (tabla de turnos): descartada por el incidente D1-ESCRITURAS-01 y por la deuda de
  esquema (ARC-011).
- **Guardar en `alejandra_historial` y exportar luego**: el historial no tiene la traza de tools
  ni el veredicto, y exportaría datos sin anonimizar fuera de Cloudflare.
- **Ranura por turno con id propio + borrado del pendiente al descartar**: exigiría borrar en
  R2 desde código o acumular pendientes huérfanos. La ranura única por usuario se sobrescribe y
  acota el almacenamiento a un objeto por usuario.
- **Workers KV** para la ranura: cupo de escrituras diario bajo en Workers Free; R2 tiene
  margen de sobra (clase A 1M/mes).

## Consecuencias

- Con el interruptor encendido, cada turno de streaming añade como máximo: 1 lectura de la
  ranura, 2 escrituras al promover (bueno + vaciado), 1 lectura y 1 escritura del contador y 1
  escritura de la ranura. Todo en `ctx.waitUntil`, después de responder: no añade latencia.
- Con el interruptor apagado (por defecto) el coste es una comprobación de variable.
- El turno de streaming lleva ahora un campo interno `_dataset` en su valor de retorno; no se
  envía al cliente (el evento `done` sigue mandando los mismos campos).

## Riesgos

- **Fuga por anonimización incompleta** (nombres libres, ver «Lo que NO cubre»). Mitigación:
  revisar una muestra del JSONL exportado antes de entrenar; el entrenamiento es local.
- **Falsos negativos de la heurística de corrección**: un «gracias» irónico o una corrección
  sin las palabras clave promueve un turno malo. Mitigación: filtrar después con un evaluador.
- **Sesgo**: solo entran turnos sin errores y sin adjuntos; el modelo verá pocos casos de
  recuperación ante fallos.

## Activación y verificación

1. Revisar la §Base legal (PENDIENTE).
2. Adrián añade `DATASET_ENTRENAMIENTO = 1` (texto) en el panel del Worker `alejandra-agente`.
   No requiere desplegar si el código ya está desplegado.
3. Verificar tras un par de turnos: `npx wrangler r2 object get alejandra-app-files/dataset/e<id>/pendiente/<hash>.json --remote`
   o `node scripts/ai-benchmark/exportar-dataset.mjs --listar`.
4. Apagar: borrar la variable o ponerla a `0`.
