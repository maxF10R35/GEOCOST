/* GeoCoast SC - precio medio del diesel a lo largo de la ruta. Instantánea GasMapa/CRE + actualización Netlify opcional. */
(()=>{
 const $=id=>document.getElementById(id),core=window.GCStateFuelCore;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let current=null,source=null,groups=null,stateIndex=null,dist=null,latestPrice=null,requestId=0,manual=new Map(),usedStatus='',method='manual';
 const aliases={'mexico':'Estado de México','ciudaddemexico':'Ciudad de México','michoacan':'Michoacán','coahuila':'Coahuila','veracruz':'Veracruz','guanajuato':'Guanajuato'};
 let names=new Map();
 // Una copia por estado, sin repetir descargas y parseo al cotizar bodegas cercanas.
 const polygonCache=new Map();
 async function loadPolygons(file){
  if(!polygonCache.has(file))polygonCache.set(file,fetch('data/zt/'+file,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Falta polígono '+file);return r.json()}).catch(e=>{polygonCache.delete(file);throw e}));
  return polygonCache.get(file);
 }
 async function groupsFor(coords){
  const meta=await stateGeometry();
  // reduce() evita formar cientos de miles de argumentos con ...coords en rutas largas.
  const b=coords.reduce((v,c)=>[Math.min(v[0],c[1]),Math.min(v[1],c[0]),Math.max(v[2],c[1]),Math.max(v[3],c[0])],[Infinity,Infinity,-Infinity,-Infinity]);
  const hits=meta.filter(e=>!(e.bbox[2]<b[0]||e.bbox[0]>b[2]||e.bbox[3]<b[1]||e.bbox[1]>b[3]));
  return Promise.all(hits.map(async m=>({state:m.estado,bbox:m.bbox,polygons:await loadPolygons(m.file)})));
 }
 const manualBase=()=>{let p=Number($('diesel')?.value);return Number.isFinite(p)&&p>=10&&p<=60?p:null};
 const getFallback=()=>{const p=Number(source?.nationalPrice);return $('fuelNationalAuto')?.checked&&Number.isFinite(p)&&p>=10&&p<=60?p:manualBase()};
 const priceLookup=()=>{const rates={};for(const r of source?.states||[])rates[core.key(r.state)]=r.diesel;for(const [k,v] of manual)rates[k]=v;return rates;};
 const announce=()=>{const info=getInfo();if($('fuelRouteStatus'))$('fuelRouteStatus').textContent=usedStatus||'Calcula una ruta para detectar entidades.';const summ=$('cneXmlSummary');if(summ){summ.innerHTML=`Fuente: <a href="https://www.gasmapa.com/estados" target="_blank" rel="noopener">GasMapa / precios reportados (CRE-CNE)</a> · corte ${esc(source?.observationDate||'desconocido')} · nacional ${source?.nationalPrice?.toFixed(2)||'—'} MXN/L${source?.online?' · actualización en línea':' · instantánea local'}`;}
 const container=$('fuelRouteBreakdown');if(container){const d=dist,rows=d?Object.entries(d.byState).sort((a,b)=>b[1]-a[1]):[];const prices=priceLookup();container.innerHTML=rows.map(([key,km])=>`<div class="fuel-state-row"><span>${esc(names.get(key)||aliases[key]||key)} · ${km.toFixed(1)} km</span><strong>${prices[key]?('$'+(prices[key]/($('gcDieselPrecioIncluyeIVA')?.checked!==false?1.16:1)).toFixed(2)+'/L aplicado'):'Sin precio'}</strong></div>`).join('')+(d?.unknownKm>0.01?`<div class="fuel-state-row"><span>Sin coincidencia SAP · ${d.unknownKm.toFixed(1)} km</span><strong>Sin estado (excluido)</strong></div>`:'')+`<p class="hint">Diésel promedio estatal: <b>$${Number.isFinite(info.price)?(info.price/($('gcDieselPrecioIncluyeIVA')?.checked!==false?1.16:1)).toFixed(2):'pendiente'}/L sin IVA</b> · cobertura estatal ${Math.round(info.coverage*100)}%. ${dist?'Kilómetros asignados por polígonos SAP; los tramos sin cobertura no se incluyen en el promedio estatal.':'Pendiente de ruta.'}</p>`;}
 const principal=$('fuelCurrentPrice');if(principal)principal.textContent=Number.isFinite(info.price)?'$'+info.price.toFixed(2)+'/L (con IVA) · neto $'+(info.price/1.16).toFixed(2)+'/L':'Pendiente de promedio estatal';document.dispatchEvent(new CustomEvent('geocoast:fuel-updated',{detail:info}));
 };
 function getInfo(){return {price:latestPrice??(!$('fuelAuto')?.checked?getFallback():null),states:dist?.byState||{},centers:dist?.centers||{},routeKm:dist?.routeKm||0,unmatchedKm:dist?.unknownKm||0,coverage:current?.coverage||0,source:'GasMapa (CRE/CNE)',sourceUrl:'https://www.gasmapa.com/estados',date:source?.observationDate||'',status:usedStatus,method,national:source?.nationalPrice||null,rows:(source?.states||[]).map(r=>({...r,diesel:manual.get(core.key(r.state))??r.diesel})),edited:manual.size>0};}
 function reprice(){const prev=latestPrice;latestPrice=null;if(!$('fuelAuto')?.checked||!dist||!source){method=!$('fuelAuto')?.checked?'manual':'pendiente';usedStatus=!$('fuelAuto')?.checked?'Cálculo manual activado; el valor estatal no se aplica.':'Ruta o precios estatales pendientes: no se aplica precio fijo al flete.';announce();if(typeof updateCalculations==='function')updateCalculations();return}
 const weighted=core.weighted(dist,priceLookup());if(!(weighted.coverage>0)&&!Number.isFinite(weighted.price)){usedStatus='Sin estados reconocidos; no se usará $26.99 nacional como precio de la ruta.';announce();return;}latestPrice=weighted.price;current=weighted;method=weighted.source;
 usedStatus=`Diésel ponderado ${latestPrice.toFixed(2)} MXN/L · ${Math.round(weighted.coverage*100)}% de la ruta con precio estatal y polígono SAP · ${source.observationDate}. ${weighted.unpricedKm>.01?'Tramos faltantes excluidos del promedio; revisar cobertura.':''}`;announce();if(typeof updateCalculations==='function')updateCalculations();}
 async function stateGeometry(){if(stateIndex)return stateIndex;const res=await fetch('data/zt/index.json',{cache:'force-cache'});if(!res.ok)throw Error('Sin índice de polígonos ZT');stateIndex=await res.json();return stateIndex;}
 async function analyze(routeObject){const my=++requestId;const coords=routeObject?.coords||[];if(coords.length<2){dist=null;latestPrice=null;usedStatus='Sin ruta vial calculada';announce();return;}
 latestPrice=null;dist=null;current=null;usedStatus='Identificando estados de la ruta con polígonos SAP…';announce();try{const imported=await groupsFor(coords);if(my!==requestId)return;
 groups=imported;names=new Map((source?.states||[]).map(r=>[core.key(r.state),r.state]));dist=core.distribute(coords,imported,routeObject.km);usedStatus='Estados segmentados';reprice();}catch(e){if(my!==requestId)return;dist=null;latestPrice=null;groups=null;current=null;usedStatus='No se pudieron asignar estados: '+e.message+'. Sin tarifa automática hasta validar el dato.';announce();if(typeof updateCalculations==='function')updateCalculations()}}
 async function getForRoute(routeObject){
  if(!routeObject?.coords?.length||!source)throw Error('Precio estatal aún no cargado');
  if(!$('fuelAuto')?.checked){const price=manualBase();if(!price)throw Error('Captura precio manual de diésel válido');return {price,coverage:0,status:'Precio manual explícito',method:'manual',states:{}};}
  const coords=routeObject.coords,imported=await groupsFor(coords);
  const distribution=core.distribute(coords,imported,routeObject.km);
  const calc=core.weighted(distribution,priceLookup());
  if(calc.coverage<=0)throw Error('Ningún estado de la ruta identificado: verificar cartografía estatal');
  return {...calc,states:distribution.byState,status:`${Math.round(calc.coverage*100)}% cubierto por estados`,date:source.observationDate,method:calc.source};
 }
 function renderEditor(){const list=$('stateFuelPrices');if(!list||!source)return;list.innerHTML=`<details><summary>Editar precios por estado (32 entidades)</summary><div class="fuel-prices-grid">${source.states.slice().sort((a,b)=>a.state.localeCompare(b.state,'es')).map(s=>{const key=core.key(s.state);const x=manual.get(key)??s.diesel;return `<label>${esc(s.state)} <input type="number" min="10" max="60" step="0.01" data-fuel-state="${esc(key)}" value="${x.toFixed(2)}"></label>`}).join('')}</div></details>`;
 list.querySelectorAll('[data-fuel-state]').forEach(el=>el.addEventListener('input',()=>{let p=Number(el.value);if(Number.isFinite(p)&&p>=10&&p<=60)manual.set(el.dataset.fuelState,p);else manual.delete(el.dataset.fuelState);reprice()}))}
 function acceptData(j,online){if(online&&source?.observationDate&&j?.observationDate<source.observationDate)throw Error('La consulta es más antigua que el último corte disponible');if(!j?.states||j.states.length!==32||!/^\d{4}-\d{2}-\d{2}$/.test(j.observationDate))throw Error('Tabla de estados incompleta o sin fecha');let st=[];const seen=new Set();for(const row of j.states){const k=core.key(row.state),p=Number(row.diesel);if(seen.has(k)||!Number.isFinite(p)||p<10||p>60)throw Error('Precios estatales duplicados o inválidos');seen.add(k);st.push({state:row.state,diesel:p})}source={...j,online:!!online,states:st};names=new Map(st.map(s=>[core.key(s.state),s.state]));renderEditor();reprice();}
 async function loadSnapshot(){const res=await fetch('data/diesel-estados.json',{cache:'no-cache'});if(!res.ok)throw Error('Falta data/diesel-estados.json');acceptData(await res.json(),false)}
 async function updateOnline(){let status=$('fuelOnlineStatus');if(status)status.textContent='Consultando fuente de promedios…';try{const response=await fetch('/.netlify/functions/diesel-estados',{cache:'no-store',signal:AbortSignal.timeout(14500)});if(!response.ok)throw Error('Actualización no disponible (HTTP '+response.status+')');const j=await response.json();acceptData(j,true);if(status)status.textContent='Actualizado desde GasMapa: '+source.observationDate;}
 catch(err){if(status)status.textContent='No se pudo actualizar automáticamente: '+err.message+'. Se conserva la última tabla local verificada.'}}
 async function importCsv(file){const txt=await file.text(),lines=txt.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);const sep=lines[0].includes(';')?';':',';const fields=lines[0].split(sep).map(core.norm),a=fields.indexOf('estado'),b=fields.findIndex(x=>x==='preciodiesel'||x==='diesel'||x==='precio');if(a<0||b<0)throw Error('Requiere columnas estado,precio_diesel');const map=new Map(source.states.map(s=>[core.key(s.state),s]));let ct=0;for(const line of lines.slice(1)){const cols=line.split(sep),k=core.key(cols[a]),price=Number(String(cols[b]).replace('$','').trim().replace(',','.'));if(map.has(k)&&price>=10&&price<=60){manual.set(k,price);ct++}}
 if(!ct)throw Error('Ninguna fila válida para las entidades nacionales');renderEditor();reprice();return ct}
 const reportHtml=()=>{const s=getInfo();const entries=Object.entries(dist?.byState||{});const lookup=priceLookup();return `<h3>Precio de diésel por estado</h3><p>Fuente ${esc(s.source)} · observación ${esc(s.date)} · precio aplicado ${Number.isFinite(s.price)?'$'+s.price.toFixed(2)+'/L':'pendiente'} · cobertura cartográfica y de precios ${Math.round(s.coverage*100)}%. Estados asociados mediante polígonos ZT SAP. Km sin estado reconocido no se incorporan al promedio (ver cobertura). Precio indicativo, no de bomba.</p><table><thead><tr><th>Estado</th><th>Km de ruta</th><th>Precio $/L</th></tr></thead><tbody>${entries.map(([k,km])=>`<tr><td>${esc(names.get(k)||k)}</td><td>${km.toFixed(1)}</td><td>${lookup[k]?.toFixed(2)||'Sin dato'}</td></tr>`).join('')}</tbody></table>`};
 window.GCFuel={getPrice:()=>latestPrice??(!$('fuelAuto')?.checked?manualBase():null),getInfo,getForRoute,refreshRoute:analyze,refresh:updateOnline,reportHtml};
 document.addEventListener('DOMContentLoaded',async()=>{
  $('fuelAuto')?.addEventListener('change',reprice);$('fuelNationalAuto')?.addEventListener('change',reprice);$('diesel')?.addEventListener('input',reprice);
  $('fuelRefresh')?.addEventListener('click',()=>analyze(window.geocostReportData?.()?.route));
  $('fuelOnlineRefresh')?.addEventListener('click',updateOnline);
  $('fuelImport')?.addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;const count=await importCsv(f);alert('Actualizados '+count+' precios estatales manualmente.')}catch(ex){alert(ex.message)}});
  try{await loadSnapshot();const r=window.geocostReportData?.()?.route;if(r)void analyze(r)}catch(e){usedStatus=e.message;announce()}
  // La actualización automática puede fallar sin romper la cotización.
  void updateOnline();
  let lastAttempt=Date.now();const refreshIfNeeded=()=>{if(Date.now()-lastAttempt<6*60*60*1000)return;lastAttempt=Date.now();void updateOnline();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshIfNeeded()});
  setInterval(refreshIfNeeded,6*60*60*1000);
 });
})();
