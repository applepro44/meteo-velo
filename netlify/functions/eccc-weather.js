// netlify/functions/eccc-weather.js
//
// Prévision officielle d'Environnement Canada — v2, basée sur l'API
// GeoMet-OGC-API moderne (api.weather.gc.ca), qui remplace l'ancien
// système RSS /rss/city/ (confirmé mort en juillet 2026).
//
// Avantages vs l'ancienne version RSS :
// - Requête par coordonnées GPS directement, pas de code de ville à deviner
// - JSON natif, pas de parsing XML/regex fragile
// - Probabilité de précipitation horaire en vrai nombre (lop.value),
//   pas besoin de l'extraire d'un texte libre
// - Inclut aussi les alertes (warnings) dans la même réponse
//
// Doc : https://eccc-msc.github.io/open-data/msc-geomet/ogc_api_en/
// Collection : citypageweather-realtime (expérimentale mais fonctionnelle,
// vérifiée en direct le 9 juillet 2026 avec des données réelles)

const DEFAULT_LAT = 46.7793; // Ste-Foy, Québec
const DEFAULT_LON = -71.2825;
const BBOX_PAD = 0.2; // degrés — assez large pour attraper un point même en zone peu dense

function distanceSq(lat1, lon1, lat2, lon2) {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return dLat * dLat + dLon * dLon;
}

exports.handler = async (event) => {
  const qp = event.queryStringParameters || {};
  const lat = parseFloat(qp.lat) || DEFAULT_LAT;
  const lon = parseFloat(qp.lon) || DEFAULT_LON;

  const bbox = [lon - BBOX_PAD, lat - BBOX_PAD, lon + BBOX_PAD, lat + BBOX_PAD].join(',');
  const url = `https://api.weather.gc.ca/collections/citypageweather-realtime/items?bbox=${bbox}&f=json&limit=10`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MeteoVelo/1.0 (app perso, contact via GitHub repo)' },
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `ECCC API a répondu ${res.status}`, url }) };
    }

    const data = await res.json();
    const features = data.features || [];

    if (features.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Aucune station ECCC trouvée près de ces coordonnées', url }) };
    }

    let nearest = features[0];
    let bestDist = Infinity;
    for (const f of features) {
      const [flon, flat] = f.geometry.coordinates;
      const d = distanceSq(lat, lon, flat, flon);
      if (d < bestDist) {
        bestDist = d;
        nearest = f;
      }
    }

    const p = nearest.properties;
    const cc = p.currentConditions || {};
    const todayForecast = (p.forecastGroup && p.forecastGroup.forecasts && p.forecastGroup.forecasts[0]) || null;

    const hourly = ((p.hourlyForecastGroup && p.hourlyForecastGroup.hourlyForecasts) || [])
      .slice(0, 12)
      .map((h) => ({
        timestamp: h.timestamp,
        temperature: h.temperature?.value?.fr ?? null,
        pop: h.lop?.value?.fr ?? null,
        condition: h.condition?.fr ?? null,
      }));

    const rawWarnings = p.warnings || [];
    const warnings = rawWarnings.map((w) => ({
      // Tous les champs texte de cette API sont structurés {en, fr} —
      // on extrait le .fr ici pour que le front-end reçoive de simples
      // chaînes, jamais des objets (bug corrigé : escapeHtml() plantait
      // sur ces objets non extraits).
      type: (w.type && w.type.fr) || (w.title && w.title.fr) || (typeof w.type === 'string' ? w.type : null) || 'Alerte',
      description: (w.description && w.description.fr) || (w.summary && w.summary.fr) || (typeof w.description === 'string' ? w.description : '') || '',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Environnement Canada (GeoMet-OGC-API)',
        stationName: p.name?.fr || null,
        fetchedAt: new Date().toISOString(),
        currentConditions: {
          temperature: cc.temperature?.value?.fr ?? null,
          humidity: cc.relativeHumidity?.value?.fr ?? null,
          windSpeed: cc.wind?.speed?.value?.fr ?? null,
          windDirection: cc.wind?.direction?.value?.fr ?? null,
        },
        today: todayForecast
          ? {
              period: todayForecast.period?.textForecastName?.fr ?? null,
              summary: todayForecast.textSummary?.fr ?? null,
              cloudPrecip: todayForecast.cloudPrecip?.fr ?? null,
            }
          : null,
        hourly,
        warnings,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err), url }) };
  }
};
