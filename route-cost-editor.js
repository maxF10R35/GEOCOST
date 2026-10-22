/* GeoCoast SC — ajustes manuales MXN aislados por origen, destino y alternativa.
 * La función de cotización IMT sigue siendo la única autoridad para calcular tarifas.
 * Persistencia local (no es base de datos ni sincronización entre operadores).
 */
(()=>{'use strict';
 const STORE='geocoast-costos-manuales-por-ruta-v1';
 const IDS=['fixed','diesel','maintenance','tires','lubricants','def','tolls','serviceMisc','riskCost'];
 const $=id=>document.getElementById(id);
 let currentKey=null,loading=false;
 const coordinate=obj=>Array.isArray(obj?.ll)?obj.ll.map(n=>Number(n).toFixed(4)).join(','):'?';
 function routeKey(){
  const c=window.geocostReportData?.()||{};
  if(!Number.isFinite(c.route?.km)||c.route.km<=0)return null;
  return [coordinate(c.selectedSite),coordinate(c.selectedDest),c.route.index??0,Number(c.route.km).toFixed(1)].join('|');
 }
 function stored(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
 function persist(){if(loading||!currentKey)return;const all=stored(),values={};
  for(const id of IDS){const el=$('gcManual_'+id);if(el&&el.value!=='')values[id]=el.value;}
  if(Object.keys(values).length)all[currentKey]={values,at:new Date().toISOString()};else delete all[currentKey];
  const keep=Object.entries(all).sort((a,b)=>String(b[1]?.at||'').localeCompare(String(a[1]?.at||''))).slice(0,120);
  try{localStorage.setItem(STORE,JSON.stringify(Object.fromEntries(keep)))}catch(e){console.warn('Costos manuales no guardados:',e)}
 }
 function switchRoute(){const next=routeKey();if(next===currentKey)return;
  currentKey=next;loading=true;const values=(next?stored()[next]?.values:null)||{};
  for(const id of IDS){const el=$('gcManual_'+id);if(el)el.value=values[id]??'';}
  loading=false;
  // No disparar cambios desde aquí: activateSelectedRoute ejecuta updateCalculations.
 }
 function init(){const box=$('gcManualCostFields');if(!box)return;
  box.addEventListener('input',persist);box.addEventListener('change',persist);
  $('gcManualReset')?.addEventListener('click',()=>queueMicrotask(persist));
  document.addEventListener('geocoast:route-selected',switchRoute);
  switchRoute();
 }
 window.GCCostOverrides={routeKey,read:stored,changeRoute:switchRoute};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
