# ADR-0021: Nexo v1 — Capa de integración con fuentes externas

## Status

Accepted

## Date

2026-08-06

## Context

### Problem Statement

ADR-0008 definió Nexo como **capa de integración con sistemas externos** (interpretación A), no como orquestador ni motor de decisión. F-2.2 del roadmap pide definir e implementar un piloto vertical de Nexo como "extensión aditiva de tools existentes".

Hoy existen tools aisladas que ya tocan fuentes externas (`buscar_precios` → Gemini+Google, `buscar_normativa` → índice local, `buscar_google`/`buscar_web` → búsqueda general, `fetch_url` → HTTP directo), pero sin contrato común, sin registro de fuentes, sin métricas de frescura ni-fiabilidad, y sin coordinación entre sí. Cada tool reinventa caché, formato de retorno y manejo de errores.

### Constraints

- Nexo NO decide: enriquece contexto, no ejecuta acciones autonomously
- NO orquesta módulos entre sí (eso es NEXUS/ADR-0004)
- NO es multiagente (eso es Época 6)
- Reversible: cada integración se puede desactivar sin romper el resto
- Aislamiento por empresa: los resultados respetan el tenant activo
- ADR-0010 (catálogo de tools) se aplica: cada conector es una tool con metadato
- ADR-0006 (matriz de riesgo): integraciones externas = N0 (solo lectura, enriquecimiento)

### Requirements

1. Contrato común para conectores de fuentes externas (input/output/caché/frescura)
2. Registro de fuentes con metadato (nombre, tipo, fiabilidad, TTL de caché, ámbito)
3. Piloto vertical: normativa eléctrica (REBT/ITC-BT) + precios de materiales
4. Coordinación simple: cuando `buscar_normativa` no encuentra, sugerir `buscar_web` automáticamente
5. Métricas básicas: tasa de acierto, latencia, uso por empresa
6. Integración con trazas (ADR-0014): cada consulta externa registra `tipo='nexo_consulta'`

## Decision

### Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  NEXUS Router                    │
│         (selecciona experto, arma prompt)        │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│              Motor de Decisión (ADR-0004)        │
│         (evalúa riesgo N0-N3, gates)            │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│               Tools existentes                   │
│  buscar_normativa | buscar_precios | fetch_url   │
│  buscar_google    | consultar_conocimiento       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│            NEXO — Capa de Integración            │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │  Registro    │ │  Contrato    │ │  Métricas │ │
│  │  de Fuentes  │ │  de Conector │ │  y Cache  │ │
│  └─────────────┘ └──────────────┘ └───────────┘ │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│          Fuentes Externas                        │
│  REBT/ITC-BT | Google/Gemini | Fabricantes       │
│  Normativa   | Precios       | Catálogos         │
└─────────────────────────────────────────────────┘
```

### Componentes

#### 1. `nexo-fuentes.js` — Registro de fuentes (nuevo, en `alejandra-agente/`)

```javascript
// Cada fuente declara: id, nombre, tipo, fiabilidad, TTL, ámbito, conector
const FUENTES_NEXO = {
  normativa_rebt: {
    id: 'normativa_rebt',
    nombre: 'REBT/ITC-BT (índice local)',
    tipo: 'normativa',
    fiabilidad: 'alta',    // fuente oficial indexada
    ttl_horas: 168,        // 7 días
    ambito: 'españa',
    conector: 'buscar_normativa',
    fallback: 'buscar_web',
  },
  precios_distribuidores: {
    id: 'precios_distribuidores',
    nombre: 'Precios de distribuidores eléctricos',
    tipo: 'precios',
    fiabilidad: 'media',   // scraping, puede cambiar
    ttl_horas: 168,        // 7 días
    ambito: 'españa',
    conector: 'buscar_precios',
    fallback: null,
  },
  web_general: {
    id: 'web_general',
    nombre: 'Búsqueda web general (Google/Gemini)',
    tipo: 'general',
    fiabilidad: 'variable',
    ttl_horas: 24,
    ambito: 'global',
    conector: 'buscar_google',
    fallback: null,
  },
};
```

#### 2. Contrato de conector (extiende ADR-0010)

Cada conector Nexo expone metadato adicional al catálogo de tools:

```javascript
// En la tool existente, se añade campo `nexo`:
{
  name: 'buscar_normativa',
  // ... campos existentes de ADR-0010 ...
  nexo: {
    fuenteId: 'normativa_rebt',
    tipo: 'local_index',    // local_index | api | scraping | hybrid
    fallback: 'buscar_web',
    registraTraza: true,    // ADR-0014: registrar tipo='nexo_consulta'
  }
}
```

#### 3. `registrarNexoConsulta()` — Métricas (extiende ADR-0014)

```javascript
async function registrarNexoConsulta(env, { fuenteId, empresaId, usuarioId, consulta, resultados_count, latencia_ms, cache_hit }) {
  await registrarTraza(env, {
    tipo: 'nexo_consulta',
    empresaId,
    usuarioId,
    resumen: `Nexo: ${fuenteId} → ${resultados_count} resultados (${latencia_ms}ms, cache:${cache_hit})`,
    detalle: { fuenteId, consulta, resultados_count, latencia_ms, cache_hit },
  });
}
```

#### 4. Coordinación fallback (nuevo patrón)

Cuando `buscar_normativa` devuelve 0 resultados, el conector sugiere automáticamente al modelo usar `buscar_web`:

```javascript
// En el case 'buscar_normativa', al final:
if (resultados.length === 0) {
  return JSON.stringify({
    ok: true, resultados: [], 
    mensaje: `No encontré normativa local para "${consulta}".`,
    sugerencia: 'buscar_web',  // hint para que el modelo continúe
  });
}
```

### Vertical Piloto: Normativa + Precios

Las dos tools existentes se convierten en conectores Nexo v1:

| Tool | Fuente | Cambio principal |
|---|---|---|
| `buscar_normativa` | REBT/ITC-BT local | Añadir `nexo` metadata + `sugerencia` fallback + traza |
| `buscar_precios` | Gemini+Google | Añadir `nexo` metadata + traza + métricas de cache |

No se crea una tool nueva "nexo_buscar" — se evolucionan las existentes. Esto es consistente con ADR-0008 ("extensión aditiva de tools existentes").

### Cambios en `nucleo-cognitivo/`

Añadir `nucleo-cognitivo/src/nexo.js` como interfaz (mismo patrón que `memory.js`):

```javascript
// Interfaz pura, sin implementación real (se inyecta desde el Worker)
export function crearNexo(fuentes, registrarConsulta) {
  return {
    buscar(fuenteId, params) { ... },
    listarFuentes() { ... },
    estadisticas(fuenteId) { ... },
  };
}
```

### Tabla D1: `nexo_fuentes_telemetria`

```sql
CREATE TABLE IF NOT EXISTS nexo_fuentes_telemetria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fuente_id     TEXT NOT NULL,
  empresa_id    TEXT,
  usuario_id    TEXT,
  consulta      TEXT,
  resultados    INTEGER DEFAULT 0,
  latencia_ms   INTEGER DEFAULT 0,
  cache_hit     INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nexo_telemetria_fuente ON nexo_fuentes_telemetria(fuente_id);
CREATE INDEX IF NOT EXISTS idx_nexo_telemetria_empresa ON nexo_fuentes_telemetria(empresa_id);
```

## Alternatives Considered

### Alternative 1: Tool nueva "nexo_buscar" unificada
- **Description**: Una sola tool que enruta a la fuente correcta según la consulta
- **Pros**: Interfaz simple para el modelo
- **Cons**: Acoplamiento excesivo; el modelo ya sabe qué tool usar (`buscar_normativa` para normativa, `buscar_precios` para precios); crear un wrapper añade latencia y complejidad sin beneficio real en v1
- **Rejection Reason**: Innecesario cuando las tools existentes ya funcionan; v1 debe ser aditivo, no reemplazante

### Alternative 2: Middleware de enriquecimiento automático
- **Description**: Interceptar cada respuesta del modelo y buscar automáticamente fuentes externas relevantes
- **Pros**: Transparente para el modelo
- **Cons**: Complejidad alta; riesgo de consultas innecesarias; viola el principio de que el modelo decide qué tool invocar; coste de tokens impredecible
- **Rejection Reason**: Contradice ADR-0004 (el modelo decide) y ADR-0006 (riesgo N0 = modelo explícito)

### Alternative 3: Solo métricas, sin cambio de código
- **Description**: Añadir traza a las tools existentes sin crear registro de fuentes ni contrato
- **Pros**: Mínimo esfuerzo
- **Cons**: No resuelve el problema de fondo (sin contrato, cada nueva integración sigue siendo ad-hoc); no habilita coordinación ni fallback
- **Rejection Reason**: No cumple el objetivo de F-2.2 ("definir e implementar coordinación entre fuentes")

## Consequences

### Positive

- Cada nueva fuente externa se integra siguiendo un contrato claro (registry pattern)
- Las tools existentes evolucionan sin romper compatibilidad
- Métricas reales de uso de fuentes externas por primera vez
- Fallback coordinado: normativa local → web general, sin intervención humana
- Trazabilidad completa de consultas externas (ADR-0014)
- Prepara el terreno para fuentes futuras (fabricantes, bases de datos sectoriales)

### Negative

- Añade un archivo nuevo (`nexo-fuentes.js`) que hay que mantener
- Las tools existentes necesitan un campo `nexo` adicional (cambio menor)
- La tabla `nexo_fuentes_telemetria` acumula datos (mitigado con purge similar al de `alejandra_trazas`)

### Risks

| Riesgo | Mitigación |
|---|---|
| Complejidad innecesaria para v1 | Mantener mínimo: registro + contrato + traza; sin orquestación |
| Acoplamiento con tools existentes | El campo `nexo` es opcional; las tools funcionan sin él |
| Datos de fuentes externas incorrectos | `fiabilidad` en el registro + traza de verificación; el modelo always muestra la fuente |

## Performance Implications

- **CPU**: Negligible (lookup en registro es O(1))
- **Memory**: Negligible (registro cabe en memoria del Worker)
- **Load Time**: Sin cambios
- **Network**: Sin cambios (las tools existentes ya hacen las llamadas)

## Migration Plan

1. Crear `nexo-fuentes.js` con el registro de fuentes piloto
2. Añadir campo `nexo` a `buscar_normativa` y `buscar_precios` (opcional, no rompe)
3. Añadir `registrarNexoConsulta()` a `worker.js` (conecta a `registrarTraza`)
4. Añadir `sugerencia` fallback en `buscar_normativa` cuando devuelve 0 resultados
5. Crear migración D1 para `nexo_fuentes_telemetria`
6. Añadir `nucleo-cognitivo/src/nexo.js` como interfaz
7. Tests: verificar que las tools existentes siguen funcionando sin cambios visibles

## Validation Criteria

1. `buscar_normativa` y `buscar_precios` siguen pasando sus tests existentes
2. Cada consulta a una fuente Nexo registra una traza `tipo='nexo_consulta'`
3. `buscar_normativa` con 0 resultados devuelve `sugerencia:'buscar_web'`
4. La tabla `nexo_fuentes_telemetria` se crea y acepta datos
5. `node --check` limpio en todos los archivos modificados
6. 146/146 tests del agente siguen pasando

## Related Decisions

- **ADR-0008** — Definición de Nexo (interpretación A aceptada)
- **ADR-0004** — Motor de Decisión (Nexo no lo reemplaza)
- **ADR-0010** — Catálogo de tools (Nexo extiende con metadato)
- **ADR-0014** — Observabilidad (Nexo usa trazas)
- **ADR-0006** — Matriz de riesgo (Nexo = N0, solo lectura)
