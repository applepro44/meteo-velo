// netlify/functions/eccc-weather.js
//
// Nouvelle donnée : la prévision officielle d'Environnement Canada
// (flux RSS "quasi temps réel", délai max ~1 min selon la doc ECCC),
// affichée en parallèle du modèle multimodèle Open-Meteo comme
// deuxième source de vérité. Fetch côté serveur pour éviter le CORS.
//
// Le "code de ville" (ex: qc-133) est celui utilisé dans les URLs
// publiques de meteo.gc.ca — PAS le site code interne du Datamart XML.
// Il n'existe pas de code dédié pour le parc de la Jacques-Cartier;
// qc-133 (Québec) est le point de référence stable le plus proche.

function decodeEntities(str) {
  return (str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

exports.handler = async (event) => {
  const cityCode = (event.queryStringParameters && event.queryStringParameters.city) || 'qc-133';
  const url = `https://weather.gc.ca/rss/city/${cityCode}_f.xml`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MeteoVelo/1.0 (app perso, contact via GitHub repo)' },
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `ECCC a répondu ${res.status}`, url }) };
    }

    const xml = await res.text();

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/;
    const summaryRegex = /<summary[^>]*>([\s\S]*?)<\/summary>/;
    const updatedMatch = xml.match(/<updated>([\s\S]*?)<\/updated>/);

    const entries = [];
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(titleRegex)?.[1] || '').trim();
      const summaryRaw = (block.match(summaryRegex)?.[1] || '').trim();
      const summary = decodeEntities(summaryRaw)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim();

      const popMatch = summary.match(/(\d{1,3})\s*(?:%|pour cent)\s*(?:de\s*)?(?:probabilit[ée]|possibilit[ée])?\s*d[e']?\s*(?:averses|pluie|précipitations)/i);
      const pop = popMatch ? parseInt(popMatch[1], 10) : null;

      entries.push({ title, summary, pop });
    }

    const currentConditions = entries.find((e) => /^condition/i.test(e.title)) || null;
    const forecast = entries.filter((e) => e !== currentConditions);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Environnement Canada (weather.gc.ca RSS)',
        cityCode,
        fetchedAt: new Date().toISOString(),
        updated: updatedMatch ? updatedMatch[1] : null,
        currentConditions,
        forecast,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err), url }) };
  }
};
