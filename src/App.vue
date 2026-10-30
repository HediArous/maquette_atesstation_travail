<script setup>
import { ArrowUpRight, LoaderCircle } from '@lucide/vue';
import Alert from './components/ui/Alert.vue';
import { CORE_URL, coreSession } from './session/coreSession';
</script>

<template>
  <!--
    Sans session valide (adresse saisie directement, lien expiré, session expirée) : renvoi au Core Tenant, d'où l'Application
    RH se rouvre. Le message ne reste affiché qu'en cas de panne (Core ou backend injoignable).
  -->
  <main v-if="coreSession.error || !coreSession.context" class="session-gate">
    <p v-if="coreSession.redirecting" class="session-redirect" role="status">
      <LoaderCircle :size="16" class="spin" aria-hidden="true" /> Redirection vers le Core Tenant…
    </p>
    <Alert v-else tone="warning" title="Session Application RH">
      {{ coreSession.error }}
      <a :href="`${CORE_URL}/`" class="session-link">Ouvrir le Core Tenant <ArrowUpRight :size="13" aria-hidden="true" /></a>
    </Alert>
  </main>
  <RouterView v-else />
</template>

<style scoped>
.session-gate {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 16px;
  background: var(--bg);
}

.session-gate > * {
  max-width: 560px;
}

.session-redirect {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.session-redirect .spin {
  animation: session-spin 1s linear infinite;
}

@keyframes session-spin {
  to { transform: rotate(360deg); }
}

.session-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  font-weight: 600;
  color: var(--primary);
}
</style>
