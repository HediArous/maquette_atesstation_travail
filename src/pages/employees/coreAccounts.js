// Comptes du Core Tenant proposés à la liaison avec un employé (formulaire employé, onglet Accès).
import { computed, toValue } from 'vue';
import { useStore } from '../../store';
import { coreUserLabel } from '../../api/employeeAccess';

/**
 * Options du sélecteur « Compte Core Tenant » : un compte lié à un autre employé ou désactivé n'est pas sélectionnable ; le
 * compte actuel reste affiché même s'il n'est plus rattaché à l'Application RH dans le Core.
 * @param currentId identifiant du compte actuellement choisi (ref, getter ou valeur)
 * @param employeeId employé édité (ref, getter ou valeur ; vide à la création)
 */
export function useCoreAccountOptions(currentId, employeeId) {
  const store = useStore();
  return computed(() => {
    const current = toValue(currentId);
    const self = toValue(employeeId);
    const options = store.coreUsers.map((u) => {
      const other = u.employeeId && u.employeeId !== self;
      const disabled = u.status !== 'ACTIVE';
      const note = other ? ` — lié à ${u.employeeName}` : disabled ? ' — désactivé' : u.pendingActivation ? ' — activation en attente' : '';
      return { id: u.id, label: `${coreUserLabel(u)} (${u.email})${note}`, disabled: u.id !== current && (other || disabled) };
    });
    if (current && store.coreUsersStatus === 'ready' && !options.some((o) => o.id === current)) {
      options.unshift({ id: current, label: 'Compte retiré de l’Application RH dans le Core Tenant', disabled: false });
    }
    return options;
  });
}
