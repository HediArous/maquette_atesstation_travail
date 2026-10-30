import { ref, watch } from 'vue';
import { employeeHistoryApi, fromEmployeeHistoryDto } from '../api/employeeHistory';

/**
 * Historique d'un employé lu sur le serveur. `fetchPage(employeeId)` renvoie la réponse de l'API (liste ou page) ;
 * `sources` : getters qui relancent le chargement quand ils changent (employé, société active, fiche modifiée, filtres).
 * En cas d'erreur, la liste reste vide : aucune donnée de remplacement n'est affichée.
 */
export function useEmployeeHistory(employeeId, fetchPage, sources = []) {
  const items = ref([]);
  const total = ref(0);
  const totalPages = ref(0);
  const loading = ref(true);
  const error = ref('');

  // La dernière requête lancée l'emporte (changement d'employé ou de filtre pendant un chargement).
  let requestId = 0;
  async function load() {
    const id = ++requestId;
    const target = employeeId();
    if (!target) return;
    loading.value = true;
    try {
      const res = await fetchPage(target);
      if (id !== requestId) return;
      const list = Array.isArray(res) ? res : res.content;
      items.value = list.map(fromEmployeeHistoryDto);
      total.value = Array.isArray(res) ? list.length : res.totalElements;
      totalPages.value = Array.isArray(res) ? 1 : res.totalPages;
      error.value = '';
    } catch (e) {
      if (id !== requestId) return;
      items.value = [];
      total.value = 0;
      totalPages.value = 0;
      error.value = e.message;
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  watch([employeeId, ...sources], load, { immediate: true });
  return { items, total, totalPages, loading, error, load };
}

export const recentActivity = (employeeId, sources, limit = 5) =>
  useEmployeeHistory(employeeId, (id) => employeeHistoryApi.recent(id, limit), sources);
