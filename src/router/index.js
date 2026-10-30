// Routes de l'Application RH (adresses sans « # » : /employes/e1, /conges/demandes/q1…) :
//   /tableau-de-bord, /employes[/nouveau|/:id], /contrats, /salaires, /conges/demandes[/nouvelle|/:id], /conges/soldes,
//   /calendrier[/perso], /evenements, /chargement, /parametres/:section
// Les pages sont chargées à la demande ; elles importent `navigate` (router/navigate.js), jamais ce fichier.
import { createRouter, createWebHistory } from 'vue-router';
import { setRouter } from './navigate';
import { SETTINGS_NAV } from '../pages/settings/nav';
import { requiredForRoute, SETTINGS_PERMISSIONS } from '../config/access';
import { useStore } from '../store';

const withParam = (route) => ({ param: route.params.param });

const routes = [
  {
    path: '/',
    component: () => import('../layouts/RhLayout.vue'),
    children: [
      { path: '', redirect: '/tableau-de-bord' },
      { path: 'tableau-de-bord', component: () => import('../pages/dashboard/DashboardPage.vue') },
      { path: 'employes/:param?', component: () => import('../pages/employees/EmployeesPage.vue'), props: withParam },
      { path: 'contrats', component: () => import('../pages/contracts/ContractsPage.vue') },
      { path: 'documents-rh', component: () => import('../pages/attestations/AttestationsPage.vue'), props: { selfOnly: false } },
      { path: 'mes-documents', component: () => import('../pages/attestations/AttestationsPage.vue'), props: { selfOnly: true } },
      { path: 'salaires', component: () => import('../pages/salaries/SalariesPage.vue') },
      { path: 'conges', redirect: '/conges/demandes' },
      { path: 'conges/demandes/:param?', component: () => import('../pages/leave/RequestsPage.vue'), props: withParam },
      { path: 'conges/soldes', component: () => import('../pages/leave/BalancesPage.vue') },
      { path: 'calendrier/:param?', component: () => import('../pages/calendar/CalendarPage.vue'), props: withParam },
      { path: 'evenements', component: () => import('../pages/events/EventsPage.vue') },
      { path: 'chargement', component: () => import('../pages/loading/LoadingBoardPage.vue') },
      // Paramètres : s'ouvrent sur la première section de la sous-navigation.
      { path: 'parametres', redirect: `/parametres/${SETTINGS_NAV[0].id}` },
      { path: 'parametres/numero-interne', redirect: '/parametres/modules-societe' },
      { path: 'parametres/:param', component: () => import('../pages/settings/SettingsPage.vue'), props: withParam },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  // Historique HTML5 : le serveur doit renvoyer index.html pour toute adresse de l'application (Vite le fait en développement).
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

// Route non permise à l'utilisateur connecté : première section des paramètres permise, sinon tableau de bord.
router.beforeEach(async (to) => {
  const store = useStore();
  await store.loadMe();
  const [section, sub] = to.path.split('/').filter(Boolean);
  if (store.allows(requiredForRoute(section, sub))) return true;
  if (section === 'parametres') {
    const first = SETTINGS_NAV.find((s) => store.allows(SETTINGS_PERMISSIONS[s.id]));
    if (first) return `/parametres/${first.id}`;
  }
  return '/tableau-de-bord';
});

setRouter(router);

/**
 * Liens internes écrits en <a href="/employes/…"> : navigation par le routeur (sans recharger la page). Les liens externes
 * (Core Tenant), les ancres de la page (#main), les nouveaux onglets et les clics avec modificateur restent natifs.
 */
export function interceptInternalLinks() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || a.origin !== window.location.origin) return;
    e.preventDefault();
    router.push(`${a.pathname}${a.search}${a.hash}`);
  });
}
