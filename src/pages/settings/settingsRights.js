// Droits de l'utilisateur sur la section de paramètres affichée : ajouter, modifier, archiver (catalogue « ressource.action »).
import { computed, inject } from 'vue';
import { useStore } from '../../store';
import { SETTINGS_RESOURCES } from '../../config/access';

/** Clé d'injection : id de la section affichée (fournie par SettingsPage). */
export const SETTINGS_SECTION = Symbol('settingsSection');

/**
 * { canCreate, canEdit, canArchive } pour la ressource de la section courante (ou `resource` si précisée) : les boutons
 * correspondants sont masqués sans la permission (le backend refuse de toute façon).
 */
export function useSettingsRights(resource) {
  const store = useStore();
  const section = inject(SETTINGS_SECTION, undefined);
  const res = computed(() => resource ?? SETTINGS_RESOURCES[section?.value]);
  return {
    canCreate: computed(() => store.can(`${res.value}.creer`)),
    canEdit: computed(() => store.can(`${res.value}.modifier`)),
    canArchive: computed(() => store.can(`${res.value}.archiver`)),
  };
}
