## ESTADO ACTUAL

**Sesion:** LIBRE
**Ultima sesion:** 05/07/2026 -- Fix errores consola panel.html + Google OAuth restaurado (commit 942bde3)
**Version actual:** App PWA **v7.55** -- commit 942bde3

---

## RESUMEN SESION 05/07/2026 (continuacion 10) -- Fix Google OAuth + errores consola panel.html

### Problema inicial
El login Google OAuth en panel.html habia dejado de funcionar. Causa: se habia cambiado
de enfoque popup (commit 2e8b72d) a redirect completo (commit 81f8f1d). El redirect
requeria que init() detectara el nonce al volver de Google, pero init() estaba en linea
15007, despues de donde crasheaba el bloque 1 (PAGE_LOADERS con ReferenceErrors y
SyntaxErrors).

### Fixes aplicados en sesiones anteriores (aun vigentes)
- commit 4f087c1: corregir _ocData duplicado, NCR_GRAV_COLOR duplicado, tblOC duplicado, lazy wrapper cargarGlobalDashboard
- commit 4baadab: 86 lazy wrappers en PAGE_LOADERS, fix ternario sin else en cargarRendimientos, _cpData -> _cpgData
- commit e587c52: cache-bust CDN GitHub Pages

### Resultado: Google OAuth funciona (verificado en vivo: Adrian - Super Admin logueado)

### Errores de consola corregidos en este commit (942bde3) -- v7.55
1. HEAD /verificar 404: checkConexion() usaba HEAD en /verificar (solo acepta POST)
   -> Cambiado a GET /health (endpoint correcto que siempre devuelve 200)
2. POST /webhook/evento 405: navTo() mandaba fetch('/webhook/evento') con URL relativa
   -> Iba a GitHub Pages (sin API). Eliminado ese bloque -- el worker no tiene ese endpoint
3. SW Cache TypeError: sw.js intentaba cachear peticiones HEAD y POST (Cache API no lo permite)
   -> Ahora solo cachea peticiones GET
4. DevTools DEV_ENDPOINTS: ['HEAD', '/verificar'] -> ['GET', '/health']

### Archivos modificados
- panel.html: checkConexion + navTo + DevTools
- sw.js: solo cachear GET + CACHE = alejandra-v7.55
- version.json: 7.55
- index.html: APP_VERSION = '7.55'
