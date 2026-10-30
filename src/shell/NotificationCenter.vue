<script setup>
import { computed, ref, watch } from 'vue';
import { Bell, BellOff, CalendarClock, CheckCheck, Info, Trash2, X } from '@lucide/vue';
import { useClickOutside } from '../composables/useClickOutside';
import { useStore } from '../store';
import { navigate } from '../router/navigate';
import { diffDays, TODAY } from '../utils/dates';

/**
 * Centre de notifications de la barre supérieure : notifications du backend, tenues à jour en temps réel (échéances de
 * contrat…), et notifications locales de démonstration. Chaque notification se lit au clic (ouvre l'écran lié) et se
 * supprime de la liste de l'utilisateur.
 */
const store = useStore();
const open = ref(false);
const filter = ref('all');
const close = () => { open.value = false; };
const root = useClickOutside(computed(() => open.value), close);

const TYPES = {
  CONTRACT_EXPIRING: { icon: CalendarClock, tone: 'warning' },
};

const items = computed(() => {
  const server = store.serverNotifications.map((n) => ({ ...n, at: n.createdAt }));
  const local = store.db.notifications.filter((n) => n.companyId === store.companyId)
    .map((n) => ({ id: n.id, local: true, title: n.title, message: n.body, link: n.link, at: n.at, read: n.read }));
  return [...server, ...local].sort((a, b) => String(b.at).localeCompare(String(a.at)));
});
const unread = computed(() => items.value.filter((n) => !n.read).length);
const shown = computed(() => (filter.value === 'unread' ? items.value.filter((n) => !n.read) : items.value));

// Pastille animée quand une notification arrive.
const pulse = ref(false);
watch(unread, (now, before) => {
  if (now > before) { pulse.value = false; requestAnimationFrame(() => { pulse.value = true; }); }
});

const visual = (n) => TYPES[n.type] ?? { icon: Info, tone: 'info' };

/** « Échéance aujourd'hui », « dans 3 j », « dépassée ». */
function dueLabel(n) {
  if (!n.dueDate) return null;
  const days = diffDays(TODAY, n.dueDate);
  if (days < 0) return { text: 'Échéance dépassée', tone: 'danger' };
  if (days === 0) return { text: 'Échéance aujourd’hui', tone: 'danger' };
  if (days === 1) return { text: 'Échéance demain', tone: 'warning' };
  return { text: `Échéance dans ${days} j`, tone: days <= 7 ? 'warning' : 'neutral' };
}

const RELATIVE = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
/** « à l'instant », « il y a 5 min », « hier », « 12 oct. ». */
function ago(at) {
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return RELATIVE.format(-days, 'day');
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(time));
}

function openItem(n) {
  store.markNotificationRead(n);
  if (n.link) { close(); navigate(n.link); }
}

function toggle() {
  open.value = !open.value;
  if (open.value) store.loadNotifications();
}
</script>

<template>
  <div ref="root" class="dropdown-wrap">
    <button type="button" class="icon-btn" aria-haspopup="dialog" :aria-expanded="open"
      :aria-label="`Notifications${unread ? ` (${unread} non lues)` : ''}`" @click="toggle">
      <Bell :size="19" :stroke-width="1.75" />
      <span v-if="unread > 0" :class="['notif-dot', { 'nc-pulse': pulse }]" @animationend="pulse = false">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <div v-if="open" class="dropdown dropdown-right nc-panel" role="dialog" aria-label="Notifications">
      <header class="nc-head">
        <div class="nc-heading">
          <p class="nc-title">Notifications</p>
          <span v-if="unread" class="nc-count">{{ unread }} non lue{{ unread > 1 ? 's' : '' }}</span>
        </div>
        <div class="nc-actions">
          <button type="button" class="nc-icon-btn" :disabled="!unread" title="Tout marquer comme lu" aria-label="Tout marquer comme lu" @click="store.markNotificationsRead()">
            <CheckCheck :size="15" />
          </button>
          <button type="button" class="nc-icon-btn" :disabled="!items.length" title="Tout supprimer" aria-label="Tout supprimer" @click="store.dismissAllNotifications()">
            <Trash2 :size="14" />
          </button>
        </div>
      </header>

      <div class="nc-tabs" role="tablist" aria-label="Filtrer les notifications">
        <button type="button" role="tab" :aria-selected="filter === 'all'" :class="['nc-tab', { active: filter === 'all' }]" @click="filter = 'all'">Toutes</button>
        <button type="button" role="tab" :aria-selected="filter === 'unread'" :class="['nc-tab', { active: filter === 'unread' }]" @click="filter = 'unread'">
          Non lues<span v-if="unread" class="nc-tab-count">{{ unread }}</span>
        </button>
      </div>

      <div v-if="!shown.length" class="nc-empty">
        <span class="nc-empty-icon" aria-hidden="true"><BellOff :size="18" /></span>
        <p class="nc-empty-title">{{ filter === 'unread' ? 'Tout est lu' : 'Aucune notification' }}</p>
        <p class="nc-empty-text">Les échéances de contrat et les alertes de la société apparaîtront ici en temps réel.</p>
      </div>
      <ul v-else class="nc-list">
        <li v-for="n in shown" :key="n.id" :class="['nc-item', { unread: !n.read }]">
          <button type="button" class="nc-main" @click="openItem(n)">
            <span :class="['nc-icon', `tone-${visual(n).tone}`]" aria-hidden="true"><component :is="visual(n).icon" :size="15" :stroke-width="1.9" /></span>
            <span class="nc-body">
              <span class="nc-line">
                <span class="nc-item-title">{{ n.title }}</span>
                <span class="nc-time">{{ ago(n.at) }}</span>
              </span>
              <span class="nc-message">{{ n.message }}</span>
              <span v-if="dueLabel(n)" :class="['nc-chip', `tone-${dueLabel(n).tone}`]">{{ dueLabel(n).text }}</span>
            </span>
          </button>
          <span v-if="!n.read" class="nc-unread" aria-label="Non lue" />
          <button type="button" class="nc-remove" :aria-label="`Supprimer « ${n.title} »`" title="Supprimer" @click.stop="store.dismissNotification(n)">
            <X :size="13" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Centre de notifications : panneau fin, aux couleurs de l'application (primaire bleu, tons doux). */
.nc-panel { width: 372px; max-width: calc(100vw - 24px); padding: 0; overflow: hidden; border-radius: 12px; display: flex; flex-direction: column; max-height: min(560px, 78vh); }
.nc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 8px 16px; }
.nc-heading { display: flex; align-items: baseline; gap: 8px; }
.nc-title { margin: 0; font-size: 14px; font-weight: 650; color: var(--text); }
.nc-count { font-size: 11.5px; font-weight: 600; color: var(--primary); }
.nc-actions { display: flex; gap: 2px; }
.nc-icon-btn { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer; }
.nc-icon-btn:hover:not(:disabled) { background: var(--primary-soft); color: var(--primary); }
.nc-icon-btn:disabled { opacity: .4; cursor: default; }

.nc-tabs { display: flex; gap: 4px; padding: 0 12px 8px; border-bottom: 1px solid var(--border); }
.nc-tab { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; }
.nc-tab:hover { color: var(--text); }
.nc-tab.active { background: var(--primary-soft); color: var(--primary); }
.nc-tab-count { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 10px; line-height: 16px; text-align: center; }

.nc-list { flex: 1; margin: 0; padding: 4px; list-style: none; overflow-y: auto; }
.nc-item { position: relative; border-radius: 9px; transition: background .12s; }
.nc-item:hover { background: #f6f8fb; }
.nc-item.unread { background: rgba(11, 92, 192, .045); }
.nc-item.unread:hover { background: rgba(11, 92, 192, .08); }
.nc-main { display: flex; gap: 11px; width: 100%; padding: 10px 34px 10px 10px; border: 0; background: transparent; text-align: left; cursor: pointer; color: inherit; }
.nc-icon { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; }
.nc-icon.tone-warning { background: #fff4e0; color: #b45309; }
.nc-icon.tone-info { background: var(--primary-soft); color: var(--primary); }
.nc-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.nc-line { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.nc-item-title { font-size: 12.5px; font-weight: 650; color: var(--text); }
.nc-item:not(.unread) .nc-item-title { font-weight: 600; color: #334155; }
.nc-time { flex-shrink: 0; font-size: 11px; color: #94a3b8; }
.nc-message { font-size: 12px; line-height: 1.45; color: #5b6778; }
.nc-chip { align-self: flex-start; margin-top: 2px; padding: 1px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 650; line-height: 17px; }
.nc-chip.tone-danger { background: #fdecea; color: #b42318; }
.nc-chip.tone-warning { background: #fff4e0; color: #b45309; }
.nc-chip.tone-neutral { background: #eef2f6; color: #475569; }
.nc-unread { position: absolute; top: 15px; right: 13px; width: 7px; height: 7px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 3px rgba(11, 92, 192, .14); }
.nc-remove { position: absolute; top: 8px; right: 6px; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 6px; background: #fff; color: #94a3b8; cursor: pointer; opacity: 0; box-shadow: 0 1px 2px rgba(15, 23, 42, .08); transition: opacity .12s; }
.nc-item:hover .nc-remove, .nc-remove:focus-visible { opacity: 1; }
.nc-item:hover .nc-unread { opacity: 0; }
.nc-remove:hover { color: #b42318; background: #fdecea; }

.nc-empty { display: flex; flex-direction: column; align-items: center; padding: 30px 24px 34px; text-align: center; }
.nc-empty-icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 10px; border-radius: 12px; background: #f1f4f8; color: #94a3b8; }
.nc-empty-title { margin: 0; font-size: 13px; font-weight: 650; color: var(--text); }
.nc-empty-text { margin: 4px 0 0; max-width: 250px; font-size: 12px; line-height: 1.45; color: var(--muted); }

.nc-pulse { animation: nc-pulse .6s ease-out; }
@keyframes nc-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }
@media (hover: none) { .nc-remove { opacity: 1; } .nc-item .nc-unread { display: none; } }
</style>
