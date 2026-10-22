/* Servicios: precios por clúster estatal. No crea pines falsos de gasolineras. */
(()=>{
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let layer=null,visible=false;
 const core=()=>window.GCStateFuelCore;
 const label=k=>k==='mexico'?'Estado de México':k==='ciudaddemexico'?'Ciudad de México':k.replace(/(^|\s)\S/g,c=>c.toUpperCase());
 function dataset(){let f=window.GCFuel?.getInfo?.();return f||{rows:[],states:{},centers:{},date:'',coverage:0,price:0,routeKm:0};}
 function showPins(data){if(!window.map||!window.L)return;if(layer){window.map.removeLayer(layer);layer=null;}
 if(!visible||!$('serviceMapPins').checked||!data.routeKm)return;
 layer=typeof L.markerClusterGroup==='function'?L.markerClusterGroup({maxClusterRadius:65,showCoverageOnHover:false}):L.layerGroup();
 const byKey=new Map(data.rows.map(r=>[core().key(r.state),r]));
 for(const [k,km] of Object.entries(data.states)){const at=data.centers[k],r=byKey.get(k);if(!at||!r)continue;
 const ico=L.divIcon({className:'gc-fuel-cluster-pin',html:`<div class="gc-fuel-pin">⛽<b>$${Number(r.diesel).toFixed(2)}</b></div>`,iconSize:[85,32],iconAnchor:[42,16]});
 L.marker(at,{icon:ico,title:`Clúster estatal: ${r.state}`}).bindPopup(`<b>${escape(r.state)}</b><br>Promedio diésel: $${Number(r.diesel).toFixed(2)}/L<br>Ruta: ${km.toFixed(1)} km<br>Estaciones en entidad: ${Number(r.stations||0).toLocaleString('es-MX')}<br><small>Punto representativo del trayecto, no ubicación de gasolinera.</small>`).addTo(layer);
 }
 layer.addTo(window.map);
 }
 function render(){const d=dataset(),only=$('serviceOnlyRoute').checked,selectedKeys=new Set(Object.keys(d.states||{})),rows=d.rows.filter(r=>!only||selectedKeys.has(core().key(r.state))).sort((a,b)=>only?(d.states[core().key(b.state)]||0)-(d.states[core().key(a.state)]||0):a.state.localeCompare(b.state,'es'));
 $('serviceUpdateStatus').textContent=`Corte GasMapa: ${d.date||'sin fecha'} · ${d.rows.length||0} entidades · ${d.edited?'incluye ajustes manuales · ':''}precios orientativos reportados, no de bomba.`;
 $('serviceSummary').innerHTML=d.routeKm?`<strong>Ruta: ${d.routeKm.toFixed(1)} km · diésel ponderado $${d.price.toFixed(2)}/L</strong><small>Cobertura con polígonos SAP y precio estatal: ${Math.round(d.coverage*100)}%. Tramos sin asignación usan el respaldo.</small>`:`<strong>Promedio nacional: $${Number(d.national||0).toFixed(2)}/L</strong><small>Calcula una ruta para ver los clústeres atravesados.</small>`;
 $('serviceClusters').innerHTML=rows.length?rows.map(r=>{const k=core().key(r.state),km=d.states[k],count=Number(r.stations||0);return `<div class="gc-service-cluster"><div><b>${escape(r.state)}</b><small>${km!=null?`${km.toFixed(1)} km de ruta · `:''}${count?count.toLocaleString('es-MX')+' estaciones en el estado':'Conteo no disponible'}</small></div><strong>$${Number(r.diesel).toFixed(2)}<small>MXN/L</small></strong></div>`}).join(''):`<p class="hint">${only?'Sin estados identificados. Calcula una ruta o desactiva el filtro.':'No hay tabla de precios disponible.'}</p>`;
 showPins(d);
 }
 function toggle(force){visible=typeof force==='boolean'?force:!visible;$('servicePanel').hidden=!visible;const btn=$('topServicios');btn?.classList.toggle('layer-active',visible);btn?.setAttribute('aria-expanded',String(visible));btn?.setAttribute('aria-pressed',String(visible));if(visible)render();else if(layer){window.map?.removeLayer(layer);layer=null}document.dispatchEvent(new CustomEvent('geocoast:services-visibility',{detail:{visible}}))}
 document.addEventListener('DOMContentLoaded',()=>{
 $('topServicios')?.addEventListener('click',()=>{window.GCNavigation?.open?.();toggle();});
 $('serviceClose')?.addEventListener('click',()=>toggle(false));
 $('serviceOnlyRoute')?.addEventListener('change',render);$('serviceMapPins')?.addEventListener('change',render);
 document.addEventListener('geocoast:fuel-updated',()=>{if(visible)render()});
 });
})();
