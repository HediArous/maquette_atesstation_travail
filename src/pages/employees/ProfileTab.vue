<script setup>
import { computed, ref } from 'vue';
import { RotateCcw, Scale } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Field from '../../components/ui/Field.vue';
import FormCard from '../../components/FormCard.vue';
import SaveBar from '../../components/SaveBar.vue';
import { formatDays, YEAR } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance } from '../../utils/leave';
import { dayHours, formatDaysHours, formatHours } from '../../utils/hours';

/** Soldes de l'année et reports de l'année précédente d'un employé. */
const props = defineProps({
  profile: { type: Object, required: true },
});

const store = useStore();
const data = useCompanyData();
const carry = ref({ ...props.profile.carryOver });

const balances = computed(() => balanceTypes(store.db, props.profile.companyId));
const own = computed(() => balances.value.own);
// Le report s'applique au solde annuel (porté par le type de référence) et aux plafonds propres.
const carryTypes = computed(() => [...(balances.value.ref ? [balances.value.ref] : []), ...own.value]);
const deducting = computed(() => data.leaveTypes.filter((t) => t.deductsFromAnnual && !t.archived));
const annual = computed(() => getAnnualBalance(store.db, props.profile.employeeId));
const perDay = computed(() => dayHours(store.db.schedules.find((x) => x.id === props.profile.scheduleId)));
const dirty = computed(() => JSON.stringify(carry.value) !== JSON.stringify(props.profile.carryOver));

function save() {
  store.saveProfile({ ...props.profile, carryOver: { ...carry.value } });
  store.toast('Profil congé mis à jour');
}
</script>

<!-- <template>
  <div class="emp-leave">
    <FormCard :title="`Soldes ${YEAR}`" subtitle="Jours non travaillés et jours fériés exclus du décompte.">
      <template #icon><Scale :size="16" /></template>
      <div class="annual-card">
        <div>
          <p class="annual-label">Solde annuel disponible</p>
          <p class="annual-value">{{ formatDaysHours(annual.available, perDay) }} <span>sur {{ formatDays(annual.acquired) }}</span></p>
          <p class="small text-muted">Pris {{ formatDaysHours(annual.taken, perDay) }} · en attente {{ formatDaysHours(annual.pending, perDay) }} · journée = {{ formatHours(perDay) }}</p>
        </div>
        <div class="annual-types">
          <p class="small text-muted">Types imputés :</p>
          <span v-for="t in deducting" :key="t.id" class="type-tag small"><span class="type-dot" :style="{ background: t.color }" aria-hidden="true" />{{ t.name }}</span>
        </div>
      </div>
      <h3 v-if="own.length > 0" class="sub-title">Hors solde annuel — plafonds propres</h3>
      <table v-if="own.length > 0" class="table table-compact">
        <thead><tr><th scope="col">Type</th><th scope="col" class="num">Acquis</th><th scope="col" class="num">Pris</th><th scope="col" class="num">En attente</th><th scope="col" class="num">Disponible</th></tr></thead>
        <tbody>
          <tr v-for="t in own" :key="t.id">
            <td><span class="type-tag"><span class="type-dot" :style="{ background: t.color }" aria-hidden="true" />{{ t.name }}</span></td>
            <td class="num">{{ formatDays(getBalance(store.db, profile.employeeId, t.id).acquired) }}</td>
            <td class="num">{{ formatDays(getBalance(store.db, profile.employeeId, t.id).taken) }}</td>
            <td class="num">{{ formatDays(getBalance(store.db, profile.employeeId, t.id).pending) }}</td>
            <td class="num"><strong>{{ formatDays(getBalance(store.db, profile.employeeId, t.id).available) }}</strong></td>
          </tr>
        </tbody>
      </table>
      <p class="source-note">Quotas définis dans Paramètres › Règles et quotas, auxquels s’ajoutent les reports saisis.</p>
    </FormCard>
    <FormCard title="Reports de l’année précédente" subtitle="Ajoutés aux droits de l’année ; saisis par la RH.">
      <template #icon><RotateCcw :size="16" /></template>
      <p v-if="carryTypes.length === 0" class="fempty">Aucun type de congé avec quota : paramétrez-en un dans Paramètres › Règles et quotas.</p>
      <div v-else class="form-grid one-col">
        <Field v-for="t in carryTypes" :key="t.id" :label="t.annualReference ? 'Solde annuel (jours)' : `${t.name} (jours)`">
          <template #default="{ id }">
            <input :id="id" type="number" min="0" step="0.5" :value="carry[t.id] ?? 0" @input="carry = { ...carry, [t.id]: Number($event.target.value) }" />
          </template>
        </Field>
      </div>
      <SaveBar :dirty="dirty" @reset="carry = { ...profile.carryOver }" @save="save" />
    </FormCard>
  </div>
</template> -->
