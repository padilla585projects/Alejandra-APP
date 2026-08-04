import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRemoteVersion } from './version-check.js';

function fakeFetch(response) {
  return async () => response;
}

test('checkRemoteVersion: matches:false cuando la version remota difiere', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({ v: '9.00' }) }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.remoteVersion, '9.00');
  assert.equal(r.matches, false);
});

test('checkRemoteVersion: matches:true cuando coincide', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({ v: '8.99' }) }),
  });
  assert.equal(r.matches, true);
  assert.equal(r.remoteVersion, '8.99');
});

test('checkRemoteVersion: respuesta no-ok se trata como sin novedad, nunca dispara nada', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: fakeFetch({ ok: false }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.remoteVersion, null);
  assert.equal(r.matches, true);
});

test('checkRemoteVersion: JSON sin "v" se trata como sin novedad', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({}) }),
  });
  assert.equal(r.remoteVersion, null);
  assert.equal(r.matches, true);
});

test('checkRemoteVersion: excepcion de red (fetch rechaza) se trata como sin novedad', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: async () => { throw new Error('network down'); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.matches, true);
});

test('checkRemoteVersion: excepcion al parsear JSON se trata como sin novedad', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    cacheBust: 1,
    fetchImpl: fakeFetch({ ok: true, json: async () => { throw new Error('bad json'); } }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.matches, true);
});

test('checkRemoteVersion: usa Date.now() por defecto si no se pasa cacheBust (no lanza)', async () => {
  const r = await checkRemoteVersion({
    currentVersion: '8.99',
    fetchImpl: async (url) => {
      assert.match(url, /^version\.json\?_=\d+$/);
      return { ok: true, json: async () => ({ v: '8.99' }) };
    },
  });
  assert.equal(r.matches, true);
});
