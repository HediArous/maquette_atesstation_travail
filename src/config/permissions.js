// Catalogue des permissions de l'application RH (RH-18) : défini par le backend (Permissions.java) et lu au démarrage
// (GET /api/permissions). Les tableaux sont réactifs : les écrans qui les lisent se mettent à jour une fois le catalogue
// chargé. Une clé absente du catalogue (permission retirée du produit) n'est ni affichée ni accordée.
import { reactive } from 'vue';

/** [{ key, label, group }], dans l'ordre d'affichage. */
export const PERMISSIONS = reactive([]);

/** Clés du catalogue. */
export const ALL_PERMISSIONS = reactive([]);

/** Chargement du catalogue : 'loading' | 'ready' | 'error'. */
export const permissionCatalog = reactive({ status: 'loading', error: '' });

/** Remplace le catalogue par celui lu du backend. */
export function setPermissionCatalog(list) {
  PERMISSIONS.splice(0, PERMISSIONS.length, ...list);
  ALL_PERMISSIONS.splice(0, ALL_PERMISSIONS.length, ...list.map((p) => p.key));
  permissionCatalog.status = 'ready';
  permissionCatalog.error = '';
}

/** Fonctionnalités RH, dans l'ordre du catalogue. */
export const permissionGroups = () => [...new Set(PERMISSIONS.map((p) => p.group))];

/** « Consulter » de la ressource d'une permission (« contrats.modifier » → « contrats.consulter »), s'il existe. */
export const consultOf = (key) => {
  const consult = `${key.split('.')[0]}.consulter`;
  return consult !== key && ALL_PERMISSIONS.includes(consult) ? consult : undefined;
};

/** Ne garde que les permissions du catalogue (un ancien rôle peut porter des clés retirées). */
export const knownPermissions = (keys) => keys.filter((k) => ALL_PERMISSIONS.includes(k));
