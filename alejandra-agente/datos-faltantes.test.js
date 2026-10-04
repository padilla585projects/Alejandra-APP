// POOL-DATOS-FALTANTES-01 (04/10/2026) — en el banco agrupado del pool (alejandra:1.0 = qwen3.6)
// multi-10, ambigua-04, ambigua-06 y ambigua-07 no preguntaron: llamaron a la tool suponiendo el
// dato que faltaba. Regla en el prompt fijo de los DOS cerebros + validación barata en backend.
// Sin ninguna llamada real (ni a modelos ni a D1).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  REGLA_DATOS_OBLIGATORIOS, textoIndicaCuando, validarCuandoRecordatorio, validarUnidadesCalculoCable,
  tokensPersonaMencionados, mensajeAmbiguedadPersona
} from './lib.js';

const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const web = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

describe('regla de datos obligatorios en el prompt fijo', () => {
  it('es corta, pide preguntar antes de cualquier tool y nombra los datos que se suponían', () => {
    expect(REGLA_DATOS_OBLIGATORIOS.length).toBeLessThan(500);
    expect(REGLA_DATOS_OBLIGATORIOS).toMatch(/ANTES de llamar a ninguna herramienta/);
    for (const d of ['fecha/hora', 'destinatario', 'contenido', 'unidad', 'persona']) expect(REGLA_DATOS_OBLIGATORIOS).toContain(d);
    expect(REGLA_DATOS_OBLIGATORIOS).toMatch(/No inventes ni supongas/);
    expect(REGLA_DATOS_OBLIGATORIOS).not.toMatch(/[\r\n]/);
  });

  it('dos cerebros: agente (módulo dominio, L0) y Telegram (buildNexusPrompt, tras base)', () => {
    expect(agente).toMatch(/^\s+dominio: CONTEXTO_DOMINIO_INSTALADORA \+ '\\n\\n' \+ REGLA_DATOS_OBLIGATORIOS,$/m);
    expect(agente).toContain("const L0_MODULES = ['base', 'dominio', 'formato'];");
    expect(web).toMatch(/import \{[^}]*REGLA_DATOS_OBLIGATORIOS[^}]*\} from '\.\/alejandra-agente\/lib\.js'/);
    const ini = web.indexOf('function buildNexusPrompt(');
    expect(web.slice(ini, web.indexOf('\n}', ini))).toContain('CONTEXTO_DOMINIO_INSTALADORA, REGLA_DATOS_OBLIGATORIOS]');
  });
});

describe('programar_recordatorio: fecha/hora que el humano no ha dado', () => {
  it('reconoce horas, plazos y fechas', () => {
    for (const t of ['Recuérdame a las 9 revisar el cuadro', 'a las 17:30', 'mañana revisar el cuadro', 'en 2 horas', 'dentro de media hora',
      'el viernes', 'el 12', '12/10', '3 de noviembre', 'esta tarde', 'la semana que viene', 'a mediodía', '10h']) {
      expect(textoIndicaCuando(t), t).toBe(true);
    }
  });

  it('sin cuándo → mensaje que pide preguntar (ambigua-04); con cuándo en el turno o en la respuesta → vale', () => {
    const m = validarCuandoRecordatorio(['Ponme un recordatorio para revisar el cuadro']);
    expect(m).toMatch(/^❌ No programado/);
    expect(m).toMatch(/pregúntale/);
    expect(validarCuandoRecordatorio(['Recuérdame revisar 2 cuadros'])).not.toBeNull();
    expect(validarCuandoRecordatorio(['Ponme un recordatorio para revisar el cuadro', 'mañana a las 8'])).toBeNull();
    expect(validarCuandoRecordatorio(['Recuérdame el lunes llamar al proveedor'])).toBeNull();
  });

  it('sin texto humano (cron/llamada interna) no bloquea', () => {
    expect(validarCuandoRecordatorio([])).toBeNull();
    expect(validarCuandoRecordatorio(undefined)).toBeNull();
  });

  it('solo mira los últimos mensajes humanos, no una hora de hace muchos turnos', () => {
    expect(validarCuandoRecordatorio(['ayer a las 10 llegó el camión', 'vale', 'gracias', 'ponme un recordatorio para revisar el cuadro'])).not.toBeNull();
  });
});

describe('calcular_cable: potencia y longitud con unidad en el texto humano', () => {
  const ambos = { potencia_w: 40000, tension_v: 400, longitud_m: 16 };
  it('«una línea de 40 con 16 de sección a 400 V» (ambigua-07) → pide potencia y longitud con unidad', () => {
    const m = validarUnidadesCalculoCable(ambos, ['Calcula la caída de tensión de una línea de 40 con 16 de sección a 400 V']);
    expect(m).toMatch(/^❌ Cálculo no hecho/);
    expect(m).toMatch(/potencia/);
    expect(m).toMatch(/longitud/);
  });

  it('con unidades válidas (kW, W, CV, A; m, metros, km) → vale', () => {
    for (const t of ['línea de 40 m para 22 kW a 400 V', 'motor de 32 A, 50 metros', 'bomba de 5,5 CV a 120 m', '15000 W y 0,3 km', 'de 10 a 20 metros 15kw']) {
      expect(validarUnidadesCalculoCable(ambos, [t]), t).toBeNull();
    }
  });

  it('solo exige la unidad del dato que el modelo rellena; «16 mm²» no cuenta como metros', () => {
    expect(validarUnidadesCalculoCable({ potencia_w: 1000 }, ['22 kW, sección 16 mm²'])).toBeNull();
    expect(validarUnidadesCalculoCable({ longitud_m: 16 }, ['22 kW, sección 16 mm²'])).toMatch(/longitud/);
    expect(validarUnidadesCalculoCable({ potencia_w: 1000 }, ['de 10 a 20 metros'])).toMatch(/potencia/); // «10 a» no es una intensidad
  });

  it('sin texto humano (cron) no bloquea', () => {
    expect(validarUnidadesCalculoCable(ambos, [])).toBeNull();
  });
});

describe('personas con nombre ambiguo (multi-10)', () => {
  it('detecta qué parte del nombre elegido dijo el humano', () => {
    expect(tokensPersonaMencionados('Mario Ficticio', ['Apunta que Mario ha faltado hoy'])).toEqual({ completo: false, tokens: ['mario'] });
    expect(tokensPersonaMencionados('Mario Ficticio', ['Asígnasela a Mario Ficticio'])).toEqual({ completo: true, tokens: ['mario', 'ficticio'] });
    expect(tokensPersonaMencionados('José Pérez', ['que lo haga jose'])).toEqual({ completo: false, tokens: ['jose'] });
    expect(tokensPersonaMencionados('Pepe', ['Apunta que Mario ha faltado'])).toEqual({ completo: false, tokens: [] });
    // «Mar» no es «Mario»: palabras enteras
    expect(tokensPersonaMencionados('Mario', ['revisa el mar'])).toEqual({ completo: false, tokens: [] });
  });

  it('el mensaje lista los candidatos y pide preguntar sin elegir', () => {
    const m = mensajeAmbiguedadPersona('mario', [{ nombre: 'Mario', apellidos: 'Ficticio' }, { nombre: 'Mario', apellidos: 'Inventado' }]);
    expect(m).toMatch(/coincide con 2 personas \(Mario Ficticio, Mario Inventado\)/);
    expect(m).toMatch(/No elijas tú/);
  });

  it('gestionar_tarea comprueba asignado_a antes de crear/actualizar y consultar_personal avisa con varias coincidencias', () => {
    const ini = agente.indexOf("    case 'gestionar_tarea': {");
    const caso = agente.slice(ini, agente.indexOf("if (accion === 'crear') {", ini));
    expect(caso).toContain("(accion === 'crear' || accion === 'actualizar') && input.asignado_a");
    expect(caso).toContain('ambiguedadPersonaAsignada(env, resolverEid(empresa_id), input.asignado_a, fuentesPlano)');
    const fn = agente.slice(agente.indexOf('async function ambiguedadPersonaAsignada('), agente.indexOf('async function ejecutarTool('));
    expect(fn).toContain('WHERE empresa_id=? AND activo=1'); // nunca personas de otra empresa
    expect(fn).toMatch(/catch \(_\) \{\s*return null;/); // fail-open: la regla del prompt sigue
    expect(agente).toMatch(/rows\.length > 1\s*\?\s*`\\n\\n⚠️ Hay \$\{rows\.length\} personas que coinciden/);
  });

  it('programar_recordatorio y calcular_cable validan con los textos humanos (fuentesPlano)', () => {
    expect(agente).toMatch(/case 'programar_recordatorio': \{[\s\S]{0,700}validarCuandoRecordatorio\(fuentesPlano\)/);
    expect(agente).toMatch(/case 'calcular_cable': \{[\s\S]{0,300}validarUnidadesCalculoCable\(input, fuentesPlano\)[\s\S]{0,80}return calcularCable\(input\)/);
  });
});
