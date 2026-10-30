// Navigation programmatique : navigate('conges/demandes/q1') ouvre /conges/demandes/q1.
// Le routeur est enregistré au démarrage (voir router/index.js) pour éviter une dépendance circulaire avec les pages.
let router;

export const setRouter = (r) => { router = r; };

export function navigate(to) {
  return router.push('/' + to.replace(/^\//, ''));
}
