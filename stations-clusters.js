/* GeoCost SC — Gasolineras México con clústeres y precio de estación verificado.
   CNE/CRE places + prices se unen por place_id en Netlify Function.
   Se muestran las estaciones del área visible SIN imponer radio; todos los niveles de zoom.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const MX=[[14,-118.7],[33.5,-86.3]];
 let enabled=false,group=null,seq=0,inflight=false,timer=null,raw=[],lastKey='',bindingDone=false,lastSource='',lastUpdate='';
 const status=t=>{if($('serviceStationStatus'))$('serviceStationStatus').textContent=t};
 const fuel=()=>String($('serviceFuelType')?.value||'diesel');
 const show=()=>Boolean(enabled&&$('serviceStationsOn')?.checked);
 const priceFor=s=>s.prices?.[fuel()]||null;
 const label=s=>{const p=priceFor(s);return p&&Number.isFinite(Number(p.price))?`$${Number(p.price).toFixed(2)}/L`:'Sin precio reportado'};
 function bbox(){return [-118.7,14,-86.3,33.5];} // Padrón de todo México: independiente de ruta y vista.
 function key(b){return b.map(x=>Math.round(x*10)/10).join(',');}
 function wipe(){if(group&&window.map?.hasLayer(group))window.map.removeLayer(group);group=null;}
 function filtered(){const q=String($('serviceStationFilter')?.value||'').trim().toLowerCase(),type=fuel();
   const verified=raw.some(s=>(s.prices?.[type]&&Number.isFinite(+s.prices[type].price))||(type==='diesel'&&s.dieselAvailable===true));
   return raw.filter(s=>{
     // Con precios oficiales, limitar a estaciones que reportan el combustible seleccionado.
     // En respaldo cartográfico no hay prueba de inventario: mostrar localización con advertencia.
     if(verified&&!((s.prices?.[type]&&Number.isFinite(+s.prices[type].price))||(type==='diesel'&&s.dieselAvailable===true)))return false;
     return !q||[s.name,s.brand,s.address,s.permit,s.id].some(v=>String(v||'').toLowerCase().includes(q));
   });
 }
 function updateSummary(){const box=$('serviceStationList');if(!box)return;
  const list=filtered(),withPrices=list.filter(s=>priceFor(s)&&Number.isFinite(Number(priceFor(s).price))).length;
  box.innerHTML=`<div class="gc-station-stats"><strong>${list.length.toLocaleString('es-MX')} estaciones en México</strong><span>${withPrices.toLocaleString('es-MX')} con precio ${safe(fuel())} reportado</span></div><p class="hint">${safe(lastSource||'Fuente no disponible')} ${lastUpdate?' · consulta '+safe(lastUpdate.slice(0,10)):''}. El precio y la fecha se muestran en cada estación; no se aplica el promedio estatal a estos pines.</p>`;
 }
 function draw(){wipe();if(!show()||!window.L||!window.map)return;
  group=typeof L.markerClusterGroup==='function'?L.markerClusterGroup({chunkedLoading:true,chunkInterval:100,chunkDelay:20,maxClusterRadius:67,showCoverageOnHover:false,disableClusteringAtZoom:17}):L.layerGroup();
  const ico=L.divIcon({className:'gc-station-icon',html:'<span class="gc-station-marker">⛽</span>',iconSize:[30,30],iconAnchor:[15,27]});
  const points=filtered().map(s=>{
   if(!Number.isFinite(+s.lat)||!Number.isFinite(+s.lon))return null;
   const p=priceFor(s),isVerified=Boolean(p&&Number.isFinite(+p.price)),html=`<strong>${safe(s.name||'Estación de servicio')}</strong>${s.brand?'<br>Marca: '+safe(s.brand):''}${s.address?'<br>'+safe(s.address):''}<br><b>${safe(fuel().toUpperCase())}: ${isVerified?'$'+Number(p.price).toFixed(2)+'/L':'sin precio individual verificado'}</b>${isVerified?'<br>Fecha reportada: '+safe(p.date||'sin fecha')+'<br><small>Precio reportado; no garantizado en bomba.</small>':'<br><small>Disponibilidad de diésel no confirmada salvo que el registro la indique.</small>'}<br><small>Fuente: ${safe(s.origin||'registro público')}.</small>`;
   return L.marker([s.lat,s.lon],{icon:ico,title:s.name||'Gasolinera'}).bindPopup(html);
  }).filter(Boolean);
  if(group.addLayers)group.addLayers(points);else points.forEach(p=>group.addLayer(p));group.addTo(window.map);updateSummary();
 }
 async function refresh(force=false){if(!show()||!window.map)return;
  const b=bbox();if(b[0]>=b[2]||b[1]>=b[3])return;const k=key(b);
  if(!force&&k===lastKey)return;
  const version=++seq;
  if(inflight){ // Let the next viewport supersede the in-flight response, scheduled moveend retries.
   return;
  }
  inflight=true;status('Consultando estaciones de TODO México (no limitadas a la ruta)…');
  try{
   const res=await fetch('/.netlify/functions/gasolineras-nacional?bbox='+encodeURIComponent(b.join(',')),{cache:'default',signal:AbortSignal.timeout(50000)});
   if(!res.ok)throw Error('HTTP '+res.status+'; comprueba que Netlify Functions está desplegado');
   const data=await res.json();if(data.error)throw Error(data.error);
   if(!enabled)return;
   raw=Array.isArray(data.stations)?data.stations:[];lastKey=k;lastSource=String(data.source||'CNE/CRE');lastUpdate=String(data.updatedAt||'');
   draw();status(`${raw.length.toLocaleString('es-MX')} estaciones cartografiadas en el país. ${data.warning?'Respaldo cartográfico sin precios individuales; fuente CNE temporalmente no disponible.':'Precios individuales reportados, con fecha de observación.'} Acerca el zoom para ver cada estación.`);
  }catch(ex){status('No se pudo cargar la red nacional: '+String(ex.message||ex)+'. La cotización sigue utilizando diésel estatal; consulta GasMapa mientras se corrige el servicio.');}
  finally{inflight=false;if(enabled&&key(bbox())!==lastKey&&key(bbox())!==k)schedule();}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(show())void refresh()},700);}
 function enable(value){enabled=!!value;if(!enabled){seq++;wipe();status('Estaciones ocultas');return;}if(show())void refresh(true);}
 document.addEventListener('DOMContentLoaded',()=>{
  const m=window.map;
  if(m&&!bindingDone){m.on('moveend',schedule);bindingDone=true;}
  $('serviceStationLoad')?.addEventListener('click',()=>{lastKey='';void refresh(true)});
  $('serviceZoomMexico')?.addEventListener('click',()=>{window.map?.fitBounds(MX,{padding:[15,15]});draw()});
  $('serviceStationsOn')?.addEventListener('change',e=>e.target.checked?(enabled?refresh(true):null):wipe());
  $('serviceFuelType')?.addEventListener('change',()=>{draw();status(`Mostrando ${fuel()} de estaciones disponibles en el mapa.`)});
  $('serviceStationFilter')?.addEventListener('input',draw);
  document.addEventListener('geocoast:services-visibility',e=>enable(e.detail.visible));
 });
 window.GCStationClusters={refresh:()=>refresh(true),isNational:true};
})();
