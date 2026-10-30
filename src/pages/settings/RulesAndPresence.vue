<script setup>
import GroupMinimumsCard from './GroupMinimumsCard.vue';
import PresencePolicyCard from './PresencePolicyCard.vue';
import RulesSection from './RulesSection.vue';
import SoloLinksCard from './SoloLinksCard.vue';

/** Onglet « Règles et quotas » : quotas puis règles de présence. */
</script>

<template>
  <div class="stack">
    <RulesSection />
    <h2 class="section-divider">Règles de présence</h2>
    <PresencePolicyCard />
    <SoloLinksCard />
    <GroupMinimumsCard />
  </div>
</template>
