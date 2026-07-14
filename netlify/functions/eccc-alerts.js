// netlify/functions/eccc-alerts.js
//
// v2 — utilise la même API GeoMet-OGC-API que eccc-weather.js (le champ
// "warnings" est déjà inclus dans la réponse de cette collection).
// Remplace l'ancien fetch RSS vers weather.gc.ca/rss/warning/ (même
// système legacy que le RSS de prévisions, probablement mort aussi).

const DEFAULT_LAT = 46.7793;
const DEFAULT_LON = -71.2825;
const BBOX_PAD = 0.2;

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
      return { statusCode: 200, body: JSON.stringify({ alerts: [] }) };
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

    const warnings = nearest.properties.warnings || [];
    const alerts = warnings.map((w) => ({
      title: w.type?.fr || w.title?.fr || 'Alerte',
      summary: w.description?.fr || w.summary?.fr || '',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetchedAt: new Date().toISOString(), alerts }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err), url }) };
  }
};
