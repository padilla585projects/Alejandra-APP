# OPERACION DEL PROYECTO

Guia rapida para ponerse operativo en este repo sin depender de memoria.

## 1) Arranque de sesion

1. `git pull`
2. `git status -sb`
3. `git log --oneline -3`
4. Leer `SESION.md`, `ESTADO_APP.txt`, `IDEAS_PENDIENTES.txt`
5. Marcar `SESION.md` como `EN CURSO` antes de editar codigo

## 2) Mapa de workers

- `worker.js` (raiz): `alejandra-app-api`
- `alejandra-agente/worker.js`: `alejandra-agente`

Regla de seguridad: si el cambio afecta permisos, tools o barreras, revisar ambos workers.

## 3) Herramientas locales necesarias

- Node.js 24+
- npm
- Wrangler 4.x

Comprobacion rapida:

```powershell
node -v
npm -v
npx wrangler --version
npx wrangler whoami
```

## 4) Credenciales y secretos

- Plantilla completa de variables: `.env.example`
- Valores reales: Cloudflare secrets de cada worker y GitHub Actions secrets
- Archivo local de referencia historica: `NUEVA_CUENTA.txt` (no usarlo como fuente unica)

Listar secretos configurados:

```powershell
npx wrangler secret list --name "alejandra-app-api"
npx wrangler secret list --name "alejandra-agente"
```

## 5) Pruebas y validaciones

- Tests del agente:

```powershell
# En alejandra-agente/
npm ci
npm test
```

- Health checks:

```powershell
curl.exe -s "https://alejandra-app-api.alejandra-app.workers.dev/health"
curl.exe -s "https://alejandra-agente.alejandra-app.workers.dev/health"
```

- Verificacion previa recomendada:

```powershell
.\pre_deploy_checks.ps1
```

## 6) Deploy

- Worker principal (raiz):

```powershell
npx wrangler deploy
```

- Worker agente:

```powershell
# En alejandra-agente/
npm test
npx wrangler deploy
```

Nota: ambos tienen CI en `.github/workflows/` que despliega al hacer push a `main`.

## 7) Cierre de sesion

1. Verificar sincronia de version (`version.json`, `sw.js`, `index.html`)
2. Verificar encoding corrupto:
   - `git diff -- "*.html" "*.js" | Select-String -Pattern "Ã|Â|â€|ï»¿"`
3. Commit/push
4. Dejar `SESION.md` en `LIBRE` con resumen
