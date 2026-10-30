// L'ordre des feuilles de style est celui de la maquette d'origine (base, affinements).
import './assets/styles.css';
import './assets/refine.css';
// Notifications : Vue Toastification, avec l'apparence du Core Tenant (toast.css après la feuille de la bibliothèque).
import 'vue-toastification/dist/index.css';
import './assets/toast.css';

import { initCoreSession } from './session/coreSession';

// Ouverture depuis le Core Tenant : le contexte (utilisateur, sociétés, rôles) est récupéré AVANT de charger le store,
// qui en déduit les sociétés et la société active dès son initialisation.
initCoreSession().finally(async () => {
  const [{ createApp }, { default: Toast }, { default: App }, { router, interceptInternalLinks }, { toastOptions }] = await Promise.all([
    import('vue'), import('vue-toastification'), import('./App.vue'), import('./router'), import('./config/toast'),
  ]);
  createApp(App).use(router).use(Toast, toastOptions).mount('#app');
  interceptInternalLinks();
});
