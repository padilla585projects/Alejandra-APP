import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extraerCotasTexto, cotaCoincide, verificarCotasDeclaradas, resultadoPlanoVerificado, errorPlanoNoGuardado } from './planos-cotas.js';

// IA-QUALITY-09 (03/10/2026): QA ID 28 — el chat afirmó un aviso QA ausente del archivo.
describe('IA-QUALITY-09 avisos del archivo y cotas del usuario', () => {
  it('extrae longitudes con unidad y descarta secciones', () => {
    expect(extraerCotasTexto('Nave 40x20 m, tramo 2,8 m y 2800 mm').map(c => c.valor_m)).toEqual([40, 20, 2.8, 2.8]);
    expect(extraerCotasTexto('cable 2,5 mm2 y 6 mm² y 3 m/s')).toEqual([]);
    expect(extraerCotasTexto('altura 3 metros')[0].valor_m).toBe(3);
    expect(cotaCoincide(2.801, 2.8)).toBe(true);
    expect(cotaCoincide(28, 2.8)).toBe(false);
  });

  it('una cota que el usuario no escribió no llega al plano', () => {
    const r = verificarCotasDeclaradas([{ valor: 4, unidad: 'm' }], ['tramo de 40 m']);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('COTAS_NO_APORTADAS');
    expect(r.mensaje).toMatch(/no las inventes/);
  });

  it('el resultado expone solo avisos comprobados en el archivo', () => {
    const r = resultadoPlanoVerificado({ ok: true, avisos_en_archivo: ['inventado'], verificacion_archivo: { avisos_en_archivo: ['NO EJECUTAR EN OBRA'] } });
    expect(r.avisos_en_archivo).toEqual(['NO EJECUTAR EN OBRA']);
    expect(resultadoPlanoVerificado({ ok: true, avisos_en_archivo: ['inventado'] }).avisos_en_archivo).toEqual([]);
    expect(errorPlanoNoGuardado('fallo').instruccion).toMatch(/no digas que el plano existe/);
  });

  it('el prompt y las tools de ambos Workers limitan los avisos a los del archivo', () => {
    const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    const api = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    expect(agente).toContain('afirma solo los avisos que la tool devuelve en "avisos_en_archivo"');
    expect(agente.match(/resultadoPlanoVerificado\(\{ \.\.\.data, alcance: alcancePlanoGenerado\(/g)).toHaveLength(2);
    expect(agente).toContain('verificarCotasDeclaradas(input.cotas, fuentesPlano)');
    expect(api).toContain('cita solo los que devuelve verificacion_archivo.avisos_en_archivo');
    expect(api.match(/finalizarPlanoVerificado\(svgRaw, contratoPlano\)/g)).toHaveLength(2);
  });
});
