/* Catálogo mixto: ubicaciones internas + fichas oficiales verificadas CEMEX.
   Los registros sin coordenadas nunca se pintan como ubicación exacta.
   La geocodificación es por acción explícita y requiere confirmación del usuario. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 let official=[],active=null,visible=false,waiting=false,chosen=new Map();
 const known=()=>Array.isArray(window.bodegas)?window.bodegas:[];
 const aliasIndex=()=>new Map(official.filter(x=>x.existingAlias).map(x=>[norm(x.existingAlias),x]));
 function allRecords(){
   const aliases=aliasIndex();
   const base=known().filter(x=>!x.officialId).map(x=>({name:x.name,kind:aliases.get(norm(x.name))?.kind||'Interno',state:aliases.get(norm(x.name))?.state||'',type:x.type,site:x,source:aliases.get(norm(x.name))||null,verifiedCoords:true}));
   const additions=official.filter(x=>!x.existingAlias).map(x=>({name:x.name,kind:x.kind,state:x.state,type:'Planta '+x.kind.toLowerCase(),source:x,site:known().find(b=>b.officialId===x.id)||null,verifiedCoords:!!known().find(b=>b.officialId===x.id)}));
   return [...base,...additions];
 }
 function make(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
 function status(text){$('cemexLocateResults').textContent=text}
 function switchPanel(show){visible=show;$('cemexCatalogPanel').hidden=!show;if(show)render();}
 function selectItem(record){if(record.site?.ll){
     window.geoUseOfficialSite?.(record.site,false);window.geoLayers?.setSitesVisible(true);window.map?.setView(record.site.ll,Math.max(11,window.map.getZoom()));
     const p=L.popup().setLatLng(record.site.ll).setContent('<b>'+esc(record.name)+'</b><br>'+esc(record.source?.address||'Ubicación en catálogo existente')).openOn(window.map);
     return;
   }
   active=record.source; $('cemexCatalogLocate').hidden=false;$('cemexLocateTitle').textContent='Ubicar: '+record.name;
   $('cemexLocateAddress').value=active.address;status('La dirección oficial está verificada, pero el punto vial aún no. Busca y confirma un resultado.');
   $('cemexCatalogLocate').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 function render(){
   const all=allRecords();const q=norm($('cemexCatalogSearch').value),state=$('cemexCatalogState').value,kind=$('cemexCatalogKind').value;
   const rows=all.filter(r=>(!state||r.state===state)&&(!kind||r.kind===kind)&&(!q||norm([r.name,r.state,r.source?.city,r.source?.address,r.type].join(' ')).includes(q)));
   $('cemexCatalogCount').textContent=`${known().length} puntos ubicados en el mapa · ${official.filter(x=>!x.existingAlias).length} fichas nuevas por localizar`; 
   const host=$('cemexCatalogList');host.replaceChildren();
   const frag=document.createDocumentFragment();
   for(const r of rows){
     const item=make('article','gc-cemex-entry');
     const body=make('div','gc-cemex-entry-main');body.appendChild(make('strong','',r.name));
     body.appendChild(make('small','',`${r.kind==='Interno'?r.type:r.kind} · ${r.state||'Estado no especificado'}`));
     if(r.source?.address)body.appendChild(make('small','gc-cemex-address',r.source.address));
     body.appendChild(make('small','gc-cemex-status',r.site?.ll?'Punto disponible en mapa':'Dirección CEMEX confirmada · falta geolocalizar'));
     const controls=make('div','gc-cemex-entry-actions');
     const btn=make('button','secondary',r.site?.ll?'Ver / elegir':'Ubicar para cotizar');btn.type='button';btn.addEventListener('click',()=>selectItem(r));controls.appendChild(btn);
     if(r.source?.url){const link=make('a','', 'Ficha oficial ↗');link.href=r.source.url;link.target='_blank';link.rel='noopener noreferrer';controls.appendChild(link)}
     item.append(body,controls);frag.append(item);
   }
   host.append(frag);if(!rows.length)host.textContent='No se encontraron coincidencias.';
 }
 function savePoint(point){
   if(!active)return;
   const lat=Number(point[0]),lng=Number(point[1]);
   if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<14||lat>33||lng < -119||lng > -86){status('Las coordenadas no corresponden a una ubicación válida en México.');return}
   try{const site=window.geoRegisterOfficialSite(active,[lat,lng]);chosen.set(active.id,site);
     const pane=$('cemexLocateResults');pane.replaceChildren();
     const msg=make('p','gc-cemex-success','Punto seleccionado. Verifica que coincida con el acceso real antes de usarlo para una cotización.');
     const actions=make('div','gc-cemex-entry-actions');
     for(const [label,asDest] of [['Usar como origen',false],['Usar como destino',true]]){
       const b=make('button','secondary',label);b.type='button';b.addEventListener('click',()=>{window.geoUseOfficialSite?.(site,asDest);switchPanel(false)});actions.appendChild(b);
     }
     pane.append(msg,actions);window.map?.setView(site.ll,13);window.geoLayers?.setSitesVisible(true);render();
   }catch(e){status('No se pudo registrar el punto: '+e.message)}
 }
 async function locate(){
   if(waiting||!active)return;const q=$('cemexLocateAddress').value.trim();if(q.length<9){status('Ingresa calle, municipio y estado.');return}
   waiting=true;$('cemexLocateSearch').disabled=true;status('Buscando direcciones en OpenStreetMap…');
   try{
     const u='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=mx&limit=5&q='+encodeURIComponent(q);
     const res=await fetch(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(13000)});
     if(!res.ok)throw Error('Búsqueda HTTP '+res.status);
     const candidates=await res.json();const pane=$('cemexLocateResults');pane.replaceChildren();
     if(!candidates.length){status('No hubo resultados exactos. Ajusta la dirección o usa coordenadas verificadas. No se colocará un marcador aproximado.');return}
     pane.appendChild(make('p','hint','Selecciona únicamente un resultado que corresponda a la instalación, no al centro de la ciudad:'));
     for(const match of candidates){
       const b=make('button','gc-cemex-geocode-choice',match.display_name);b.type='button';
       b.addEventListener('click',()=>savePoint([match.lat,match.lon]));pane.appendChild(b);
     }
   }catch(err){status('No fue posible geocodificar: '+err.message+'. Puedes ingresar coordenadas verificadas manualmente.')}
   finally{waiting=false;$('cemexLocateSearch').disabled=false}
 }
 async function start(){
   try{const r=await fetch('data/cemex-ubicaciones-oficiales.json',{cache:'force-cache'});if(!r.ok)throw Error('Falta archivo de CEMEX');
     const data=await r.json();official=data.locations.filter(x=>x.url?.startsWith('https://www.cemexmexico.com/')&&x.name&&x.address);
     const states=[...new Set(official.map(x=>x.state))].sort((a,b)=>a.localeCompare(b,'es'));
     for(const state of states){const op=document.createElement('option');op.value=state;op.textContent=state;$('cemexCatalogState').appendChild(op)}
     function restore(){if(!window.bodegas?.length)return false;try{const saved=JSON.parse(localStorage.getItem('geocoast-cemex-puntos-verificados-v1')||'{}');for(const loc of official){const c=saved[loc.id];if(c&&Number.isFinite(+c.lat)&&Number.isFinite(+c.lng))window.geoRegisterOfficialSite?.(loc,[c.lat,c.lng]);}}catch(e){}render();return true}
     if(!restore()){document.addEventListener('geocoast:catalog-loaded',restore,{once:true})}
   }catch(e){$('cemexCatalogList').textContent='No se pudo leer el catálogo oficial: '+e.message}
 }
 document.addEventListener('DOMContentLoaded',()=>{
   $('cemexCatalogClose')?.addEventListener('click',()=>{switchPanel(false);window.geoLayers?.setSitesVisible(false)});
   $('cemexCatalogSearch')?.addEventListener('input',render);
   $('cemexCatalogState')?.addEventListener('change',render);
   $('cemexCatalogKind')?.addEventListener('change',render);
   $('cemexLocateSearch')?.addEventListener('click',locate);
   $('cemexManualPoint')?.addEventListener('click',()=>savePoint([$('cemexLat').value,$('cemexLng').value]));
   void start();
 });
 window.geoOfficialSites={toggle:show=>switchPanel(typeof show==='boolean'?show:!visible),getLocations:()=>official.slice()};
})();
