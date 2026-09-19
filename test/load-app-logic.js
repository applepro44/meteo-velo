// test/load-app-logic.js
//
// index.html n'est pas un module - c'est un script inline unique, par
// design (pas de build step). Pour tester ses fonctions pures (verdict,
// uvClass, buildRows, etc.) sans dupliquer le code dans un fichier séparé,
// on extrait le <script> et on l'exécute dans le contexte courant (vm.
// runInThisContext, pas vm.createContext - un contexte séparé donnerait
// des objets "d'un autre royaume", et assert.deepStrictEqual les rejette
// même quand leur contenu est identique). document/navigator/fetch sont
// stubés le temps du chargement pour que start(), appelé automatiquement
// à la fin du script, échoue silencieusement au lieu de faire du vrai
// réseau ou de planter sur un DOM absent.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadAppLogic() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Impossible de trouver le <script> dans index.html');

  const wrapped = `(function() {\n${match[1]}\nreturn { verdict, uvClass, uvAdvice, escapeHtml, buildUvMap, buildRows };\n})()`;

  // Ces stubs restent en place pour le reste du processus de test (pas de
  // restauration) : start() continue en arrière-plan après le premier
  // await et ne doit jamais toucher le vrai réseau, même une fois cette
  // fonction retournée.
  global.document = { getElementById: () => ({ innerHTML: '', textContent: '' }) };
  global.navigator = { geolocation: null };
  global.fetch = async () => ({ ok: false, status: 500 });

  return vm.runInThisContext(wrapped, { filename: 'index.html-inline-script.js' });
}

module.exports = { loadAppLogic };
