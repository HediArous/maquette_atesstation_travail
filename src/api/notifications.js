// Notifications de l'utilisateur connecté (/api/notifications) et alerte d'expiration des contrats (/api/contract-alert-settings).
import { request, streamEvents } from './client';

export const notificationsApi = {
  /** Notifications visibles (permissions de l'utilisateur), plus récentes d'abord : { id, type, title, message, link, dueDate, createdAt, read }. */
  list: () => request('GET', '/notifications'),
  markRead: (id) => request('POST', `/notifications/${id}/read`),
  markAllRead: () => request('POST', '/notifications/read-all'),
  /** Retire la notification de la liste de l'utilisateur (les autres la gardent). */
  dismiss: (id) => request('DELETE', `/notifications/${id}`),
  dismissAll: () => request('DELETE', '/notifications'),
  /**
   * Flux temps réel : `onChange` à chaque changement, et à chaque (re)connexion pour rattraper ce qui a pu être manqué
   * pendant une coupure ; renvoie une fonction d'arrêt.
   */
  subscribe: (onChange) => streamEvents('/notifications/stream', (event) => { if (event === 'notifications' || event === 'ready') onChange(); }),
};

export const contractAlertApi = {
  /** { enabled, daysBefore } de la société de la session (par défaut : activée, 30 jours). */
  get: () => request('GET', '/contract-alert-settings'),
  update: (setting) => request('PUT', '/contract-alert-settings', { enabled: !!setting.enabled, daysBefore: Number(setting.daysBefore) }),
};
