<script setup>
import { computed, ref } from 'vue';
import { ArrowLeft, CalendarCheck, CalendarDays, Check, ChevronDown, Menu, Search, UserRound } from '@lucide/vue';
import { useClickOutside } from '../composables/useClickOutside';
import { useStore } from '../store';
import { useCompanyData } from '../store/companyData';
import { navigate } from '../router/navigate';
import Avatar from '../components/ui/Avatar.vue';
import CompanyLogo from '../components/CompanyLogo.vue';
import RhLogo from '../components/RhLogo.vue';
import NotificationCenter from './NotificationCenter.vue';
import { formatRange } from '../utils/dates';
import { CORE_ROLE_LABEL, CORE_URL, coreRoleIn, coreSession } from '../session/coreSession';

defineEmits(['menu']);

const store = useStore();
const data = useCompanyData();

const panel = ref('');
const query = ref('');
const close = () => { panel.value = ''; };
const toggle = (name) => { panel.value = panel.value === name ? '' : name; };
const companyRef = useClickOutside(computed(() => panel.value === 'company'), close);
const profileRef = useClickOutside(computed(() => panel.value === 'profile'), close);
const searchRef = useClickOutside(computed(() => panel.value === 'search'), close);

const company = computed(() => data.company);
const rhCompanies = computed(() => store.companiesFor('rh'));
/** Ouvert depuis le Core : l'utilisateur Core (nom, e-mail) et son rôle dans la société active ; sinon la fiche employé. */
const coreUser = computed(() => coreSession.context?.user);
const me = computed(() => coreUser.value ?? store.currentUser);
const myRole = computed(() => CORE_ROLE_LABEL[coreRoleIn(store.companyId)]
  ?? data.role(data.profile(store.currentUser.id)?.roleId)?.name ?? 'Employé');
/** Ligne secondaire d'une société du menu : rôle Core, sinon la ville. */
const companySub = (c) => CORE_ROLE_LABEL[coreRoleIn(c.id)] ?? c.city;

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (q.length < 2) return null;
  const { db, companyId } = store;
  const emps = db.employees.filter((e) => e.companyId === companyId && `${e.firstName} ${e.lastName} ${e.matricule}`.toLowerCase().includes(q)).slice(0, 5);
  const reqs = db.requests.filter((r) => {
    const p = db.employees.find((d) => d.id === r.employeeId);
    return r.companyId === companyId && `${p?.firstName} ${p?.lastName}`.toLowerCase().includes(q);
  }).slice(0, 4);
  return { emps, reqs };
});
const total = computed(() => (results.value ? results.value.emps.length + results.value.reqs.length : 0));

const go = (to) => { navigate(to); query.value = ''; close(); };
const personOf = (id) => store.db.employees.find((d) => d.id === id);

function chooseCompany(id) {
  store.setCompanyId(id);
  close();
  navigate('tableau-de-bord');
}

function onSearchInput(e) {
  query.value = e.target.value;
  panel.value = 'search';
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button type="button" class="icon-btn menu-btn" aria-label="Ouvrir le menu" @click="$emit('menu')"><Menu :size="20" /></button>
      <a href="/tableau-de-bord" class="brand">
        <RhLogo />
        <span class="brand-text"><span class="brand-name">Application RH</span></span>
      </a>
      <div ref="companyRef" class="dropdown-wrap">
        <button type="button" class="tenant-btn" aria-haspopup="menu" :aria-expanded="panel === 'company'"
          :aria-label="`Société active : ${company.name}. Changer de société`" @click="toggle('company')">
          <CompanyLogo :company="company" :size="28" />
          <span class="tenant-name">{{ company.name }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <div v-if="panel === 'company'" class="dropdown" role="menu">
          <p class="dropdown-title">{{ coreUser ? 'Vos sociétés' : 'Sociétés ayant l’Application RH' }}</p>
          <button v-for="c in rhCompanies" :key="c.id" role="menuitemradio" :aria-checked="c.id === store.companyId" type="button" class="dropdown-item"
            @click="chooseCompany(c.id)">
            <CompanyLogo :company="c" :size="22" />
            <span class="grow"><span class="dropdown-strong">{{ c.name }}</span><span class="dropdown-sub">{{ companySub(c) }}</span></span>
            <Check v-if="c.id === store.companyId" :size="15" aria-hidden="true" class="text-primary" />
          </button>
        </div>
      </div>
    </div>

    <div ref="searchRef" class="search dropdown-wrap">
      <Search :size="16" class="search-icon" aria-hidden="true" />
      <input type="search" placeholder="Rechercher" aria-label="Recherche globale"
        :value="query" @input="onSearchInput" @focus="panel = 'search'" />
      <div v-if="panel === 'search' && results" class="dropdown search-results">
        <p v-if="total === 0" class="dropdown-empty">Aucun résultat pour « {{ query }} »</p>
        <p v-if="results.emps.length > 0" class="dropdown-title">Employés</p>
        <button v-for="e in results.emps" :key="e.id" type="button" class="dropdown-item" @click="go(`employes/${e.id}`)">
          <Avatar :employee="e" :size="24" />
          <span><span class="dropdown-strong">{{ e.firstName }} {{ e.lastName }}</span><span class="dropdown-sub">{{ e.matricule }}</span></span>
        </button>
        <p v-if="results.reqs.length > 0" class="dropdown-title">Demandes de congé</p>
        <button v-for="r in results.reqs" :key="r.id" type="button" class="dropdown-item" @click="go(`conges/demandes/${r.id}`)">
          <CalendarCheck :size="15" aria-hidden="true" />
          <span><span class="dropdown-strong">{{ personOf(r.employeeId)?.firstName }} {{ personOf(r.employeeId)?.lastName }}</span><span class="dropdown-sub">{{ formatRange(r.start, r.end) }}</span></span>
        </button>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Retour à l'espace Core Tenant (« Mes applications »), depuis toutes les pages. -->
      <a :href="`${CORE_URL}/`" class="core-back" title="Revenir au Core Tenant (« Mes applications »)" aria-label="Revenir au Core Tenant">
        <ArrowLeft :size="15" aria-hidden="true" /><span class="core-back-label">Core Tenant</span>
      </a>
      <NotificationCenter />
      <div ref="profileRef" class="dropdown-wrap">
        <button type="button" class="profile-btn" aria-haspopup="menu" :aria-expanded="panel === 'profile'"
          :aria-label="`Profil de ${me.firstName} ${me.lastName}`" @click="toggle('profile')">
          <Avatar :employee="me" :size="30" />
        </button>
        <div v-if="panel === 'profile'" class="dropdown dropdown-right" role="menu">
          <div class="profile-card">
            <Avatar :employee="me" :size="36" />
            <span>
              <span class="dropdown-strong">{{ me.firstName }} {{ me.lastName }}</span>
              <span class="dropdown-sub">{{ me.email }}</span>
              <span class="dropdown-time">{{ myRole }} · {{ company.name }}</span>
            </span>
          </div>
          <p v-if="coreUser" class="dropdown-sub profile-tenant">Connecté via le Core Tenant · {{ coreSession.context.tenant.name }}</p>
          <button role="menuitem" type="button" class="dropdown-item" :disabled="!store.currentUser.id" @click="go(`employes/${store.currentUser.id}`)"><UserRound :size="15" aria-hidden="true" /> Ma fiche</button>
          <button role="menuitem" type="button" class="dropdown-item" @click="go('calendrier/perso')"><CalendarDays :size="15" aria-hidden="true" /> Mon calendrier</button>
          <button role="menuitem" type="button" class="dropdown-item" @click="go('conges/demandes/nouvelle')"><CalendarCheck :size="15" aria-hidden="true" /> Demander un congé</button>
        </div>
      </div>
    </div>
  </header>
</template>
<style scoped>
/* Bouton de retour au Core Tenant : pilule translucide sur le dégradé bleu de la barre, discrète mais toujours visible. */
.core-back {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; margin-right: 4px; padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, .28); border-radius: 8px; background: rgba(255, 255, 255, .1);
  color: #fff; font-size: 12.5px; font-weight: 600; text-decoration: none; white-space: nowrap;
  transition: background .15s, border-color .15s;
}
.core-back:hover { background: rgba(255, 255, 255, .2); border-color: rgba(255, 255, 255, .45); }
.core-back:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 255, 255, .35); }
@media (max-width: 720px) {
  .core-back { width: 32px; padding: 0; justify-content: center; }
  .core-back-label { display: none; }
}
</style>
