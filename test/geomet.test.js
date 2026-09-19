const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceSq, resolveLatLon, DEFAULT_LAT, DEFAULT_LON } = require('../netlify/lib/geomet');

test('distanceSq()', () => {
  assert.equal(distanceSq(0, 0, 0, 0), 0);
  assert.equal(distanceSq(0, 0, 3, 4), 25); // 3-4-5 triangle -> distance^2 = 25
});

test('resolveLatLon()', async (t) => {
  await t.test('parse des coordonnées valides', () => {
    assert.deepEqual(resolveLatLon({ lat: '46.8', lon: '-71.2' }), { lat: 46.8, lon: -71.2 });
  });

  await t.test('retombe sur les valeurs par défaut si absentes', () => {
    assert.deepEqual(resolveLatLon({}), { lat: DEFAULT_LAT, lon: DEFAULT_LON });
    assert.deepEqual(resolveLatLon(undefined), { lat: DEFAULT_LAT, lon: DEFAULT_LON });
  });

  await t.test('retombe sur les valeurs par défaut si hors bornes valides', () => {
    assert.deepEqual(resolveLatLon({ lat: '999', lon: '-71.2' }), { lat: DEFAULT_LAT, lon: -71.2 });
    assert.deepEqual(resolveLatLon({ lat: '46.8', lon: '-999' }), { lat: 46.8, lon: DEFAULT_LON });
  });

  await t.test('retombe sur les valeurs par défaut si non numériques', () => {
    assert.deepEqual(resolveLatLon({ lat: 'abc', lon: 'def' }), { lat: DEFAULT_LAT, lon: DEFAULT_LON });
  });

  await t.test('accepte les limites exactes -90/90 et -180/180', () => {
    assert.deepEqual(resolveLatLon({ lat: '90', lon: '180' }), { lat: 90, lon: 180 });
    assert.deepEqual(resolveLatLon({ lat: '-90', lon: '-180' }), { lat: -90, lon: -180 });
  });
});
