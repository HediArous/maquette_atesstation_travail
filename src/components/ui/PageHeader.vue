<script setup>
/** En-tête de page : ligne de contexte, icône de section, titre, description, actions et barre d'outils. */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  /** Variante resserrée (paramètres) : icône et titre plus petits, une seule ligne de description. */
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <header :class="['page-header', { 'page-header-compact': compact }]">
    <slot name="before" />
    <div class="page-header-top">
      <div class="ph-main">
        <span v-if="$slots.icon" class="ph-icon" aria-hidden="true"><slot name="icon" /></span>
        <div class="ph-text">
          <p v-if="eyebrow" class="ph-eyebrow">{{ eyebrow }}</p>
          <h1>{{ title }}</h1>
          <p v-if="$slots.subtitle || subtitle" class="page-subtitle"><slot name="subtitle">{{ subtitle }}</slot></p>
        </div>
      </div>
      <div v-if="$slots.actions" class="page-actions"><slot name="actions" /></div>
    </div>
    <div v-if="$slots.toolbar" class="page-toolbar"><slot name="toolbar" /></div>
  </header>
</template>
