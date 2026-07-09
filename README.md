# Météo Vélo

App météo multimodèle pour Simon (Ste-Foy, Québec) — géolocalisation GPS, pondération ECMWF 40% / GFS 25% / ICON 15% / GEM 20% via Open-Meteo, verdict GO/Borderline/NO-GO pour le vélo, et maintenant une source officielle Environnement Canada en parallèle.

## Ce qui a changé par rapport à ta version en ligne

1. **Nouveau : prévision officielle ECCC affichée en parallèle.** Nouvelle section "Environnement Canada (référence officielle)" avec la prévision du jour + un flag si l'écart entre ton multimodèle et le % officiel ECCC dépasse 20 points.
2. **`fetchAlerts()` corrigé.** Ton fetch direct vers `weather.gc.ca` depuis le navigateur était presque certainement bloqué par le CORS (échec silencieux, fallback vers le lien). Il passe maintenant par une fonction Netlify qui fait le fetch côté serveur — pas de CORS possible là.
3. **CSP ajusté.** `connect-src` a maintenant `'self'` (nécessaire pour appeler nos fonctions Netlify) et n'a plus besoin de `meteo.gc.ca`/`weather.gc.ca` puisque ces appels se font maintenant côté serveur, pas côté client.

Tout le reste de ton code (geoloc, verdict GO/NO-GO, tableau, divergence inter-modèles Open-Meteo) est intact, inchangé.

## Structure

```
meteo-velo/
├── index.html                       # Ton fichier, avec les 3 changements ci-dessus
├── netlify/
│   └── functions/
│       ├── eccc-weather.js          # Proxy: prévision officielle ECCC (flux RSS ville)
│       └── eccc-alerts.js           # Proxy: alertes ECCC (remplace ton fetch direct)
├── netlify.toml                     # Publish "." + dossier des fonctions
└── package.json
```

Aucune dépendance npm requise — les fonctions utilisent seulement `fetch` natif (Node 18+) et des regex simples, pas de build step, comme ton fichier original.

## Comment faire un git — étape par étape

### 1. Initialiser le repo local

```bash
cd meteo-velo
git init
git add -A
git commit -m "Version initiale + intégration ECCC (forecast + alertes)"
```

### 2. Créer le repo sur GitHub

**Option A — avec la CLI GitHub (`gh`), le plus rapide :**
```bash
gh repo create meteo-velo --private --source=. --push
```
(enlève `--private` si tu veux un repo public)

**Option B — manuellement :**
1. Va sur https://github.com/new
2. Nom : `meteo-velo`, ne coche PAS "Initialize with README" (on en a déjà un)
3. Une fois créé, GitHub te donne des commandes du genre :
```bash
git remote add origin https://github.com/TON-USERNAME/meteo-velo.git
git branch -M main
git push -u origin main
```

### 3. Lier le repo à ton site Netlify existant

C'est l'étape qui remplace ton drag & drop manuel par du déploiement automatique à chaque `git push` :

1. Dashboard Netlify → ton site `meteo-velo` (celui à `meteo-velo.netlify.app`)
2. **Site settings** → **Build & deploy** → **Link repository** (ou "Link site to Git" si t'as l'option au premier écran)
3. Choisis GitHub → autorise Netlify → sélectionne le repo `meteo-velo`
4. Build settings :
   - Build command : *(laisse vide, pas de build nécessaire)*
   - Publish directory : `.`
   - Functions directory : `netlify/functions` *(devrait être auto-détecté via `netlify.toml`)*
5. Deploy

Après ça, chaque `git push` vers `main` redéploie automatiquement le site.

### 4. Tester en local avant de push (optionnel mais recommandé)

```bash
npm install -g netlify-cli   # une seule fois
netlify dev
```

Ouvre `http://localhost:8888` — les fonctions Netlify (`/.netlify/functions/eccc-weather`, etc.) fonctionnent en local aussi.

## Limites connues / à valider après déploiement

- **Je n'ai pas pu tester les fonctions en direct** — mon environnement de développement n'a pas accès à `weather.gc.ca`. Le parsing regex est basé sur le format RSS documenté par ECCC, mais valide après le premier déploiement que `eccc-weather` et `eccc-alerts` retournent bien du contenu cohérent (pas juste des erreurs 500).
- L'extraction du "% de probabilité de pluie" se fait par regex sur le texte libre du résumé ECCC — si leur formulation change, ça peut casser silencieusement (l'app va juste ne pas afficher le flag de divergence, rien de plus grave).
- Code de ville ECCC fixé à `qc-133` (Québec) par défaut — il n'existe pas de code RSS dédié pour le parc de la Jacques-Cartier. Si jamais tu utilises l'app ailleurs souvent (Lac-Saint-Jean, Mauricie), on pourrait ajouter une logique de mapping lat/lon → code de ville le plus proche.
