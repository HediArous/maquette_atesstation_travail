import {reactive} from 'vue';
import {initialModules,moduleEnabled,moduleForRoute} from './companyModulesModel';
export const companyModules=reactive({});
export function companyModuleState(companyId){if(!companyModules[companyId])companyModules[companyId]={values:initialModules(),history:[]};return companyModules[companyId];}
export const isCompanyModuleEnabled=(companyId,id)=>moduleEnabled(companyModuleState(companyId).values,id);
export const isCompanyRouteEnabled=(companyId,section,sub)=>isCompanyModuleEnabled(companyId,moduleForRoute(section,sub));

export const internalNumberOptions=reactive({});
export function numberOptions(companyId){if(!internalNumberOptions[companyId])internalNumberOptions[companyId]={required:false};return internalNumberOptions[companyId];}
export function isLeaveFeatureEnabled(companyId,type){if(!isCompanyModuleEnabled(companyId,'conges'))return false;const code=String(type?.code||'').toUpperCase();const name=String(type?.name||'').toLocaleLowerCase('fr');if(type?.id==='css'||code==='CSS'||name.includes('sans solde'))return isCompanyModuleEnabled(companyId,'sans-solde');if(type?.id==='aut'||code==='AUT'||name.includes('autorisation de sortie'))return isCompanyModuleEnabled(companyId,'autorisations');return true;}
