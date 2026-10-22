(function(){'use strict';
const C=[['urbano','Urbano (Ciudad)'],['autopista_sin','Autopista sin sierra'],['autopista_con','Autopista con sierra'],['pavimento_sin','Pavimento sin sierra'],['pavimento_con','Pavimento con sierra'],['terraceria_sin','Terracería sin sierra'],['terraceria_con','Terracería con sierra']];
let source=null,manual=null,routeKm=0,activeRouteKey=null;
const STORE='geocoast-georisk-correcciones-v1';
const $=id=>document.getElementById(id),toNum=x=>{let n=Number(String(x??'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:0};
function parseCSV(raw){const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)throw Error('CSV vacío');const sep=lines[0].includes(';')?';':',';const header=lines[0].split(sep).map(s=>s.trim().toLowerCase());const nameCol=header.findIndex(s=>/categor|esfuerzo|clase|tipo/.test(s));const kmCol=header.findIndex(s=>/^(km|kilomet|distancia)/.test(s));if(nameCol<0||kmCol<0)throw Error('CSV requiere columnas categoría y km');return lines.slice(1).map(x=>x.split(sep)).map(a=>({name:a[nameCol],km:toNum(a[kmCol])}));}
function identify(n){const exact=String(n||'').toLowerCase().trim();if(C.some(([id])=>id===exact))return exact;const s=String(n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ');if(s.includes('terraceria'))return 'terraceria_'+(s.includes('sin sierra')?'sin':'con');if(s.includes('autopista'))return 'autopista_'+(s.includes('sin sierra')?'sin':'con');if(s.includes('pavimento'))return 'pavimento_'+(s.includes('sin sierra')?'sin':'con');if(s.includes('urban'))return 'urbano';return C.find(([id])=>id===s)?.[0]||null}
function fromInput(data){const raw=Array.isArray(data)?data:(data?.rows||data?.categories||data?.esfuerzos||[]);if(!Array.isArray(raw)||!raw.length)throw Error('No encontré categorías en el archivo');const obj=Object.fromEntries(C.map(([id])=>[id,0]));let count=0;for(const r of raw){const id=identify(r.id||r.name||r.label||r.categoria||r.tipo);if(!id)continue;obj[id]+=toNum(r.km??r.kilometers??(r.meters!=null?r.meters/1000:r.distancia));count++}if(!count)throw Error('No se reconocieron las siete categorías');return obj}
function render(){
 const host=$('effortEditorRows');if(!host)return;const v=manual||source||{};
 const distance=Math.max(routeKm,0.01);
 host.innerHTML='<div class="gc-effort-editor-head"><span>Tipo de camino</span><span>GeoRisk · km</span><span>Corregido · km</span><span>% ruta</span></div>'+C.map(([id,name])=>{
  const detected=Math.max(0,Number(source?.[id]||0)),used=Math.max(0,Number(v[id]||0));
  const different=Math.abs(detected-used)>0.005;
  return `<label class="gc-effort-editor-line ${different?'gc-effort-changed':''}"><span>${name}${different?' <small>Corregido</small>':''}</span><output>${detected.toFixed(2)}</output><input aria-label="Kilómetros corregidos de ${name}" data-effortkm="${id}" type="number" min="0" step="0.01" value="${used.toFixed(2)}"><output>${(used/distance*100).toFixed(1)}%</output></label>`;
 }).join('');
 const banner=$('gcEffortMode');if(banner){banner.innerHTML=manual?'<strong>Corrección manual de esta ruta</strong> · costo recalculado con los kilómetros editados. El valor GeoRisk se conserva a la izquierda.':'<strong>GeoRisk como referencia principal.</strong> Usa las cifras automáticas; edita solo si encuentras un error.';}
 status();
}
function status(){const rows=effective(),total=rows.reduce((s,r)=>s+r.km,0),delta=total-routeKm;const bad=total>routeKm+.1;const missing=routeKm-total;const el=$('effortEditorStatus');if(!el)return;el.textContent=`Clases: ${total.toFixed(2)} km · distancia vial OSRM: ${routeKm.toFixed(2)} km · sin clasificar: ${Math.max(0,-delta).toFixed(2)} km.${bad?' ERROR: excede la ruta en '+delta.toFixed(2)+' km; revisa valores.':missing>.1?' Atención: hay tramos sin clasificación; el cotizador no puede añadirles desgaste sin evidencia.':' Cobertura completa.'}`;el.classList.toggle('error',bad)}
function effective(){let v=manual||source;return C.map(([id,name])=>({id,name,km:Math.max(0,v?.[id]||0)}))}
function notify(){status();window.dispatchEvent(new Event('effort:changed'))}
function context(){try{return window.geocostReportData?.()||{}}catch{return {}}}
function routeKey(){const c=context(),r=c.route;if(!r?.km)return null;
 const pt=x=>Array.isArray(x?.ll)?x.ll.map(v=>(+v).toFixed(4)).join(','):'?';
 return [pt(c.selectedSite),pt(c.selectedDest),r.index??0,Number(r.km).toFixed(1)].join('|');}
function stored(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}}
function writeSaved(){if(!activeRouteKey)return;try{const all=stored();
 if(manual)all[activeRouteKey]={rows:{...manual},updatedAt:new Date().toISOString()};else delete all[activeRouteKey];
 const keys=Object.keys(all).sort((a,b)=>String(all[b].updatedAt).localeCompare(String(all[a].updatedAt))).slice(0,120);
 localStorage.setItem(STORE,JSON.stringify(Object.fromEntries(keys.map(k=>[k,all[k]]))));
 }catch(err){console.warn('No se guardó corrección GeoRisk',err)}}
function automatic(result,km){
 const nextKey=routeKey();const same=activeRouteKey===nextKey;
 routeKm=Number(km)||0;
 source=Object.fromEntries(C.map(([id])=>[id,0]));
 for(const r of result?.rows||[]){if(Object.prototype.hasOwnProperty.call(source,r.id))source[r.id]=Math.max(0,(Number(r.meters)||0)/1000)}
 if(!same){activeRouteKey=nextKey;const saved=nextKey?stored()[nextKey]?.rows:null;
  manual=saved&&C.every(([id])=>Number.isFinite(Number(saved[id]))&&Number(saved[id])>=0)?{...saved}:null;
 }
 render();
}
function exportCorrection(){
 const c=context();if(!c.route){$('effortEditorStatus').textContent='Selecciona primero una ruta para exportar las correcciones.';return}
 const payload={format:'GeoCoast-GeoRisk-7-clases-v1',generatedAt:new Date().toISOString(),manual:!!manual,
  origin:{name:c.selectedSite?.name||'',lat:c.selectedSite?.ll?.[0],lon:c.selectedSite?.ll?.[1]},
  destination:{name:c.selectedDest?.nombre||'',lat:c.selectedDest?.ll?.[0],lon:c.selectedDest?.ll?.[1]},
  route:{kmIda:routeKm,routeIndex:c.route.index||0,returnKmEstimated:routeKm},
  rows:effective().map(x=>({id:x.id,name:x.name,km:Number(x.km.toFixed(3))})),
  automaticRows:C.map(([id,name])=>({id,name,km:Number((source?.[id]||0).toFixed(3))}))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='GeoRisk_correccion_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}

function init(){const file=$('georiskFile');if(!file)return;file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{const body=await f.text();manual=fromInput(f.name.toLowerCase().endsWith('.json')?JSON.parse(body):parseCSV(body));writeSaved();render();notify()}catch(e){$('effortEditorStatus').textContent='Error de importación: '+e.message}});$('effortRestore')?.addEventListener('click',()=>{manual=null;writeSaved();render();notify()});$('effortExport')?.addEventListener('click',exportCorrection);$('effortEditorRows')?.addEventListener('input',e=>{const key=e.target?.dataset?.effortkm;if(!key)return;if(!manual)manual={...source};const changed=toNum(e.target.value);
 manual[key]=changed;writeSaved();notify();});$('effortEditorRows')?.addEventListener('change',()=>render());}
function setManual(key,value){if(!C.some(([id])=>id===key)||!Number.isFinite(value)||value<0)return false;if(!manual)manual={...source};manual[key]=value;writeSaved();render();notify();return true;}
function restore(){manual=null;writeSaved();render();notify();}
window.GCEffortEditor={automatic,rows:effective,modified:()=>!!manual,setManual,restore,original:()=>C.map(([id,name])=>({id,name,km:Math.max(0,source?.[id]||0)})),totals:()=>effective().reduce((s,x)=>s+x.km,0),exportCorrection};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();