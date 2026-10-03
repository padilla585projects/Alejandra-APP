// POOL-GLOSARIO-01 (03/10/2026) — contexto del oficio y glosario en TODOS los prompts de
// sistema de los expertos (los dos cerebros) y sumidero opcional de Analytics Engine para las
// métricas del pool (ADR-0028 §Medición). Sin ninguna llamada real.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTEXTO_DOMINIO_INSTALADORA } from './lib.js';
import { poolChat, fijarSumideroMetricasPool, _reiniciarCircuitoPool, _reiniciarMetricasPool } from './ai-pool.js';

const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const web = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

// Texto del objeto `const NOMBRE = { ... };` (hasta la primera línea «};»).
function bloque(src, nombre) {
  const ini = src.indexOf(`const ${nombre} = {`);
  expect(ini, nombre).toBeGreaterThan(-1);
  return src.slice(ini, src.indexOf('\n};', ini));
}

describe('contexto del oficio y glosario', () => {
  it('es corto (va en cada mensaje), dice que es una instaladora y define los términos que se confunden', () => {
    const c = CONTEXTO_DOMINIO_INSTALADORA;
    expect(c.length).toBeLessThan(1600);
    expect(c).toMatch(/instaladora \(eléctrica, mecánica, telecomunicaciones y control\)/);
    expect(c).toMatch(/obra/);
    expect(c).toMatch(/automoción/); // descarta expresamente el sentido de coche
    const terminos = c.split('\n').filter(l => l.startsWith('- '));
    expect(terminos.length).toBeGreaterThanOrEqual(10);
    expect(terminos.length).toBeLessThanOrEqual(20);
    for (const t of ['Diferencial', 'Magnetotérmico', 'REBT', 'ITC-BT', 'Bandeja portacables', 'Bobina', 'PEMP', 'EPI',
      'Parte de trabajo', 'Albarán', 'Replanteo', 'Cuadro eléctrico', 'CGP', 'mm²', 'Caída de tensión', 'Selectividad', 'IP / IK']) {
      expect(c.toLowerCase(), t).toContain(t.toLowerCase());
    }
    expect(c).toMatch(/fugas a tierra/);
    expect(c).toMatch(/30 mA/);
    expect(c).toMatch(/300 mA/);
    expect(c).toMatch(/sobrecargas y cortocircuitos/);
    expect(c).not.toMatch(/\r/);
  });
});

describe('alejandra-agente: todos los expertos llevan el glosario en la parte cacheada', () => {
  it('NEXUS_MODULES.dominio es el texto compartido de lib.js', () => {
    expect(agente).toMatch(/^\s+dominio: CONTEXTO_DOMINIO_INSTALADORA,$/m);
    expect(agente).toMatch(/import \{\s*reEspanol,\s*CONTEXTO_DOMINIO_INSTALADORA,/);
  });

  it('cada experto (incluido simple, el que va al pool) carga dominio justo después de base', () => {
    const b = bloque(agente, 'NEXUS_EXPERTS');
    const expertos = [...b.matchAll(/^\s+([a-z_]+):\s*\{ model:/gm)].map(m => m[1]);
    expect(expertos).toEqual(expect.arrayContaining(['simple', 'app', 'tecnico', 'web', 'reflexion', 'completo', 'ingenieria']));
    const lineas = b.split('\n').filter(l => /^\s+[a-z_]+:\s*\{ model:/.test(l));
    expect(lineas.length).toBe(expertos.length);
    for (const l of lineas) expect(l, l.slice(0, 40)).toContain("modules: ['base', 'dominio', ");
  });

  it('dominio está en L0 (bloque con cache_control), no en la parte dinámica', () => {
    expect(agente).toContain("const L0_MODULES = ['base', 'dominio', 'formato'];");
  });

  it('también el prompt de reflexión del cron y el ayudante de pedidos', () => {
    expect(agente).toContain("buildSystemPrompt(['base','dominio','tecnica','nexus','evolucion','reflexion','formato'])");
    expect(bloque(agente, 'AYUDANTES')).toContain("systemPrompt: CONTEXTO_DOMINIO_INSTALADORA + '\\n\\n' + 'Eres el ayudante de Pedidos");
  });
});

describe('worker.js (Telegram): el otro cerebro también lo lleva', () => {
  it('buildNexusPrompt inserta el glosario tras base y todos los expertos cargan base', () => {
    expect(web).toMatch(/import \{[^}]*CONTEXTO_DOMINIO_INSTALADORA[^}]*\} from '\.\/alejandra-agente\/lib\.js'/);
    const ini = web.indexOf('function buildNexusPrompt(');
    const fn = web.slice(ini, web.indexOf('\n}', ini));
    expect(fn).toContain("m === 'base' ? [NEXUS_MODULES.base, CONTEXTO_DOMINIO_INSTALADORA]");
    const b = bloque(web, 'NEXUS_EXPERTS');
    const modulos = [...b.matchAll(/modules: \[([^\]]*)\]/g)].map(m => m[1]);
    expect(modulos.length).toBeGreaterThanOrEqual(5);
    for (const m of modulos) expect(m.startsWith("'base'"), m.slice(0, 40)).toBe(true);
  });
});

describe('sumidero opcional de Analytics Engine (sin D1)', () => {
  afterEach(() => { fijarSumideroMetricasPool(null); _reiniciarCircuitoPool(); _reiniciarMetricasPool(); });

  const okPool = async () => ({
    ok: true, status: 200, headers: new Headers({ 'X-AI-Pool-Model': 'qwen3.6:35b-a3b' }),
    text: async () => JSON.stringify({ model: 'alejandra:1.0', choices: [{ message: { content: 'respuesta privada' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
  });

  it('con binding escribe un punto por uso, solo con metadatos (nunca contenido)', async () => {
    const puntos = [];
    fijarSumideroMetricasPool({ writeDataPoint: p => puntos.push(p) }, 'alejandra-agente');
    const r = await poolChat({ AI_POOL_KEY: 'k' }, { messages: [{ role: 'user', content: 'mensaje secreto del usuario' }], uso: 'experto_simple' }, { fetch: okPool });
    expect(r.ok).toBe(true);
    expect(puntos).toHaveLength(1);
    const p = puntos[0];
    expect(p.indexes).toEqual(['experto_simple']);
    expect(p.blobs).toEqual(['experto_simple', 'ok', '', 'alejandra:1.0', 'qwen3.6:35b-a3b', 'alejandra-agente']);
    expect(p.doubles[1]).toBe(1);
    expect(JSON.stringify(p)).not.toMatch(/secreto|privada/);
  });

  it('un respaldo guarda el motivo; sin binding no se escribe nada y un fallo del binding no rompe', async () => {
    const puntos = [];
    fijarSumideroMetricasPool({ writeDataPoint: p => puntos.push(p) }, 'alejandra-app-api');
    const caido = async () => ({ ok: false, status: 503, headers: new Headers(), text: async () => '{"error":{"code":"model_unavailable"}}' });
    await poolChat({ AI_POOL_KEY: 'k' }, { messages: [{ role: 'user', content: 'x' }], uso: 'router' }, { fetch: caido });
    expect(puntos[0].blobs[1]).toBe('respaldo');
    expect(puntos[0].blobs[2]).toBeTruthy();
    expect(puntos[0].blobs[5]).toBe('alejandra-app-api');

    fijarSumideroMetricasPool({ writeDataPoint: () => { throw new Error('cuota'); } });
    const r = await poolChat({ AI_POOL_KEY: 'k' }, { messages: [{ role: 'user', content: 'x' }], uso: 'router' }, { fetch: okPool });
    expect(r.ok).toBe(true);

    fijarSumideroMetricasPool(undefined);
    const antes = puntos.length;
    await poolChat({ AI_POOL_KEY: 'k' }, { messages: [{ role: 'user', content: 'x' }], uso: 'router' }, { fetch: okPool });
    expect(puntos.length).toBe(antes);
  });

  it('los dos workers fijan el sumidero desde env.AI_POOL_AE en fetch y scheduled', () => {
    expect((agente.match(/fijarSumideroMetricasPool\(env\.AI_POOL_AE, 'alejandra-agente'\)/g) || []).length).toBe(2);
    expect((web.match(/fijarSumideroMetricasPool\(env\.AI_POOL_AE, 'alejandra-app-api'\)/g) || []).length).toBe(2);
  });
});
