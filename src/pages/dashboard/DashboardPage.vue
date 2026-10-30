<script setup>
import {isCompanyModuleEnabled} from '../../maquette/companyModules';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  AlertTriangle, ArrowRight, Banknote, CalendarClock, CalendarOff, CheckCircle2, FileSignature, LayoutGrid,
  ShieldCheck, UserPlus, Users,
} from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { dashboardApi } from '../../api/dashboard';
import PageHeader from '../../components/ui/PageHeader.vue';
import { formatDate, formatLong, TODAY } from '../../utils/dates';
import { formatAmount } from '../../utils/org';

/**
 * Tableau de bord : uniquement des données enregistrées (backend /api/dashboard), calculées en un appel. Chaque bloc
 * n'apparaît que si l'utilisateur a la permission correspondante. Actualisé à l'ouverture, toutes les 5 minutes et à chaque
 * notification en temps réel (nouveau contrat à échéance…).
 */
const store = useStore();
const data = useCompanyData();
const d = ref(null);
const status = ref('loading');
const error = ref('');
const refreshing = ref(false);
const loadedAt = ref(null);

async function load(quiet = false) {
  if (refreshing.value) return;
  refreshing.value = true;
  if (!quiet && !d.value) status.value = 'loading';
  try {
    d.value = await dashboardApi.get();
    loadedAt.value = new Date();
    status.value = 'ready';
    error.value = '';
  } catch (e) {
    error.value = e.message;
    if (!d.value) status.value = 'error';
    else if (!quiet) store.toast(`Tableau de bord non actualisé : ${e.message}`, 'danger');
  } finally {
    refreshing.value = false;
  }
}

let timer;
onMounted(() => {
  load();
  timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 5 * 60 * 1000);
});
onBeforeUnmount(() => clearInterval(timer));
watch(() => store.serverNotifications.length, () => load(true));

const greeting = computed(() => (store.currentUser.firstName ? `Bonjour ${store.currentUser.firstName}` : 'Bonjour'));
const updatedLabel = computed(() => (loadedAt.value
  ? `Mis à jour à ${loadedAt.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''));
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const money = (n) => formatAmount(n, store.activeDevise);

// ---------- Indicateurs clés ----------
const kpis = computed(() => {
  const w = d.value?.workforce;
  const c = isCompanyModuleEnabled(store.companyId,'contrats')?d.value?.contracts:null;
  const p = isCompanyModuleEnabled(store.companyId,'remuneration')?d.value?.payroll:null;
  const list = [];
  if (w) {
    list.push({ key: 'present', label: 'Effectif en poste', value: w.present, sub: w.trial ? `dont ${w.trial} en période d’essai` : w.exited ? `${plural(w.exited, 'sortie')} au total` : 'aucune sortie', to: 'employes', icon: Users, tone: 'blue' });
    list.push({ key: 'hires', label: 'Embauches · 30 jours', value: w.hiredLast30Days, sub: `${w.hiredThisYear} depuis le 1er janvier`, to: 'employes', icon: UserPlus, tone: 'teal' });
  }
  if (c) list.push({ key: 'ending', label: 'Contrats à échéance', value: c.endingSoon, sub: `sous ${plural(c.alertDays, 'jour')}`, to: 'contrats', icon: CalendarClock, tone: c.endingSoon ? 'amber' : 'blue' });
  if (p) list.push({ key: 'payroll', label: 'Masse salariale mensuelle', value: money(p.monthlyTotal), sub: p.employeesPaid ? `moyenne ${money(p.average)} · ${plural(p.employeesPaid, 'salarié')}` : 'aucun salaire en vigueur', to: 'salaires', icon: Banknote, tone: 'violet', });
  else if (w) list.push({ key: 'accounts', label: 'Comptes Core liés', value: `${pct(w.linkedAccounts, w.present)} %`, sub: `${w.linkedAccounts} sur ${w.present} employés en poste`, to: 'employes', icon: ShieldCheck, tone: 'violet' });
  return list;
});

// ---------- Embauches sur 12 mois (série unique : barres bleues, info-bulle au survol) ----------
const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const monthDate = (m) => new Date(`${m}-01T00:00:00`);
const hires = computed(() => d.value?.workforce?.hiresByMonth ?? []);
const hiresTotal = computed(() => hires.value.reduce((s, m) => s + m.count, 0));
const CHART = { w: 640, h: 112, top: 8, bottom: 20, left: 22, right: 4 };
const yMax = computed(() => {
  const max = Math.max(1, ...hires.value.map((m) => m.count));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  return Math.ceil(max / step) * step;
});
// Graduations réduites à la ligne de base et au maximum : la valeur exacte est dans l'info-bulle.
const yTicks = computed(() => [0, yMax.value]);
const plotH = CHART.h - CHART.top - CHART.bottom;
const slot = computed(() => (CHART.w - CHART.left - CHART.right) / Math.max(1, hires.value.length));
const yOf = (v) => CHART.top + plotH - (v / yMax.value) * plotH;
const bars = computed(() => hires.value.map((m, i) => {
  const width = Math.min(22, slot.value * 0.5);
  const x = CHART.left + i * slot.value + (slot.value - width) / 2;
  const h = (m.count / yMax.value) * plotH;
  return { ...m, x, width, y: CHART.top + plotH - h, h, cx: x + width / 2, label: MONTH.format(monthDate(m.month)).replace('.', ''), current: i === hires.value.length - 1 };
}));
// Barre aux coins supérieurs arrondis (4 px), ancrée sur la ligne de base.
function barPath(b) {
  if (b.h <= 0) return '';
  const r = Math.min(4, b.width / 2, b.h);
  const base = CHART.top + plotH;
  return `M${b.x},${base}V${b.y + r}Q${b.x},${b.y} ${b.x + r},${b.y}H${b.x + b.width - r}Q${b.x + b.width},${b.y} ${b.x + b.width},${b.y + r}V${base}Z`;
}
const hover = ref(null);

// ---------- Répartitions ----------
const statusRows = computed(() => {
  const w = d.value?.workforce;
  if (!w) return [];
  const max = Math.max(1, ...w.byStatus.map((s) => s.count));
  return w.byStatus.map((s) => ({ ...s, share: pct(s.count, w.total), bar: (s.count / max) * 100 }));
});
// Types de contrat : 4 teintes catégorielles validées (ordre fixe), le reste regroupé en « Autres » (gris neutre).
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const OTHER = '#b4bac3';
const contractTypes = computed(() => {
  const c = isCompanyModuleEnabled(store.companyId,'contrats')?d.value?.contracts:null;
  if (!c?.byType?.length) return [];
  const head = c.byType.slice(0, SERIES.length).map((t, i) => ({ ...t, color: SERIES[i] }));
  const rest = c.byType.slice(SERIES.length);
  if (rest.length) head.push({ label: 'Autres', count: rest.reduce((s, t) => s + t.count, 0), color: OTHER });
  return head.map((t) => ({ ...t, share: pct(t.count, c.inForce) }));
});

const dueTone = (days) => (days <= 7 ? 'danger' : days <= 15 ? 'warning' : 'neutral');
const dueLabel = (days) => (days < 0 ? 'Échue' : days === 0 ? 'Aujourd’hui' : days === 1 ? 'Demain' : `J-${days}`);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
const DAY = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const MON = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const ATTENTION_ICON = { withoutContract: FileSignature, withoutAccount: ShieldCheck, withoutRole: ShieldCheck, withoutCircuit: AlertTriangle };
</script>

<template>
  <PageHeader compact :title="greeting">
    <template #icon><LayoutGrid :size="16" :stroke-width="1.9" /></template>
    <template #subtitle>
      {{ data.company.name }} · {{ formatLong(TODAY) }}<span v-if="updatedLabel" class="db-updated"> · {{ updatedLabel }}</span>
    </template>
  </PageHeader>

  <!-- Chargement : squelettes aux dimensions finales (pas de saut de mise en page) -->
  <template v-if="status === 'loading'">
    <div class="db-kpis" aria-busy="true">
      <div v-for="i in 4" :key="i" class="db-kpi"><span class="db-sk db-sk-icon" /><span class="db-kpi-body"><span class="db-sk db-sk-sm" /><span class="db-sk db-sk-md" /></span></div>
    </div>
    <div class="db-grid"><div v-for="i in 4" :key="i" :class="['panel db-panel', i < 3 ? 'db-span-8' : 'db-span-4']"><span class="db-sk db-sk-block" /></div></div>
  </template>

  <div v-else-if="status === 'error'" class="panel db-error" role="alert">
    <AlertTriangle :size="18" aria-hidden="true" />
    <div><p class="db-error-title">Tableau de bord indisponible</p><p class="db-muted">{{ error }}</p></div>
    <button type="button" class="btn btn-sm btn-primary" @click="load()">Réessayer</button>
  </div>

  <template v-else>
    <!-- Indicateurs : une ligne par carte (icône, libellé, valeur, précision) -->
    <div v-if="kpis.length" class="db-kpis">
      <a v-for="k in kpis" :key="k.key" :href="`/${k.to}`" :class="['db-kpi', `tone-${k.tone}`]">
        <span class="db-kpi-icon" aria-hidden="true"><component :is="k.icon" :size="15" :stroke-width="1.9" /></span>
        <span class="db-kpi-body">
          <span class="db-kpi-label">{{ k.label }}</span>
          <span class="db-kpi-line"><strong class="db-kpi-value">{{ k.value }}</strong><span class="db-kpi-sub" :title="k.sub">{{ k.sub }}</span></span>
        </span>
      </a>
    </div>

    <div class="db-grid">
      <!-- Embauches -->
      <section v-if="d.workforce" class="panel db-panel db-span-8" aria-labelledby="db-hires">
        <header class="db-head">
          <div>
            <h2 id="db-hires" class="db-title">Embauches sur 12 mois</h2>
            <p class="db-sub">{{ plural(hiresTotal, 'embauche') }} · date d’embauche des dossiers enregistrés</p>
          </div>
        </header>
        <div class="db-chart" @mouseleave="hover = null">
          <svg :viewBox="`0 0 ${CHART.w} ${CHART.h}`" role="img" :aria-label="`Embauches par mois sur 12 mois : ${hires.map((m) => `${m.month} ${m.count}`).join(', ')}`">
            <g class="db-grid-lines">
              <g v-for="t in yTicks" :key="t">
                <line :x1="CHART.left" :x2="CHART.w - CHART.right" :y1="yOf(t)" :y2="yOf(t)" />
                <text :x="CHART.left - 8" :y="yOf(t) + 3.5" text-anchor="end">{{ t }}</text>
              </g>
            </g>
            <g v-for="b in bars" :key="b.month">
              <rect class="db-hit" :x="b.cx - slot / 2" :y="CHART.top" :width="slot" :height="plotH" @mouseenter="hover = b" @focus="hover = b" tabindex="0"
                :aria-label="`${MONTH_LONG.format(monthDate(b.month))} : ${b.count}`" />
              <path :d="barPath(b)" :class="['db-bar', { dim: hover && hover !== b }]" />
              <text :x="b.cx" :y="CHART.h - 8" text-anchor="middle" :class="['db-axis', { current: b.current }]">{{ b.label }}</text>
            </g>
          </svg>
          <div v-if="hover" class="db-tip" :style="{ left: `${(hover.cx / CHART.w) * 100}%`, top: `${(Math.min(hover.y, CHART.top + plotH - 4) / CHART.h) * 100}%` }">
            <strong>{{ plural(hover.count, 'embauche') }}</strong><span>{{ MONTH_LONG.format(monthDate(hover.month)) }}</span>
          </div>
        </div>
      </section>

      <!-- Statuts -->
      <section v-if="d.workforce" class="panel db-panel db-span-4" aria-labelledby="db-status">
        <header class="db-head">
          <div>
            <h2 id="db-status" class="db-title">Effectif par statut</h2>
            <p class="db-sub">{{ plural(d.workforce.total, 'dossier') }} · {{ d.workforce.women }} F / {{ d.workforce.men }} H en poste</p>
          </div>
        </header>
        <p v-if="!statusRows.length" class="db-empty">Aucun employé enregistré.</p>
        <ul v-else class="db-bars">
          <li v-for="s in statusRows" :key="s.label">
            <span class="db-bar-label">{{ s.label }}</span>
            <span class="db-bar-value">{{ s.count }}<small>{{ s.share }} %</small></span>
            <span class="db-bar-track" aria-hidden="true"><span class="db-bar-fill" :style="{ width: `${s.bar}%` }" /></span>
          </li>
        </ul>
        <dl class="db-facts">
          <div><dt>Affiliés CNSS</dt><dd>{{ pct(d.workforce.cnssAffiliated, d.workforce.present) }} %</dd></div>
          <div><dt>Comptes Core liés</dt><dd>{{ d.workforce.linkedAccounts }}/{{ d.workforce.present }}</dd></div>
          <div><dt>En préavis</dt><dd>{{ d.workforce.leaving }}</dd></div>
        </dl>
      </section>

      <!-- Contrats à échéance -->
      <section v-if="d.contracts&&isCompanyModuleEnabled(store.companyId,'contrats')" class="panel db-panel db-span-8" aria-labelledby="db-ending">
        <header class="db-head">
          <div>
            <h2 id="db-ending" class="db-title">Contrats arrivant à échéance</h2>
            <p class="db-sub">Contrat en cours de chaque employé, fin sous {{ plural(d.contracts.alertDays, 'jour') }} (Paramètres › Types de contrat)</p>
          </div>
          <a href="/contrats" class="db-link">Contrats <ArrowRight :size="13" aria-hidden="true" /></a>
        </header>
        <div v-if="!d.contracts.ending.length" class="db-ok">
          <CheckCircle2 :size="16" aria-hidden="true" /> Aucun contrat ne se termine sous {{ plural(d.contracts.alertDays, 'jour') }}.
        </div>
        <table v-else class="db-table">
          <thead><tr><th scope="col">Employé</th><th scope="col">Contrat</th><th scope="col">Fin</th><th scope="col" class="num">Échéance</th></tr></thead>
          <tbody>
            <tr v-for="e in d.contracts.ending" :key="`${e.employeeId}-${e.end}`">
              <td><a :href="`/employes/${e.employeeId}`" class="db-person"><span class="db-avatar" aria-hidden="true">{{ initials(e.employeeName) }}</span>{{ e.employeeName }}</a></td>
              <td><span class="db-tag">{{ e.contractType }}</span></td>
              <td class="db-muted nowrap">{{ formatDate(e.end) }}</td>
              <td class="num"><span :class="['db-chip', `tone-${dueTone(e.daysLeft)}`]">{{ dueLabel(e.daysLeft) }}</span></td>
            </tr>
          </tbody>
        </table>
        <p v-if="d.contracts.endingSoon > d.contracts.ending.length" class="db-more">
          + {{ d.contracts.endingSoon - d.contracts.ending.length }} autre(s) — voir la liste des contrats
        </p>
      </section>

      <!-- Types de contrat -->
      <section v-if="d.contracts&&isCompanyModuleEnabled(store.companyId,'contrats')" class="panel db-panel db-span-4" aria-labelledby="db-types">
        <header class="db-head">
          <div>
            <h2 id="db-types" class="db-title">Contrats en vigueur</h2>
            <p class="db-sub">{{ d.contracts.fixedTerm }} à durée déterminée · {{ d.contracts.openEnded }} sans date de fin</p>
          </div>
        </header>
        <p class="db-hero">{{ d.contracts.inForce }}<small>contrat{{ d.contracts.inForce > 1 ? 's' : '' }}</small></p>
        <p v-if="!contractTypes.length" class="db-empty">Aucun contrat en vigueur.</p>
        <template v-else>
          <div class="db-stack" role="img" :aria-label="contractTypes.map((t) => `${t.label} ${t.count}`).join(', ')">
            <span v-for="t in contractTypes" :key="t.label" :style="{ flexGrow: t.count, background: t.color }" :title="`${t.label} : ${t.count} (${t.share} %)`" />
          </div>
          <ul class="db-legend">
            <li v-for="t in contractTypes" :key="t.label">
              <span class="db-swatch" :style="{ background: t.color }" aria-hidden="true" />
              <span class="db-legend-label">{{ t.label }}</span>
              <span class="db-legend-value">{{ t.count }}<small>{{ t.share }} %</small></span>
            </li>
          </ul>
        </template>
        <p v-if="d.contracts.suspended" class="db-note"><AlertTriangle :size="13" aria-hidden="true" /> {{ plural(d.contracts.suspended, 'contrat') }} suspendu{{ d.contracts.suspended > 1 ? 's' : '' }}</p>
      </section>

      <!-- Arrivées récentes -->
      <section v-if="d.workforce" class="panel db-panel db-span-4" aria-labelledby="db-recent">
        <header class="db-head">
          <div><h2 id="db-recent" class="db-title">Arrivées récentes</h2><p class="db-sub">Dernières embauches enregistrées</p></div>
          <a href="/employes" class="db-link">Employés <ArrowRight :size="13" aria-hidden="true" /></a>
        </header>
        <p v-if="!d.workforce.recentHires.length" class="db-empty">Aucune embauche enregistrée.</p>
        <ul v-else class="db-people">
          <li v-for="p in d.workforce.recentHires" :key="p.id">
            <a :href="`/employes/${p.id}`" class="db-person">
              <span class="db-avatar" aria-hidden="true">{{ initials(p.name) }}</span>
              <span class="db-person-text"><strong>{{ p.name }}</strong><small>{{ p.jobTitle || p.status || '—' }}</small></span>
            </a>
            <span class="db-muted nowrap">{{ formatDate(p.hireDate) }}</span>
          </li>
        </ul>
      </section>

      <!-- Points d'attention -->
      <section class="panel db-panel db-span-4" aria-labelledby="db-attention">
        <header class="db-head"><div><h2 id="db-attention" class="db-title">Points d’attention</h2><p class="db-sub">À corriger pour un fonctionnement complet</p></div></header>
        <div v-if="!d.attention.length" class="db-ok"><CheckCircle2 :size="16" aria-hidden="true" /> Tout est en ordre.</div>
        <ul v-else class="db-alerts">
          <li v-for="a in d.attention" :key="a.key">
            <a :href="`/${a.link}`">
              <span class="db-alert-icon" aria-hidden="true"><component :is="ATTENTION_ICON[a.key] ?? AlertTriangle" :size="15" /></span>
              <span class="db-alert-label">{{ a.label }}</span>
              <span class="db-alert-count">{{ a.count }}</span>
            </a>
          </li>
        </ul>
      </section>

      <!-- Jours fériés -->
      <section class="panel db-panel db-span-4" aria-labelledby="db-holidays">
        <header class="db-head">
          <div><h2 id="db-holidays" class="db-title">Jours fériés à venir</h2><p class="db-sub">90 prochains jours</p></div>
          <a href="/parametres/jours-feries" class="db-link">Paramétrer <ArrowRight :size="13" aria-hidden="true" /></a>
        </header>
        <div v-if="!d.organisation.upcomingHolidays.length" class="db-ok db-ok-muted"><CalendarOff :size="16" aria-hidden="true" /> Aucun jour férié dans les 90 prochains jours.</div>
        <ul v-else class="db-holidays">
          <li v-for="h in d.organisation.upcomingHolidays" :key="`${h.name}-${h.start}`">
            <span class="db-date" aria-hidden="true"><strong>{{ DAY.format(new Date(`${h.start}T00:00:00`)) }}</strong><small>{{ MON.format(new Date(`${h.start}T00:00:00`)).replace('.', '') }}</small></span>
            <span class="db-holiday-text"><strong>{{ h.name }}</strong><small>{{ h.days > 1 ? `${h.days} jours` : '1 jour' }}{{ h.toConfirm ? ' · date à confirmer' : '' }}</small></span>
            <span class="db-muted nowrap">{{ daysUntil(h.start) <= 0 ? 'en cours' : `dans ${daysUntil(h.start)} j` }}</span>
          </li>
        </ul>
      </section>
    </div>

    <!-- Paramétrage de la société -->
    <div class="db-org">
      <a href="/parametres/departements"><strong>{{ d.organisation.departments }}</strong> département{{ d.organisation.departments > 1 ? 's' : '' }}</a>
      <a href="/parametres/fonctions"><strong>{{ d.organisation.jobPositions }}</strong> fonction{{ d.organisation.jobPositions > 1 ? 's' : '' }}</a>
      <a href="/parametres/circuits"><strong>{{ d.organisation.circuits }}</strong> circuit{{ d.organisation.circuits > 1 ? 's' : '' }} d’approbation actif{{ d.organisation.circuits > 1 ? 's' : '' }}</a>
      <a v-if="d.primes" href="/parametres/primes"><strong>{{ d.primes.catalogActive }}</strong> prime{{ d.primes.catalogActive > 1 ? 's' : '' }} au catalogue · {{ d.primes.employeesWithPrimes }} bénéficiaire{{ d.primes.employeesWithPrimes > 1 ? 's' : '' }}</a>
    </div>
  </template>
</template>

<style scoped>
/* Tableau de bord : grille 12 colonnes, cartes fines aux couleurs de l'application (texte en encre, couleur pour les marques). */
.db-updated { color: var(--muted); }
/* Indicateurs : cartes horizontales basses (≈ 56 px), valeur et précision sur la même ligne. */
.db-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.db-kpi { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 10px 12px; border: 1px solid #e8ecf2; border-radius: 10px; background: #fff; color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s; }
a.db-kpi:hover { border-color: #d3dceb; box-shadow: 0 8px 20px -16px rgba(15, 23, 42, .35); }
.db-kpi-icon { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; }
.db-kpi.tone-blue .db-kpi-icon { background: #eaf2fd; color: #0b5cc0; }
.db-kpi.tone-teal .db-kpi-icon { background: #e6f6f3; color: #0f8a77; }
.db-kpi.tone-amber .db-kpi-icon { background: #fdf4e3; color: #b7791f; }
.db-kpi.tone-violet .db-kpi-icon { background: #f1edfd; color: #6d4bd8; }
.db-kpi-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.db-kpi-label { font-size: 11px; font-weight: 600; letter-spacing: .02em; color: #6b7686; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-kpi-line { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.db-kpi-value { font-size: 17px; font-weight: 700; letter-spacing: -.01em; line-height: 1.15; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
.db-kpi-sub { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.db-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.db-span-8 { grid-column: span 8; }
.db-span-4 { grid-column: span 4; }
@media (max-width: 1180px) { .db-span-8 { grid-column: span 12; } .db-span-4 { grid-column: span 6; } }
@media (max-width: 760px) { .db-span-4 { grid-column: span 12; } }

.db-panel { display: flex; flex-direction: column; min-width: 0; padding: 11px 13px; margin: 0; border-radius: 10px; }
.db-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.db-title { margin: 0; font-size: 12.5px; font-weight: 650; color: var(--text); }
.db-sub { margin: 1px 0 0; font-size: 11px; color: var(--muted); }
.db-link { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }
.db-link:hover { text-decoration: underline; }
.db-muted { color: var(--muted); font-size: 12px; }
.nowrap { white-space: nowrap; }
.db-empty { margin: 8px 0; font-size: 12.5px; color: var(--muted); }
.db-ok { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 8px; background: #edf7f1; color: #1e6b45; font-size: 12.5px; font-weight: 500; }
.db-ok-muted { background: var(--surface-2); color: var(--muted); }

/* Graphique des embauches */
.db-chart { position: relative; }
.db-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.db-grid-lines line { stroke: #eef1f4; stroke-width: 1; }
.db-grid-lines text, .db-axis { font-size: 10px; fill: #8a94a3; font-variant-numeric: tabular-nums; }
.db-axis.current { fill: var(--text); font-weight: 600; }
.db-bar { fill: var(--primary); transition: opacity .12s; }
.db-bar.dim { opacity: .35; }
.db-hit { fill: transparent; cursor: default; outline: none; }
.db-tip { position: absolute; transform: translate(-50%, calc(-100% - 8px)); display: flex; flex-direction: column; gap: 1px; padding: 6px 9px; border-radius: 7px; background: #1f2328; color: #fff; font-size: 11.5px; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 14px rgba(15, 23, 42, .18); }
.db-tip strong { font-size: 12.5px; }
.db-tip span { color: #c8ced6; }

/* Barres horizontales (statuts) */
.db-bars { display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 0; list-style: none; }
.db-bars li { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: baseline; }
.db-bar-label { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-bar-value { font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--text); }
.db-bar-value small, .db-legend-value small { margin-left: 6px; font-weight: 500; color: var(--muted); }
.db-bar-track { grid-column: 1 / -1; height: 4px; border-radius: 3px; background: #eef1f4; overflow: hidden; }
.db-bar-fill { display: block; height: 100%; border-radius: 3px; background: var(--primary); }
.db-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: auto 0 0; padding-top: 10px; border-top: 1px solid var(--border); }
.db-bars + .db-facts { margin-top: 12px; }
.db-facts div { min-width: 0; }
.db-facts dt { font-size: 10.5px; color: var(--muted); }
.db-facts dd { margin: 1px 0 0; font-size: 12.5px; font-weight: 650; color: var(--text); font-variant-numeric: tabular-nums; }

/* Tableau des échéances */
.db-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.db-table th { padding: 0 8px 6px; text-align: left; font-size: 10.5px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: #8a96a8; border-bottom: 1px solid var(--border); }
.db-table td { padding: 6px 8px; border-bottom: 1px solid #f1f3f6; vertical-align: middle; }
.db-table tr:last-child td { border-bottom: 0; }
.db-table .num { text-align: right; }
.db-person { display: inline-flex; align-items: center; gap: 9px; color: var(--text); font-weight: 600; text-decoration: none; min-width: 0; }
.db-person:hover strong, a.db-person:hover { color: var(--primary); }
.db-avatar { display: grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--primary-soft); color: var(--primary); font-size: 11px; font-weight: 700; }
.db-tag { padding: 2px 8px; border-radius: 6px; background: var(--surface-2); color: #475569; font-size: 11.5px; font-weight: 600; }
.db-chip { display: inline-block; min-width: 56px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
.db-chip.tone-danger { background: #fdecea; color: #b42318; }
.db-chip.tone-warning { background: #fff4e0; color: #b45309; }
.db-chip.tone-neutral { background: #eef2f6; color: #475569; }
.db-more { margin: 10px 0 0; font-size: 12px; color: var(--muted); }

/* Contrats en vigueur : chiffre clé, barre empilée (2 px d'espace entre segments), légende avec valeurs */
.db-hero { margin: 0 0 8px; font-size: 20px; font-weight: 700; letter-spacing: -.02em; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1; }
.db-hero small { margin-left: 6px; font-size: 13px; font-weight: 500; letter-spacing: 0; color: var(--muted); }
.db-stack { display: flex; gap: 2px; height: 8px; border-radius: 4px; overflow: hidden; }
.db-stack span { min-width: 4px; }
.db-legend { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }
.db-legend li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.db-swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.db-legend-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.db-legend-value { font-weight: 650; font-variant-numeric: tabular-nums; color: var(--text); }
.db-note { display: flex; align-items: center; gap: 6px; margin: auto 0 0; padding-top: 12px; font-size: 12px; color: #b45309; }

/* Listes : arrivées, alertes, jours fériés */
.db-people, .db-alerts, .db-holidays { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.db-people li, .db-holidays li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f1f3f6; }
.db-people li:last-child, .db-holidays li:last-child { border-bottom: 0; }
.db-person-text { display: flex; flex-direction: column; min-width: 0; }
.db-person-text strong { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-person-text small, .db-holiday-text small { font-size: 11.5px; font-weight: 400; color: var(--muted); }
.db-alerts { gap: 6px; }
.db-alerts a { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; color: var(--text); text-decoration: none; transition: border-color .12s, background .12s; }
.db-alerts a:hover { border-color: #f3c98b; background: #fffaf2; }
.db-alert-icon { display: grid; place-items: center; flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px; background: #fff4e0; color: #b45309; }
.db-alert-label { flex: 1; font-size: 12.5px; line-height: 1.35; }
.db-alert-count { min-width: 24px; padding: 2px 7px; border-radius: 999px; background: #fff4e0; color: #b45309; font-size: 12px; font-weight: 700; text-align: center; }
.db-date { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 38px; border-radius: 8px; background: var(--primary-soft); color: var(--primary); line-height: 1.05; }
.db-date strong { font-size: 15px; font-weight: 700; }
.db-date small { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.db-holiday-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.db-holiday-text strong { font-size: 12.5px; font-weight: 600; }

/* Paramétrage : ligne discrète de liens */
.db-org { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.db-org a { padding: 4px 11px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); font-size: 12px; text-decoration: none; }
.db-org a strong { color: var(--text); font-variant-numeric: tabular-nums; }
.db-org a:hover { border-color: #bcd3f0; color: var(--primary); }

/* Erreur et squelettes */
.db-error { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 16px 18px; color: #b42318; }
.db-error > div { flex: 1; }
.db-error-title { margin: 0; font-weight: 650; color: var(--text); }
.db-sk { display: block; border-radius: 6px; background: linear-gradient(90deg, #f1f3f6 0%, #f8f9fb 50%, #f1f3f6 100%); background-size: 200% 100%; animation: db-shimmer 1.2s ease-in-out infinite; }
.db-sk-sm { width: 50%; height: 10px; }
.db-sk-md { width: 70%; height: 10px; margin-top: 8px; }
.db-sk-block { height: 120px; }
.db-sk-icon { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; }
@keyframes db-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .db-sk { animation: none; } }
</style>
