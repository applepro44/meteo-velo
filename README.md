# Météo Vélo

App météo multimodèle pour Simon (Ste-Foy, Québec) — géolocalisation GPS, pondération ECMWF 40% / GFS 25% / ICON 15% / GEM 20% via Open-Meteo, indice UV, verdict GO/Borderline/NO-GO pour le vélo, et une source officielle Environnement Canada affichée en parallèle.

Déployée sur Netlify : `meteo-velo.netlify.app`.

## Fonctionnalités

- **Géolocalisation GPS uniquement** (pas de localisation par IP), avec diagnostic clair si le GPS est refusé/indisponible.
- **Prévisions horaires multimodèles** (ECMWF, GFS, ICON, GEM via Open-Meteo) pour aujourd'hui, avec température, probabilité de précipitation, quantité, vent et un verdict GO/Borderline/NO-GO par heure.
- **Indice UV** (`uv_index` + `uv_index_clear_sky`) avec code couleur calé sur le seuil de protection de 3 (vert/orange/rouge/rouge foncé).
- **Divergence inter-modèles** affichée séparément par modèle pour les prochaines heures, pour voir le niveau d'accord entre eux.
- **Environnement Canada en parallèle** (API GeoMet-OGC-API, par coordonnées GPS) : conditions actuelles, bulletin texte du jour, alertes, et un flag si le % de précipitation ECCC diverge de plus de 20 points du multimodèle.
- **Alertes météo ECCC** avec lien de secours vers meteo.gc.ca si aucune alerte structurée n'est trouvée.

## Structure

```
meteo-velo/
├── index.html                       # App complète (HTML + CSS + JS), aucun build step
├── netlify/
│   ├── functions/
│   │   ├── eccc-weather.js          # Proxy: conditions/prévision/alertes ECCC (API GeoMet-OGC-API)
│   │   └── eccc-alerts.js           # Proxy: alertes ECCC seules
│   └── lib/
│       └── geomet.js                # Logique partagée : bbox, station la plus proche, validation lat/lon
├── test/
│   ├── load-app-logic.js            # Charge les fonctions pures de index.html pour les tests
│   ├── logic.test.js                # Tests des fonctions de index.html (verdict, UV, tableau horaire...)
│   └── geomet.test.js               # Tests du module netlify/lib/geomet.js
├── netlify.toml                     # Publish "." + dossier des fonctions
└── package.json
```

Aucune dépendance npm requise pour l'app elle-même — les fonctions Netlify utilisent seulement `fetch` natif (Node 18+), et le front-end est un fichier HTML unique sans framework ni build step. Les tests utilisent le test runner intégré de Node (`node:test`), donc pas de dépendance de test non plus.

## Sources de données

| Source | Usage |
|---|---|
| Open-Meteo | Prévisions horaires multimodèles (ECMWF, GFS, ICON, GEM) + indice UV — CC-BY 4.0 |
| Environnement Canada (GeoMet-OGC-API) | Conditions actuelles, bulletin du jour, alertes officielles |
| Nominatim (OpenStreetMap) | Géocodage inverse (coordonnées → nom de lieu) |

## Développer en local

```bash
npm install -g netlify-cli   # une seule fois
netlify dev
```

Ouvre `http://localhost:8888` — les fonctions Netlify (`/.netlify/functions/eccc-weather`, etc.) fonctionnent en local aussi.

## Tests

```bash
npm test
```

Teste les fonctions pures (`verdict`, `uvClass`, `uvAdvice`, `escapeHtml`, `buildRows`, `buildUvMap` dans `index.html`, et `distanceSq`/`resolveLatLon` dans `netlify/lib/geomet.js`). Ne fait aucun appel réseau réel.

## Déploiement

Le site est lié au dépôt GitHub — chaque `git push` vers `main` redéploie automatiquement sur Netlify (publish directory `.`, functions directory `netlify/functions`, aucune commande de build).
