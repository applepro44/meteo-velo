const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppLogic } = require('./load-app-logic');

const app = loadAppLogic();

test('verdict()', async (t) => {
  await t.test('GO quand POP et précipitation sont bas', () => {
    const v = app.verdict(10, 0);
    assert.equal(v.cls, 'vg');
    assert.equal(v.banner, 'go');
  });

  await t.test('Borderline entre 40 et 70% POP', () => {
    const v = app.verdict(50, 0);
    assert.equal(v.cls, 'vw');
    assert.equal(v.banner, 'warn');
  });

  await t.test('Borderline si précipitation > 0.2mm même avec POP bas', () => {
    const v = app.verdict(5, 0.3);
    assert.equal(v.cls, 'vw');
  });

  await t.test('NO-GO à 70% POP ou plus', () => {
    const v = app.verdict(70, 0);
    assert.equal(v.cls, 'vn');
    assert.equal(v.banner, 'nogo');
  });

  await t.test('NO-GO si précipitation > 1mm même avec POP bas', () => {
    const v = app.verdict(5, 1.5);
    assert.equal(v.cls, 'vn');
  });

  await t.test('les seuils sont inclusifs (limites exactes)', () => {
    assert.equal(app.verdict(40, 0).cls, 'vw');
    assert.equal(app.verdict(70, 0).cls, 'vn');
  });
});

test('uvClass()', () => {
  assert.equal(app.uvClass(0), 'uv0');
  assert.equal(app.uvClass(2), 'uv0');
  assert.equal(app.uvClass(3), 'uv1');
  assert.equal(app.uvClass(5), 'uv1');
  assert.equal(app.uvClass(6), 'uv2');
  assert.equal(app.uvClass(7), 'uv2');
  assert.equal(app.uvClass(8), 'uv3');
  assert.equal(app.uvClass(11), 'uv3');
});

test('uvAdvice()', () => {
  assert.equal(app.uvAdvice(0), null);
  assert.equal(app.uvAdvice(2), null);
  assert.match(app.uvAdvice(3), /crème/);
  assert.match(app.uvAdvice(6), /protection/);
  assert.match(app.uvAdvice(8), /éviter/);
});

test('escapeHtml()', () => {
  assert.equal(
    app.escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );
  assert.equal(app.escapeHtml("O'Brien & fils"), 'O&#39;Brien &amp; fils');
  assert.equal(app.escapeHtml(''), '');
  assert.equal(app.escapeHtml(null), '');
  assert.equal(app.escapeHtml(undefined), '');
});

test('buildUvMap()', async (t) => {
  await t.test('retourne un objet vide si pas de données', () => {
    assert.deepEqual(app.buildUvMap(null), {});
    assert.deepEqual(app.buildUvMap({}), {});
  });

  await t.test("indexe l'UV par heure pour la date du jour seulement", () => {
    const today = new Date().toLocaleDateString('en-CA');
    const uvData = {
      hourly: {
        time: [`${today}T08:00`, `${today}T12:00`, `2020-01-01T12:00`],
        uv_index: [1, 5, 99],
        uv_index_clear_sky: [1.5, 6, 99],
      },
    };
    const map = app.buildUvMap(uvData);
    assert.deepEqual(map[8], { uv: 1, uvClear: 1.5 });
    assert.deepEqual(map[12], { uv: 5, uvClear: 6 });
    assert.equal(Object.keys(map).length, 2, "la ligne d'une autre date doit être ignorée");
  });
});

test('buildRows()', async (t) => {
  const today = new Date().toLocaleDateString('en-CA');

  await t.test('calcule la moyenne pondérée entre modèles', () => {
    const d = {
      hourly: {
        time: [`${today}T10:00`],
        temperature_2m_ecmwf_ifs025: [10],
        precipitation_probability_ecmwf_ifs025: [50],
        precipitation_ecmwf_ifs025: [0.5],
        windspeed_10m_ecmwf_ifs025: [20],
        weathercode_ecmwf_ifs025: [1],
        temperature_2m_gfs_seamless: [20],
        precipitation_probability_gfs_seamless: [10],
        precipitation_gfs_seamless: [0.1],
        windspeed_10m_gfs_seamless: [10],
        weathercode_gfs_seamless: [2],
      },
    };
    const rows = app.buildRows(d);
    assert.equal(rows.length, 1);
    // ECMWF pèse 0.40, GFS 0.25 -> total poids utilisé = 0.65
    const expectedTemp = (10 * 0.4 + 20 * 0.25) / 0.65;
    assert.ok(Math.abs(rows[0].avgT - expectedTemp) < 0.001);
  });

  await t.test('ignore les lignes des autres dates', () => {
    const d = {
      hourly: {
        time: ['2020-01-01T10:00'],
        temperature_2m_ecmwf_ifs025: [10],
        precipitation_probability_ecmwf_ifs025: [0],
        precipitation_ecmwf_ifs025: [0],
        windspeed_10m_ecmwf_ifs025: [0],
        weathercode_ecmwf_ifs025: [0],
      },
    };
    assert.deepEqual(app.buildRows(d), []);
  });

  await t.test('ignore une heure sans aucune donnée de modèle', () => {
    const d = { hourly: { time: [`${today}T10:00`] } };
    assert.deepEqual(app.buildRows(d), []);
  });
});
