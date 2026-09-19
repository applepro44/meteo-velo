// netlify/functions/eccc-alerts.js
//
// v2 — utilise la même API GeoMet-OGC-API que eccc-weather.js (le champ
// "warnings" est déjà inclus dans la réponse de cette collection).
// Remplace l'ancien fetch RSS vers weather.gc.ca/rss/warning/ (même
// système legacy que le RSS de prévisions, probablement mort aussi).

const { resolveLatLon, fetchNearestStation } = require('../lib/geomet');

exports.handler = async (event) => {
  const { lat, lon } = resolveLatLon(event.queryStringParameters);

  try {
    const nearest = await fetchNearestStation(lat, lon);

    if (!nearest) {
      return { statusCode: 200, body: JSON.stringify({ alerts: [] }) };
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
    console.error('eccc-alerts error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: 'Impossible de récupérer les alertes ECCC' }),
    };
  }
};
