<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, ref } from 'vue';
import {
  Archive, ArchiveRestore, Bell, Building2, CalendarDays, Check, ChevronRight, CircleCheck, Eye, GitBranch, Pencil, Plus, Send,
  SkipForward, Users,
} from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import Card from '../../components/ui/Card.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Switch from '../../components/ui/Switch.vue';
import { circuitForDepartment, circuitStepsFor } from '../../utils/org';
import CircuitDetail from './CircuitDetail.vue';
import CircuitEditor from './CircuitEditor.vue';
import { circuitPeriod, circuitState } from './circuits';

/**
 * Circuits d'approbation de la société (RH-22, backend /api/approval-circuits) : un circuit par département ou
 * sous-département, appliqué automatiquement à ses employés (RH-23) ; un sous-département sans circuit propre hérite de
 * celui de son département. Pour changer un circuit, on modifie le même ; l'archiver libère le département.
 */
const store = useStore();
const { canCreate, canEdit, canArchive } = useSettingsRights();
const data = useCompanyData();
const showArchived = ref(true);
// Aperçu facultatif : étapes résolues et ignorées pour un employé donné.
const simEmployeeId = ref('');
// Fenêtres : fiche, éditeur (création / modification).
const viewing = ref();
const editing = ref();

const simEmployee = computed(() => data.person(simEmployeeId.value));
const circuits = computed(() => [...data.circuits]
  .filter((c) => showArchived.value || !c.archived)
  .sort((a, b) => a.archived - b.archived || data.departmentName(a.departmentId)?.localeCompare(data.departmentName(b.departmentId))));
const archivedCount = computed(() => data.circuits.filter((c) => c.archived).length);
// Départements sans circuit (ni propre, ni hérité) : les sous-départements héritent de leur département.
const uncovered = computed(() => data.activeDepartments.filter((d) => !circuitForDepartment(store.db, d.id)));
// « Finance › Comptabilité » pour un sous-département.
const departmentLabel = (c) => {
  const d = data.department(c.departmentId);
  const parent = d?.parentId ? data.department(d.parentId) : undefined;
  return parent ? `${parent.name} › ${d.name}` : d?.name;
};

const usersOf = (c) => data.profiles.filter((p) => p.circuitId === c.id).length;
const appliesToSim = (c) => !!simEmployee.value && data.profile(simEmployee.value.id)?.circuitId === c.id;
const stepsFor = (c) => (simEmployee.value ? circuitStepsFor(store.db, simEmployee.value.id, c) : []);
const SKIP_LABEL = { requester: 'Demandeur : ignorée', below: 'Niveau inférieur : ignorée', duplicate: 'Doublon : ignorée', undefined: 'Non défini : ignorée' };
// Présentation des étapes : icône, libellé court et précision par type d'approbateur.
const KIND_SHORT = { manager: 'Manager direct', departmentHead: 'Responsable' };
const KIND_HINT = { manager: 'N+1 du demandeur', departmentHead: 'Du département du demandeur' };
const personName = (p) => (p ? `${p.firstName} ${p.lastName}` : '');
// Infobulle d'une étape : qui approuve, notification, motif d'une étape ignorée dans l'aperçu.
function stepTitle(c, s, i) {
  const who = s.kind === 'employee' ? data.person(s.employeeId)?.functionName || 'Personne nommée' : KIND_HINT[s.kind];
  const sim = simEmployee.value ? stepsFor(c)[i] : undefined;
  const simText = sim?.skipped ? ` — ${SKIP_LABEL[sim.skipped] ?? 'ignorée'}` : sim && stepPerson(c, i) ? ` — ${personName(stepPerson(c, i))}` : '';
  return `Étape ${i + 1} : ${who}${s.intervention === 'consultation' ? ' · consultation seule (pour info)' : ' · validation requise'}${s.notify ? ' · notifié' : ''}${simText}`;
}

function stepPerson(c, i) {
  const s = stepsFor(c)[i];
  return s && data.person(s.approverId);
}

const create = () => { editing.value = {}; };
const edit = (c) => { viewing.value = undefined; editing.value = { circuit: c }; };

// Archiver libère le département : un autre circuit pourra lui être affecté.
function archive(c) {
  store.setArchived('circuits', c.id, true);
}

function restore(c) {
  store.setArchived('circuits', c.id, false);
}

function onSaved({ saved }) {
  store.toast(editing.value?.circuit ? `Circuit « ${saved.name} » mis à jour` : `Circuit « ${saved.name} » créé`);
  editing.value = undefined;
}
</script>

<template>
  <Alert v-if="store.circuitsStatus === 'error'" tone="danger" title="Circuits non chargés">
    {{ store.circuitsError }} <button type="button" class="link-btn" @click="store.loadCircuits()">Réessayer</button>
  </Alert>
  <Alert v-if="uncovered.length > 0 && store.circuitsStatus === 'ready'" tone="warning" title="Départements sans circuit">
    {{ uncovered.map((d) => d.name).join(', ') }} : la création et la mutation d’employés y sont bloquées tant qu’aucun circuit ne s’y applique.
  </Alert>
  <Card title="Circuits d’approbation" flush>
    <template #actions><button v-if="canCreate" type="button" class="btn btn-primary btn-sm" @click="create"><Plus :size="15" aria-hidden="true" /> Nouveau circuit</button></template>
    <div class="cc-toolbar">
      <p class="small text-muted">
        Un circuit par département ; un sous-département sans circuit propre hérite de celui de son département. Les étapes vont du niveau
        le moins élevé au plus élevé ; pour changer un circuit, modifiez-le.
      </p>
      <div class="cc-tools">
        <label v-if="data.people.length > 0 && data.circuits.length > 0" class="cc-sim">
          <span class="small text-muted">Aperçu pour</span>
          <select v-model="simEmployeeId" aria-label="Employé pour l’aperçu des étapes">
            <option value="">Aucun employé</option>
            <option v-for="e in data.people.filter((x) => x.status !== 'inactif')" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }} — {{ data.departmentName(e.departmentId) }}</option>
          </select>
        </label>
        <Switch v-model="showArchived" :label="`Archivés (${archivedCount})`" />
      </div>
    </div>

    <EmptyState v-if="circuits.length === 0" title="Aucun circuit" text="Créez un circuit par département : sans circuit, aucun employé ne peut y être créé." />
    <ul v-else class="cc-list">
      <li v-for="c in circuits" :key="c.id" :class="['cc', `is-${circuitState(c).key}`, { 'is-archived': c.archived }]">
        <span class="cc-icon" aria-hidden="true"><GitBranch :size="16" /></span>
        <div class="cc-body">
          <div class="cc-row">
            <button type="button" class="cc-name" :title="`Consulter la fiche de « ${c.name} »`" @click="viewing = c">{{ c.name }}</button>
            <Badge :tone="circuitState(c).tone">{{ circuitState(c).label }}</Badge>
            <ArchivedBadge v-if="c.archived" />
            <Badge v-if="appliesToSim(c)" tone="info">Circuit de {{ simEmployee?.firstName }}</Badge>
            <ul class="cc-meta" aria-label="Informations du circuit">
              <li class="cc-chip strong"><Building2 :size="12" aria-hidden="true" /> {{ departmentLabel(c) }}</li>
              <li class="cc-chip"><CalendarDays :size="12" aria-hidden="true" /> {{ circuitPeriod(c) }}</li>
              <li class="cc-chip" :title="`${usersOf(c)} employé${usersOf(c) > 1 ? 's' : ''} concerné${usersOf(c) > 1 ? 's' : ''} aujourd’hui`"><Users :size="12" aria-hidden="true" /> {{ usersOf(c) }}<span class="sr-only"> employé(s)</span></li>
            </ul>
          </div>

          <ol class="cc-flow" :aria-label="`Étapes de ${c.name}`">
            <li class="cc-pill terminal"><Send :size="12" aria-hidden="true" /> Demande</li>
            <template v-for="(s, i) in c.steps" :key="i">
              <li class="cc-sep" aria-hidden="true"><ChevronRight :size="14" /></li>
              <li :class="['cc-pill', { skipped: simEmployee && stepsFor(c)[i]?.skipped }]" :title="stepTitle(c, s, i)">
                <span class="cc-num">{{ i + 1 }}</span>
                <span class="cc-step-name">{{ s.kind === 'employee' ? personName(data.person(s.employeeId)) || 'Personne nommée' : KIND_SHORT[s.kind] }}</span>
                <span v-if="simEmployee && !stepsFor(c)[i]?.skipped && stepPerson(c, i) && s.kind !== 'employee'" class="cc-who">
                  <Avatar :employee="stepPerson(c, i)" :size="16" /> {{ personName(stepPerson(c, i)) }}
                </span>
                <span v-else-if="simEmployee && stepsFor(c)[i]?.skipped" class="cc-who"><SkipForward :size="11" aria-hidden="true" /> ignorée</span>
                <Eye v-if="s.intervention === 'consultation'" :size="12" class="cc-bell" aria-label="pour information" />
                <Bell v-if="s.notify" :size="12" class="cc-bell" aria-label="notifié" />
              </li>
            </template>
            <li class="cc-sep" aria-hidden="true"><ChevronRight :size="14" /></li>
            <li class="cc-pill terminal end"><Check :size="12" aria-hidden="true" /> Approuvée</li>
            <li v-if="simEmployee && stepsFor(c).length > 0 && stepsFor(c).every((x) => x.skipped)" class="cc-flag success" title="Aucun approbateur supérieur : approbation automatique, historisée">
              <CircleCheck :size="12" aria-hidden="true" /> Auto pour {{ simEmployee.firstName }}
            </li>
          </ol>
        </div>

        <div class="cc-actions">
          <button type="button" class="icon-btn" :aria-label="`Consulter ${c.name}`" title="Consulter la fiche" @click="viewing = c"><Eye :size="15" /></button>
          <template v-if="!c.archived">
            <button v-if="canEdit" type="button" class="icon-btn" :aria-label="`Modifier ${c.name}`" title="Modifier" @click="edit(c)"><Pencil :size="15" /></button>
            <button v-if="canArchive" type="button" class="icon-btn" :aria-label="`Archiver ${c.name}`" title="Archiver (libère le département)" @click="archive(c)"><Archive :size="15" /></button>
          </template>
          <button v-else-if="canArchive" type="button" class="icon-btn" :aria-label="`Restaurer ${c.name}`" title="Restaurer" @click="restore(c)"><ArchiveRestore :size="15" /></button>
        </div>
      </li>
    </ul>
  </Card>

  <CircuitDetail v-if="viewing" :circuit="data.circuit(viewing.id) ?? viewing" @close="viewing = undefined" @edit="edit" />
  <CircuitEditor v-if="editing" :circuit="editing.circuit" @close="editing = undefined" @saved="onSaved" />
</template>

<style scoped>
.cc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.cc-toolbar p { flex: 1 1 360px; margin: 0; }
.cc-tools { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.cc-sim { display: flex; align-items: center; gap: 8px; }
.cc-sim select { height: 30px; max-width: 240px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: 6px; background: #fff; font: inherit; font-size: 13px; }

.cc-list { list-style: none; margin: 0; padding: 0; }
.cc { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px 12px 18px; border-bottom: 1px solid var(--border); }
.cc:last-child { border-bottom: 0; }
.cc:hover { background: #fafbfc; }
/* Liseré d'état à gauche. */
.cc::before { content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; background: var(--border-strong); }
.cc.is-current::before { background: #12b76a; }
.cc.is-ending::before { background: #f79009; }
.cc.is-upcoming::before { background: var(--primary); }
.cc.is-archived { background: var(--surface-2); }
.cc.is-archived .cc-flow, .cc.is-archived .cc-icon { opacity: .6; }

.cc-icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 8px; background: var(--primary-soft); color: var(--primary); }
.cc-body { flex: 1; min-width: 0; display: grid; gap: 8px; }
.cc-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 30px; }
.cc-name { padding: 0; border: 0; background: none; font: inherit; font-size: 14.5px; font-weight: 600; color: var(--text); text-align: left; cursor: pointer; }
.cc-name:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
.cc-name:focus-visible { box-shadow: var(--focus); border-radius: 4px; outline: none; }
.cc-meta { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 0 4px; padding: 0; list-style: none; }
.cc-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 5px; background: var(--surface-2); font-size: 11.5px; color: var(--text-2); white-space: nowrap; }
.cc-chip.strong { background: var(--primary-soft); color: var(--primary); font-weight: 500; }
.cc-chip svg { flex: none; opacity: .8; }

/* Étapes : pastilles enchaînées, à la largeur du contenu. */
.cc-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.cc-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px 0 4px; border: 1px solid var(--border); border-radius: 999px; background: #fff; font-size: 12.5px; color: var(--text); white-space: nowrap; }
.cc-pill.terminal { padding: 0 9px; gap: 5px; color: var(--muted); background: var(--surface-2); border-color: transparent; }
.cc-pill.end { color: #067647; background: #ecfdf3; }
.cc-num { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.cc-step-name { font-weight: 500; }
.cc-who { display: inline-flex; align-items: center; gap: 4px; padding-left: 6px; border-left: 1px solid var(--border); font-size: 11.5px; color: var(--muted); }
.cc-bell { color: var(--primary); flex: none; }
.cc-sep { display: grid; place-items: center; color: var(--border-strong); }
.cc-pill.skipped { border-style: dashed; background: transparent; color: var(--muted); }
.cc-pill.skipped .cc-num { background: var(--border-strong); }
.cc-pill.skipped .cc-step-name { text-decoration: line-through; }
.cc-flag { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; height: 22px; padding: 0 8px; border-radius: 5px; background: var(--primary-soft); color: var(--primary); font-size: 11.5px; font-weight: 500; }
.cc-flag.in-meta { margin-left: 0; height: 20px; padding: 0 7px; }
.cc-flag.success { background: #ecfdf3; color: #067647; }
.cc-flag-btn { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
.cc-flag-btn:hover { text-decoration: underline; }

.cc-actions { display: flex; align-items: center; gap: 0; flex: none; }

@media (max-width: 720px) {
  .cc { flex-wrap: wrap; }
  .cc-icon { display: none; }
  .cc-actions { order: -1; width: 100%; justify-content: flex-end; margin-bottom: -6px; }
  .cc-meta { margin-left: 0; }
}
</style>
