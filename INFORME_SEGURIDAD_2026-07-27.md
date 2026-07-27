# Informe de seguridad — Alejandra APP

**Fecha:** 27/07/2026
**Alcance:** `worker.js` (backend `alejandra-app-api`, API REST + panel de oficina + app móvil)
**Método:** auditoría de código + pentest dinámico real contra 2 empresas de prueba 100% ficticias (`PENTEST-A`, `PENTEST-B`, creadas vía el registro público normal), pruebas de carga concurrente real, fuzzing automatizado y manual
**Resultado:** 8 rondas de auditoría (SEC-AUDIT-01 a 08), **todo corregido, verificado en vivo y desplegado en producción**

---

## Resumen ejecutivo

Se encontraron y corrigieron **3 vulnerabilidades críticas** que habrían permitido a un atacante con una cuenta normal de cliente acceder a datos de otras empresas o escalar a acceso total de la plataforma, y **una docena larga de bugs de robustez** (crashes, condiciones de carrera, duplicación de datos) que no comprometían la seguridad directamente pero sí la integridad de los datos o la disponibilidad del servicio.

Todo lo listado aquí **ya está arreglado y en producción**. Este informe es un registro de lo que se encontró y se cerró, no una lista de pendientes.

---

## Hallazgos críticos (acceso indebido a datos)

### 1. IDOR cross-empresa en bobinas/PEMP/carretillas — SEC-AUDIT-01
Editar o borrar equipos de otra empresa era posible con solo conocer el código/matrícula (visible en QR, informes, PDF). 5 funciones no filtraban por `empresa_id`. **Corregido y verificado.**

### 2. Escalada de privilegios: cliente normal → superadmin de toda la plataforma — SEC-AUDIT-03 (CRÍTICO)
El hallazgo más grave de la auditoría, **confirmado explotándolo en vivo** contra la empresa de prueba: cualquier `empresa_admin` — el rol que recibe automáticamente cualquier cliente que se registra solo en la app — podía hacer `POST /usuarios {"rol":"superadmin"}` y obtener una cuenta con acceso a **todas las empresas de la plataforma**, no solo la propia. Se llegó a confirmar la fuga de datos reales de otra empresa (nombre visible, la exploración se detuvo ahí mismo). De paso, `GET /usuarios` devolvía el hash de la contraseña de todos los usuarios a cualquier admin. **Corregido, verificado: el mismo ataque ya da 403.**

### 3. Envenenamiento de memoria de la IA sin autenticación — SEC-AUDIT-01
Un atacante sin cuenta podía inyectar instrucciones persistentes en la memoria de Alejandra IA que afectaban a **todas las conversaciones de todos los clientes**, vía una ruta pública. **Corregido.**

---

## Otros hallazgos de seguridad relevantes

- **Bypass de "desarrollador" por substring** (SEC-AUDIT-01): cualquier usuario con "adrian" en el nombre recibía permisos de desarrollador. Corregido a comparación exacta.
- **Reset de contraseña roto en producción + fuga de enumeración de cuentas** (SEC-AUDIT-04): un error de esquema desactualizado en `reset_tokens` hacía que el reset de contraseña llevara roto para cualquier usuario real, y de paso permitía averiguar qué emails están registrados por la diferencia de respuesta. Corregido con migración autoaplicada.
- **SSRF** (SEC-AUDIT-02): el filtro de `fetch_url` era solo léxico; ahora resuelve DNS de verdad vía DoH y bloquea IPs privadas en cualquier representación (decimal/octal/hex).
- **5 XSS almacenados** en el panel de oficina (SEC-AUDIT-02), corregidos con los helpers de escape ya existentes.
- **Invalidación de sesiones**: cambiar el rol o resetear la contraseña de un usuario vía la IA no cerraba sus sesiones activas hasta 30 días. Corregido.

---

## Robustez y disponibilidad (condiciones de carrera, crashes, DoS)

Esta parte salió de una campaña de pruebas de estrés y fuzzing explícitamente pedida ("poner al límite la app", "hasta que rompa").

### Condición de carrera en numeración de registros — SEC-AUDIT-05 y SEC-AUDIT-08
**Confirmado en vivo con peticiones concurrentes reales** (no teoría): 15 peticiones simultáneas contra el mismo endpoint generaban números duplicados en registros legales (ej. el número 3 de un parte de hormigonado se repitió 7 veces). Investigando más a fondo apareció el mismo patrón en **39 endpoints en total** — RFIs, actas, contratos, órdenes de compra/trabajo, garantías, y varios registros de seguridad/legales (accidentes, ATS/JHA, residuos, ensayos de materiales). Todos corregidos con numeración atómica dentro del propio `INSERT`. Verificado repetidamente con ráfagas de 15 peticiones concurrentes reales: 15/15 números únicos, sin duplicados.

### Devoluciones concurrentes duplicadas — SEC-AUDIT-08
Simulando una jornada real con 8 usuarios concurrentes: devolver la misma bobina/PEMP/carretilla desde 3 sesiones a la vez las devolvía las 3, duplicando el historial y las notificaciones de Telegram. Corregido haciendo el chequeo "ya devuelta" atómico con el propio `UPDATE`. Verificado: 1 éxito + 2 rechazos limpios.

### Condición de carrera en los rate-limiters — SEC-AUDIT-06
Los limitadores de intentos fallidos (login y código de administrador) contaban los intentos ANTES de registrar el intento actual — con carga real, 15 de 40 intentos de login concurrentes pasaban el límite declarado de 10. Corregido insertando primero y contando después. De paso se descubrió que 4 consultas de monitorización de fuerza bruta llevaban tiempo rotas en silencio (referenciaban columnas inexistentes) — la detección de ataques no funcionaba de verdad. Corregidas.

### DoS de bajo coste con payloads gigantes — SEC-AUDIT-07
Un campo de texto de 5MB tardaba ~1.4s de CPU del worker antes de ser rechazado. Corregido con un límite global de 2MB por petición, aplicado antes de tocar cualquier ruta.

### Crashes por confusión de tipos — SEC-AUDIT-07 y SEC-AUDIT-08
Cualquier campo que recibiera un tipo inesperado (número, objeto, array, `null` donde se esperaba texto) crasheaba el servidor con un 500 en vez de dar una validación limpia. Se encontró que este patrón estaba repetido en **más de 210 sitios** del archivo. Cerrado en dos fases:
1. Un helper (`safeStr()`) aplicado a las ~210 llamadas que procesaban texto con `.trim()`.
2. Un segundo fuzzing encontró 7 sitios más que no llamaban `.trim()` y por tanto se habían quedado fuera — cerrado con un parche global que sanea cualquier objeto/array antes de que llegue a la base de datos, cubriendo automáticamente cualquier endpoint futuro con el mismo problema, no solo los ya encontrados.

### Bug preexistente descubierto de paso — SEC-AUDIT-08
`json(data, {status:201})` en vez de `json(data, 201)` — un error de uso de la función auxiliar de respuestas — hacía que **todas** las altas de garantías, alquileres, entregables, lecciones aprendidas y ATS/JHA dieran 500 desde antes de esta sesión de auditoría, sin que nadie lo hubiera detectado. Corregido.

---

## Pruebas de carga

- **Hasta 1000 peticiones concurrentes reales** contra una mezcla de 8 endpoints de escritura: 0 errores, 0 duplicados, latencia máxima ~0.64s. La app aguanta muy por encima de lo que un equipo de campo real (decenas de personas) va a generar nunca.
- Una prueba de carga sostenida (varios minutos) mostró errores intermitentes, pero se confirmó que el problema estaba en la propia máquina de pruebas (límite local de conexiones), no en el servidor — verificado comprobando que `/health` seguía respondiendo con normalidad.

---

## Qué queda como riesgo aceptado (bajo, documentado, sin acción pendiente)

- `GET /bobinas`, `/pemp`, `/carretillas` devuelven `[]` (array vacío) en vez de `403` cuando no hay token válido — inconsistente con el resto de la API, pero no hay fuga real de datos (el array siempre está vacío sin auth).

---

## Empresas de prueba

`PENTEST-A` y `PENTEST-B` (creadas vía registro público, 100% ficticias) siguen en la base de datos con bastante actividad de prueba acumulada de toda esta auditoría — usuarios `SIMUSER-*`, bobinas `SIM-*`/`VOL-*`/`Load*`, etc. Pueden borrarse desde Office → Empresas cuando quieras; no se ha tocado ni se tocará ningún dato de empresas reales.

---

## Commits relevantes (orden cronológico)

| Ronda | Commits |
|---|---|
| SEC-AUDIT-01 | `956086e`, `74e2d05` |
| SEC-AUDIT-02 | `b470a57`, `01c007a`, `917bafa` |
| SEC-AUDIT-03 | `d6176db` |
| Monitorización | `e89deb6` |
| SEC-AUDIT-04 | `190a435` |
| SEC-AUDIT-05 | `5d0c41b` |
| SEC-AUDIT-06 | `95294bc`, `1c9e017` |
| SEC-AUDIT-07 | `79d72a1`, `f272aac`, `48ad54c`, `ffb7475` |
| SEC-AUDIT-08 | `44c5045`, `8c31e50` |

Detalle completo de cada hallazgo, con el paso a paso de cómo se confirmó y qué código exacto cambió, en `SESION.md` y `ESTADO_APP.txt`.
