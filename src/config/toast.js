import { POSITION } from 'vue-toastification';

/**
 * Configuration centralisée des notifications toast (identique au Core Tenant).
 * L'apparence (carte blanche, accent coloré, pastille d'icône) est définie dans assets/toast.css,
 * le contenu dans components/ui/ToastContent.vue ; passer par store.toast(message, tone, title).
 * @type {import('vue-toastification').PluginOptions}
 */
export const toastOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 4000,
  closeOnClick: true,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  draggable: false,
  hideProgressBar: false,
  closeButton: 'button',
  // L'icône est rendue par ToastContent, dans une pastille assortie au type.
  icon: false,
  maxToasts: 4,
  newestOnTop: true,
  transition: 'Vue-Toastification__fade',
};
