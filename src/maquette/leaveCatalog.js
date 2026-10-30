import { reactive } from 'vue';
import { createLeaveCatalog } from './leaveCatalogModel.js';
// Comme le reste de cette maquette, tout est réinitialisé au rechargement.
export const leaveCatalog = reactive(createLeaveCatalog());
