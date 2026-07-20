# Deployment Checklist — Usuarios de Prueba + Testing + v6.02

## Estado Actual
- **Rama:** main (limpia)
- **Versión:** v7.83 (última en ESTADO_APP.txt: 13/07/2026)
- **App:** Funcionando en producción
- **Worker:** Desplegado (SEC-15 sesion inválida → 401 uniforme)

## Tareas Paralelas (esperando confirmación)

### Agente 1: Filtros de departamento en worker.js
**Estado:** ⏳ EN CURSO o PENDIENTE DE CONFIRMACIÓN

Debe implementar:
- [ ] Validación de departamento en endpoints clave (GET /bobinas, GET /personal, etc.)
- [ ] Rechazo 403 si usuario intenta acceder a departamento no permitido
- [ ] Filtro implícito para no-admin (siempre usa su departamento de sesión)
- [ ] Admin puede ver otros departamentos (override seguro)

Archivos afectados: `worker.js`

### Agente 2: Acceso a panel + chat privado
**Estado:** ⏳ EN CURSO o PENDIENTE DE CONFIRMACIÓN

Debe implementar:
- [ ] Login panel.html con credenciales de prueba (María/Carlos)
- [ ] Chat privado en Alejandra (validar usuario_id de sesión)
- [ ] No reutilizar chat entre usuarios en dispositivos compartidos
- [ ] Limpieza de localStorage al logout

Archivos afectados: `panel.html`, `index.html` (si aplica)

---

## Ejecución Secuencial (una vez confirmado)

### PASO 1: Crear usuarios de prueba en D1

```powershell
# Alberto (id=46) — actualizar si existe
# María (nuevo) — crear si no existe
# Carlos (nuevo) — crear si no existe
npx wrangler d1 execute alejandra-db --command "..."
```

### PASO 2: Ejecutar test_seguridad.ps1

```powershell
.\test_seguridad.ps1 -Verbose
# Debe pasar:
# - [PASS] Alberto login
# - [PASS] Alberto solo ve eléctrico
# - [PASS] María login
# - [PASS] María solo ve eléctrico
# - [PASS] Carlos login
# - [PASS] Carlos solo ve seguridad
# - [PASS] Token inválido → 401
# - [PASS] Chat privado (sin fugas)
```

### PASO 3: Verificaciones pre-deploy

```powershell
.\pre_deploy_checks.ps1
# Verifica:
# - ✅ Encoding limpio
# - ✅ Versiones sincronizadas (json/sw.js/index.html)
# - ✅ Sintaxis JavaScript
# - ✅ Git status limpio
```

### PASO 4: Commit + Push

```powershell
git add worker.js panel.html index.html version.json
git commit -m "feat: usuarios de prueba + filtros departamento + chat privado — v6.02"
git push origin main
```

**Nota:** Cambiar versión de v7.83 a **v6.02** solo si esta es efectivamente una versión de testing/demostración. Si debería ser v7.84, ajustar en `version.json`.

### PASO 5: Deploy Worker

```powershell
npx wrangler deploy
# Verificar:
# - Version ID cambia (nuevo deploy)
# - Bindings DB y FILES presentes
# - Sin errores de validación
```

### PASO 6: Verificación en vivo

```powershell
# Token inválido → 401
curl -H "X-Token: invalid" https://alejandra-app-api.alejandra-app.workers.dev/bobinas
# → debe devolver 401

# Alberto acceso OK
curl -H "X-Token: $tokenAlberto" https://alejandra-app-api.alejandra-app.workers.dev/bobinas
# → debe devolver JSON con datos solo de eléctrico
```

### PASO 7: Limpiar usuarios/datos de prueba (si es ephemeral)

Opcionalmente, borrar de D1:
```sql
DELETE FROM usuarios WHERE email IN ('alberto@test.local', 'maria@test.local', 'carlos@test.local');
DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE '%@test.local');
```

---

## Checklist Final

- [ ] Agente 1 confirmó: filtros departamento implementados y testeados
- [ ] Agente 2 confirmó: acceso panel + chat privado implementados y testeados
- [ ] Usuarios de prueba creados en D1
- [ ] test_seguridad.ps1 pasa (8/8 tests)
- [ ] pre_deploy_checks.ps1 pasa (encoding, versiones, sintaxis, git)
- [ ] Git push exitoso (commit en origin/main)
- [ ] Worker desplegado (wrangler deploy sin errores)
- [ ] Curl manual verifica 401 en token inválido
- [ ] App en producción funciona con usuarios de prueba

---

## Rollback Plan (si es necesario)

Si algo falla en producción:
1. Identificar el commit problémico: `git log --oneline -5`
2. Revertir: `git revert <commit-hash>` (crea un nuevo commit)
3. Push: `git push origin main`
4. Deploy: `npx wrangler deploy`
5. Borrar usuarios de prueba de D1 si aplica

**Nunca hacer `git reset --hard`** (destructivo, puede perder trabajo).

---

## Notas

- Los usuarios de prueba pueden ser temporales o permanentes según decisión de Adrian
- El encoding corrupto preexistente en worker.js (`â€`) NO debe tocarse (regla de CLAUDE.md)
- Si hay cambios en otros archivos por los agentes paralelos, incluirlos en el commit con descripción clara
