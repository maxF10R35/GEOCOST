/* GeoCost SC V11 · Casetas por corredor, OSM + tarifario CAPUFE/FONADIN.
 * Detección no exhaustiva: no atribuir tarifa sin match nombre + categoría.
 * Costos por ruta aislados, autocompletado provisional, corrección manual opcional.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id),core=window.GCTollCore;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],active=null,req=0;const state=new WeakMap();
const cstate=r=>{if(!state.has(r))state.set(r,{manual:0,manualItems:[],gates:null,auto:null,status:'pending',error:''});return state.get(r)};
const totalManual=s=>s.manual+s.manualItems.reduce((a,b)=>a+b.price,0);
function grossAmount(s){return Math.max(0,(s.auto?.oneWayGross||0)+totalManual(s));}
function currency(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2})}
function updateCosts(r,display){const s=cstate(r);r.tollsOneWay=grossAmount(s);r.tollStatus=s.status;
 if(display){$('tolls').value=r.tollsOneWay.toFixed(2);render();}
 if(typeof window.updateCalculations==='function')window.updateCalculations();}
function render(){if(!active||!$('tollItems'))return;const s=cstate(active),a=s.auto;
 const verified=(a?.identified||[]).map(x=>`<div class="toll-item"><span><b>${esc(x.name)}</b> · ${esc(x.section)} · ${esc(x.vehicleClass)} · ${currency(x.oneWayGross)} con IVA (${currency(x.oneWayGross/1.16)} sin IVA) <small>· ubicación OSM, tarifa CAPUFE; validar sección</small></span></div>`).join('');
 const pending=(a?.unpriced||[]).map(x=>`<div class="toll-item gc-toll-pending"><span>${esc(x.name||'Plaza sin nombre')} · <b>Tarifa pendiente</b> · ${esc(x.reason)}</span></div>`).join('');
 const manual=s.manualItems.map((x,i)=>`<div class="toll-item"><span>${esc(x.name)} · ${esc(x.section)} · ${esc(x.cls)} · ${currency(x.price)}</span><button data-remove="${i}" type="button" aria-label="Eliminar tarifa manual">×</button></div>`).join('');
 $('tollItems').innerHTML=`<p class="gc-toll-status">${esc(s.status==='pending'?'Buscando plazas geográficas sobre el tramo seleccionado…':s.status==='partial'?'Resultado provisional: los peajes faltantes NO se estiman como cero.':'Sin consulta automática aún.')} ${esc(s.error)}</p>${verified}${pending}${manual}${s.manual?`<p class="hint">Ajuste manual extra: ${currency(s.manual)} por sentido.</p>`:''}<p class="hint"><b>Peajes automáticos (ida): ${currency(a?.oneWayGross||0)} con IVA</b> · <b>${currency((a?.oneWayGross||0)/1.16)} sin IVA</b>. Cobertura OSM/CAPUFE no exhaustiva: plazas sin tarifa quedan pendientes. El retorno se aproxima con el mismo monto y debe comprobarse.</p>`;
 $('tollItems').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{s.manualItems.splice(+b.dataset.remove,1);updateCosts(active,true)}));
}
function renderOptions(){const q=$('tollSearch')?.value?.trim().toLowerCase()||'';const matches=rows.filter(x=>!q||`${x.name} ${x.section}`.toLowerCase().includes(q)).slice(0,100);
 $('tollTariff').innerHTML=matches.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.section)}</option>`).join('')||'<option value="">Sin coincidencias</option>';
}
function setClass(){if(!$('tollClass'))return;const type=$('vehiculo')?.value||'Rabón';$('tollClass').value=core.vehicleClass(type)}
function reclassify(){if(!active)return;const s=cstate(active),cls=$('tollClass').value;if(s.gates){s.auto=core.matchTolls(s.gates,rows,cls,active.coords);s.status='partial';updateCosts(active,true)}else render();}
async function fetchOSM(points){
 const body=JSON.stringify({points});
 // Proxy if published to Netlify. Live Server returns HTML/404 for this path:
 // both should trigger a public OSM Overpass fallback, NOT an API-key prompt.
 try{
  const res=await fetch('/.netlify/functions/casetas-ruta',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(9000)});
  const type=res.headers?.get?.('content-type')||'';
  if(res.ok&&type.includes('application/json')){
   const data=await res.json();if(Array.isArray(data.gates))return data.gates;
  }
 }catch(e){console.info('Casetas: proxy no disponible; usando Overpass público.',e?.message||e)}
 const path=points.map(([lat,lon])=>`${lat},${lon}`).join(',');
 const query=`[out:json][timeout:18];(node["barrier"="toll_booth"](around:280,${path});node["highway"="toll_gantry"](around:280,${path}););out body 180;`;
 const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
 let error='sin conexión con OpenStreetMap';
 for(const ep of endpoints){try{
   const controller=AbortSignal.timeout(20000);
   const res=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(query),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:controller});
   if(!res.ok)throw Error('Overpass HTTP '+res.status);
   const j=await res.json();if(!Array.isArray(j.elements))throw Error('Respuesta OSM sin elementos');
   return j.elements.filter(x=>x.type==='node'&&Number.isFinite(x.lat)&&Number.isFinite(x.lon))
     .map(x=>({id:`osm:${x.id}`,name:x.tags?.name||x.tags?.['name:es']||'',ref:x.tags?.ref||'',lat:x.lat,lon:x.lon}));
  }catch(e){error=e.message||String(e)}
 }
 throw Error('Servicio cartográfico temporalmente no disponible: '+error);
}
async function analyze(route){if(!route?.coords?.length)return;active=route;const s=cstate(route),request=++req;
 if(!s.gates){s.status='pending';s.error='';render();updateCosts(route,true);
  try{const coords=core.takeAlongRoute(route.coords,95);const gates=await fetchOSM(coords);
    s.gates=gates;
  }catch(e){s.status='unavailable';s.error='Consulta geográfica no disponible: '+String(e.message||e)+'. Sin valores inventados; revisa manualmente cuando sea necesario.';
    if(active===route&&request===req)updateCosts(route,true);return;}
 }
 s.auto=core.matchTolls(s.gates,rows,$('tollClass')?.value||core.vehicleClass($('vehiculo')?.value||'Rabón'),route.coords);s.status='partial';
 if(active===route&&request===req)updateCosts(route,true);
}
function whenSelected(){const ctx=window.geocostReportData?.(),r=ctx?.route;if(!r)return;const s=cstate(r);active=r;setClass();updateCosts(r,true);void analyze(r)}
window.GCRegional={getSelected:()=>active?cstate(active).manualItems.slice():[],getManualBase:()=>active?cstate(active).manual:0,getInfo:()=>{if(!active)return null;const s=cstate(active);return {status:s.status,auto:s.auto,manual:s.manual,manualItems:s.manualItems.slice(),oneWayGross:active.tollsOneWay||0,error:s.error}},analyze,refresh:whenSelected};
window.addEventListener('DOMContentLoaded',()=>{
 if(!$('tolls'))return;
 $('tolls').addEventListener('change',()=>{if(!active)return;const s=cstate(active),typed=Math.max(0,Number($('tolls').value)||0);s.manual=Math.max(0,typed-(s.auto?.oneWayGross||0)-s.manualItems.reduce((a,b)=>a+b.price,0));updateCosts(active,true)});
 $('tollSearch')?.addEventListener('input',renderOptions);
 $('tollClass')?.addEventListener('change',reclassify);
 $('vehiculo')?.addEventListener('change',()=>{setClass();reclassify()});
 $('tollAdd')?.addEventListener('click',()=>{if(!active)return;const r=rows.find(x=>x.id===$('tollTariff').value),cls=$('tollClass').value,price=Number(r?.rates?.[cls]);if(!r||!(price>0))return alert('No existe tarifa aplicable para esa caseta y categoría.');const s=cstate(active);s.manualItems.push({id:r.id,name:r.name,section:r.section,cls,price});updateCosts(active,true)});
 $('tollClear')?.addEventListener('click',()=>{if(!active)return;const s=cstate(active);s.manualItems=[];s.manual=0;updateCosts(active,true)});
 fetch('data/capufe-tarifas.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Catálogo no disponible');return r.json()}).then(j=>{rows=j.records||[];renderOptions();if(active&&cstate(active).gates)reclassify();$('tollSearch').placeholder=`Buscar en ${rows.length} tarifas oficiales (respaldo)`}).catch(e=>{if($('tollTariff'))$('tollTariff').innerHTML='<option>Tarifario no disponible</option>';if(active){cstate(active).error=e.message;render();}});
 setClass();
 document.addEventListener('geocoast:route-selected',whenSelected);
});
})();
