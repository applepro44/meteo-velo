// netlify/functions/eccc-alerts.js
//
// Remplace le fetch direct vers weather.gc.ca que faisait fetchAlerts()
// dans index.html — ce fetch échouait probablement en silence à cause
// du CORS (ECCC n'envoie généralement pas Access-Control-Allow-Origin).
// Ici le fetch se fait côté serveur Netlify, donc pas de CORS possible.

exports.handler = async (event) => {
  const region = (event.queryStringParameters && event.queryStringParameters.region) || 'qc-10'; // région Québec
  const url = `https://weather.gc.ca/rss/warning/${region}_f.xml`;

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

    const alerts = [];
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(titleRegex)?.[1] || '').trim();
      const summaryRaw = (block.match(summaryRegex)?.[1] || '').trim();
      const summary = summaryRaw
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 200);

      const lower = title.toLowerCase();
      if (lower.includes('aucune') || lower.includes('no watch') || lower.includes('no alert')) continue;

      alerts.push({ title, summary });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, fetchedAt: new Date().toISOString(), alerts }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err), url }) };
  }
};
