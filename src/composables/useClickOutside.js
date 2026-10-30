import { onBeforeUnmount, ref, watch } from 'vue';

/**
 * Ferme un panneau à l'appui sur Échap ou au clic en dehors de son conteneur.
 * `isOpen` : ref/computed booléen ; retourne la ref à poser sur le conteneur (`ref="..."`).
 */
export function useClickOutside(isOpen, close) {
  const el = ref(null);
  const onDown = (e) => { if (!el.value?.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const stop = () => {
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('keydown', onKey);
  };
  watch(isOpen, (open) => {
    stop();
    if (open) {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }
  }, { immediate: true });
  onBeforeUnmount(stop);
  return el;
}
