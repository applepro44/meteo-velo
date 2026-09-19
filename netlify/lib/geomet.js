// netlify/lib/geomet.js
//
// Logique partagée entre eccc-alerts.js et eccc-weather.js pour interroger
// l'API GeoMet-OGC-API d'Environnement Canada et trouver la station la
// plus proche des coordonnées demandées.

const DEFAULT_LAT = 46.7793; // Ste-Foy, Québec
const DEFAULT_LON = -71.2825;
const BBOX_PAD = 0.2; // degrés — assez large pour attraper un point même en zone peu dense

function distanceSq(lat1, lon1, lat2, lon2) {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return dLat * dLat + dLon * dLon;
}

function resolveLatLon(queryStringParameters) {
  const qp = queryStringParameters || {};
  const lat = parseFloat(qp.lat);
  const lon = parseFloat(qp.lon);
  return {
    lat: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : DEFAULT_LAT,
    lon: Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : DEFAULT_LON,
  };
}

// Interroge citypageweather-realtime et retourne la feature (station) la
// plus proche des coordonnées données, ou null si aucune station trouvée.
async function fetchNearestStation(lat, lon) {
  const bbox = [lon - BBOX_PAD, lat - BBOX_PAD, lon + BBOX_PAD, lat + BBOX_PAD].join(',');
  const url = `https://api.weather.gc.ca/collections/citypageweather-realtime/items?bbox=${bbox}&f=json&limit=10`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'MeteoVelo/1.0 (app perso, contact via GitHub repo)' },
  });

  if (!res.ok) {
    const err = new Error(`ECCC API a répondu ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }

  const data = await res.json();
  const features = data.features || [];
  if (features.length === 0) return null;

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
  return nearest;
}

module.exports = { DEFAULT_LAT, DEFAULT_LON, BBOX_PAD, distanceSq, resolveLatLon, fetchNearestStation };
