# ADR-0025 — Rediseño del Replanteo: cámara + sensores, catálogo real y previsualización de la instalación

- Identificador: ADR-0025
- Fecha: 2026-09-09
- Estado: **Aceptado** — aceptado por Adrián el 2026-09-09 (decisión humana, ADR-0007).
  Redactado tras varias sesiones de maqueta con Adrián ese mismo día.
- Decisores: Director del Proyecto
- Amplía / evoluciona: **ADR-0024** (Replanteo asistido por cámara — foto primero, AR después)
- Depende de: ADR-0007 (autonomía), ADR-0011 (migraciones por vertical), DEPT-01 (aislamiento
  por departamento)

## Contexto

Los replanteos actuales (ADR-0024: foto + marcar con el dedo + homografía) a Adrián **no le
convencen**: «no me gustan, no sé cómo se usan, es un lío». En varias sesiones de maqueta
(artifacts) se ha definido un flujo nuevo, más cercano a cómo se replantea en obra, y se ha
ampliado el catálogo con material real. Este ADR recoge ese rediseño. **No sustituye** el
modelo de datos de ADR-0024 (tablas `replanteos`/`replanteo_catalogo`, cálculo en backend,
trazado en JSON, pedido por `referencia REPL-<id>`): lo reutiliza y lo amplía.

Maquetas de referencia (artifacts, solo diseño): flujo completo
`89a001ad-9127-4dff-8594-4db6838072a9`; previsualización 3D/AR de la instalación
`e38cc365-eac9-4bda-a02e-1ac8f0c6376d`.

Restricción de hardware confirmada: el móvil de Adrián (Oppo Find X5 Pro) **no tiene LiDAR/ToF**
y por PWA no hay acceso a sensores de profundidad de ese tipo. Lo fiable en cualquier móvil es
**cámara + sensores de movimiento (giroscopio/acelerómetro/brújula, vía DeviceOrientation) +
calibración con una referencia conocida**. El AR anclado real (WebXR/ARCore) es Android y
frágil en tramos largos.

## Decisión

### 1. Flujo en obra (todo el cálculo en el móvil)
1. Cámara en directo (la pantalla es la cámara).
2. **Grabar y andar** el recorrido: el trazado se marca solo (camino, giros ~90°, obstáculos),
   con ayuda de los sensores (nivel, brújula, detección de giro). El usuario **confirma/ajusta**
   moviendo, añadiendo o borrando puntos (arrastrables).
3. **Calibración asistida:** la app **sugiere dónde medir** (señala una zona buena — baldosa,
   marco… — y coloca la referencia), el usuario la cuadra y fija la escala → medidas reales.
   Mantiene la prioridad de ADR-0024: plano rectificado > longitud conocida > escala.
4. **Previsualización de la instalación** (no una pieza suelta): la bandeja/tubo/canal completa
   con sus tramos y curvas, puesta sobre el espacio. **En directo** si el móvil admite AR
   (Android/ARCore, tocando se va marcando y se dibuja sola); **si no, se procesa después** desde
   el trazado grabado y se ve la misma previsualización 3D en cualquier dispositivo (visor
   three.js con geometría propia, sin ficheros externos).
5. **Material** calculado (reglas de ADR-0024) y **pedido** de lo que falte.
6. **Vídeo** del recorrido (máx. 3 min) como documentación.

### 2. Catálogo de material ampliado (con medidas seleccionables)
Añadir al catálogo por departamento (`REPLANTEO_CATALOGO_BASE`), distinguiendo bien los tipos:
- **Rejiband** (bandeja de rejilla, malla de varillas) — anchos 60–600 mm.
- **Bandeja de escalera** (dos largueros + travesaños, para grandes recorridos/cargas) — anchos
  **300–900 mm**. NO es Rejiband; error de nomenclatura corregido por Adrián.
- **Bandeja de chapa** — anchos 100–600 mm.
- **Tubo de acero** enchufable (Aiscan TME / Pemsa RL) — M16–M63, tramo 3 m, hueco.
- **Tubo de PVC** rígido (Aiscan/Gewiss/Unex) — M16–M63, tramo 3 m, hueco.
- **Tubo flexible** (corrugado reforzado) — Ø16–40, en rollo.
- **Canal PVC** — 40–150 mm.
Bandejas y tubos rígidos en **tramos de 3 m** (unidad de medida y de conteo).

En **tubo**, la app añade **cajas de registro** (sugiere la medida por el diámetro) con dos
tipos, que cambian el material:
- **Con tetones:** el tubo entra directo; solo cuenta las cajas.
- **Ciega:** hay que taladrar y poner **racores** → la app suma racores (2 por caja).

Precio y stock **no** entran en la primera fase (el material sale del cálculo geométrico, como
en ADR-0024). Engancharlos al almacén por departamento queda para fase posterior (hoy el stock
vive en `bobinas`/`inventario_seg`… sin precio unificado).

### 3. Edición por la oficina + botón «Actualizar replanteo» (reconciliación, opción A)
Hoy el backend **bloquea** el replanteo en cuanto se envía a Pedidos (`estado='pedido'` →
409 «crea uno nuevo»). Se **retira ese bloqueo**. La oficina (panel) puede **editar el
replanteo a mano**; el botón **«Actualizar replanteo»** recalcula el material y **reconcilia las
líneas `REPL-<id>` del pedido** con la regla acordada (**opción A**):
- Solo toca líneas en estado `pendiente` (añade nuevas, ajusta cantidades, borra sobrantes).
- Las líneas ya `recibidas` **no se tocan**; si el cambio afecta a una recibida, la diferencia
  se añade como línea nueva.
- Muestra el diff antes de aplicar («se añaden 2, se ajusta 1, se quita 1; 2 recibidas intactas»).

Edición manual de la oficina en el **panel**; el encargado desde el **móvil** crea y edita
mientras el replanteo no esté enviado.

### 4. Aislamiento por departamento (sin cambios, se refuerza)
Cada departamento tiene **su** replanteo. Replanteos, catálogo y pedidos van **solo** a su
departamento — nada de mezclar (DEPT-01, [[feedback-departamentos-independientes]]). El
departamento es **fijo por login** (`_replanteoDeptDe`), no elegible; el pedido va a Pedidos de
ese departamento (`tabForDept('pedido', dept)`). Ya se cumple en el backend.

### 5. Vídeo en R2 (hueco nuevo)
`replanteos` hoy solo guarda una imagen (`foto_r2_key`). Añadir soporte de **vídeo**: columna(s)
`video_r2_key` (+ mime/duración) vía DDL en caliente (patrón CPD/ADR-0011), aceptar `video/*`
en la subida (hoy solo imágenes), y endpoint `GET /replanteos/{id}/video`. ≤3 min; guardar en
local y subir cuando haya cobertura.

## Fases
- **F1 — Captura + catálogo (móvil):** selector de material nuevo (tipos + medidas + cajas de
  registro con/ciega + racores), cámara en directo, sensores (nivel/brújula/giros), calibración
  asistida. Material por cálculo (sin precio/stock). Guardar replanteo.
- **F2 — Pedido + reconciliación (opción A):** retirar el bloqueo, edición en el panel, botón
  «Actualizar replanteo» que reconcilia el pedido.
- **F3 — Vídeo a R2:** documentación del recorrido.
- **F4 — Previsualización de la instalación:** 3D del recorrido completo; en directo (AR Android)
  o procesada después desde el trazado. Amplía la fase 2 (AR) de ADR-0024.

## Qué no resuelve
- No mide sola sin referencia (no hay LiDAR por web).
- No reconoce material existente por visión.
- Precio/stock del almacén: fuera de F1.
- El AR anclado depende de Android/ARCore; el fallback es la previsualización procesada.

## Consecuencias
- **Beneficio:** flujo de obra completo y entendible — recorrer, ver la instalación, material y
  pedido a su departamento; reutiliza el backend existente.
- **Coste:** ampliar `REPLANTEO_CATALOGO_BASE`; columna(s) de vídeo en `replanteos` (aditivo);
  vídeos en R2. Retirar el candado de `estado='pedido'` y añadir la reconciliación de líneas.
- **Riesgo:** reconciliación del pedido si una línea ya está recibida → mitigado por la opción A
  (no tocar recibidas). Deriva del AR en tramos largos → mitigado por el fallback procesado.
- **Seguridad:** rutas ya con `getAuth` + filtro empresa/departamento; subida de vídeo con
  límite de tamaño y mime.
- **Pruebas:** sintaxis de Workers, tests del agente, verificación en la app publicada; prueba
  en dispositivo real (Oppo Android) para sensores y AR.

## Referencias
- ADR-0024 (base del replanteo), ADR-0007 (autonomía), ADR-0011 (migraciones por vertical).
- `worker.js`: `replanteos`/`replanteo_catalogo` (~30574), `REPLANTEO_CATALOGO_BASE` (~30472),
  `_replanteoAPedidos` (~31262), candado de edición (~31207), `crearPedido` (~10389).
- Maquetas (artifacts): `89a001ad-9127-4dff-8594-4db6838072a9`,
  `e38cc365-eac9-4bda-a02e-1ac8f0c6376d`.
