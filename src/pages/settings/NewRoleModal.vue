<script setup>
import { computed, ref, watch } from 'vue';
import { KeyRound, Plus, ShieldCheck } from '@lucide/vue';
import { knownPermissions } from '../../config/permissions';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Drawer from '../../components/ui/Drawer.vue';
import Field from '../../components/ui/Field.vue';
import FormCard from '../../components/FormCard.vue';
import PermissionMatrix from './PermissionMatrix.vue';
import PermissionSummary from './PermissionSummary.vue';

/** Nouveau rôle (RH-18) : nom unique dans la société, description, permissions choisies directement (ou copiées d'un rôle existant). */
const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'created']);

const store = useStore();
const data = useCompanyData();
const f = ref({ name: '', description: '', copyFrom: '' });
const perms = ref([]);
const submitted = ref(false);
const saving = ref(false);
const serverError = ref('');

watch(() => props.open, (open) => { if (open) { f.value = { name: '', description: '', copyFrom: '' }; perms.value = []; submitted.value = false; serverError.value = ''; } });

const nameError = computed(() => {
  const name = f.value.name.trim();
  if (!name) return 'Nom du rôle requis.';
  if (!/\p{L}/u.test(name)) return 'Le nom doit contenir au moins une lettre.';
  return data.roles.some((r) => r.name.trim().toLowerCase() === name.toLowerCase()) ? 'Un rôle porte déjà ce nom dans la société.' : '';
});

function onCopy(e) {
  f.value.copyFrom = e.target.value;
  perms.value = knownPermissions(data.role(e.target.value)?.permissions ?? []);
}

// Enregistré dans le backend (POST /api/roles) ; un refus (nom déjà utilisé…) s'affiche dans la fenêtre.
async function save() {
  submitted.value = true;
  if (nameError.value || saving.value) return;
  saving.value = true;
  serverError.value = '';
  try {
    const saved = await store.saveRole({ name: f.value.name, description: f.value.description, permissions: [...perms.value] });
    store.toast(`Rôle « ${saved.name} » créé`);
    emit('created', saved.id);
    emit('close');
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Drawer :open="open" wide title="Nouveau rôle" subtitle="Un rôle regroupe des permissions de l’application RH ; il s’attribue ensuite depuis la fiche de chaque employé." @close="emit('close')">
    <Alert v-if="serverError" tone="danger" title="Création refusée" class="mb-12">{{ serverError }}</Alert>
    <div class="fstack">
      <FormCard title="Identité du rôle" subtitle="Le nom est unique dans la société.">
        <template #icon><ShieldCheck :size="16" /></template>
        <div class="form-grid">
          <Field v-slot="{ id }" label="Nom du rôle" required :error="submitted ? nameError : ''"><input :id="id" v-model="f.name" placeholder="Ex. : Gestionnaire paie" maxlength="100" autocomplete="off" autofocus /></Field>
          <Field v-slot="{ id }" label="Partir des permissions de" hint="Facultatif : pré-coche les permissions d’un rôle existant.">
            <select :id="id" :value="f.copyFrom" @change="onCopy">
              <option value="">Partir de zéro</option>
              <option v-for="r in data.roles.filter((x) => !x.archived)" :key="r.id" :value="r.id">{{ r.name }} ({{ knownPermissions(r.permissions).length }})</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Description" class="span-2">
            <textarea :id="id" v-model="f.description" rows="2" maxlength="300" placeholder="À quoi sert ce rôle, à qui l’attribuer…" />
          </Field>
        </div>
      </FormCard>
      <FormCard title="Permissions" subtitle="Cochez individuellement, par groupe ou en totalité.">
        <template #icon><KeyRound :size="16" /></template>
        <template #actions><PermissionSummary v-model="perms" /></template>
        <PermissionMatrix v-model="perms" :with-summary="false" />
      </FormCard>
    </div>
    <template #footer>
      <span class="footer-note">{{ perms.length === 0 ? 'Aucune permission sélectionnée' : `${perms.length} permission${perms.length > 1 ? 's' : ''} sélectionnée${perms.length > 1 ? 's' : ''}` }}</span>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save"><Plus :size="15" aria-hidden="true" /> {{ saving ? 'Création…' : 'Créer le rôle' }}</button>
    </template>
  </Drawer>
</template>
