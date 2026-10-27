const $=id=>document.getElementById(id); const MX=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);const N=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);
const units=[{name:'Camioneta',cap:5,kml:7.5},{name:'Rabón',cap:9,kml:3.6},{name:'Torton',cap:18,kml:3.0},{name:'Tráiler',cap:28,kml:2.5},{name:'Full',cap:50,kml:1.65}];let nearbySelection=null;let originQuotes=[],quoteRequest=0,frentes=[],bodegas=[],selectedDest=null,selectedSite=null,route=null,heat=false,presentation='Sacos',lastRouted=[],mapsites=[],terrainSamples=null;
const map=L.map('map',{zoomControl:false}).setView([19.3,-99],7);window.map=map;L.control.zoom({position:'bottomright'}).addTo(map);
const layers={calles:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}),satelite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagery © Esri'}),relieve:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenTopoMap, OpenStreetMap'})};layers.calles.addTo(map);let basemap='calles',siteLayer=L.layerGroup().addTo(map),routingLayer=L.layerGroup().addTo(map),heatLayer=L.layerGroup().addTo(map),extraLayer=L.layerGroup().addTo(map);
function setStatus(s){$('mapStatus').textContent=s};function panel(name,force){const e=$('p-'+name); if(!e) return; const show=force===undefined?e.classList.contains('hidden'):force; e.classList.toggle('hidden',!show)}document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>panel(b.dataset.close,false)); if($('hideAll')) $('hideAll').onclick=()=>{};
function base(which){layers[basemap].remove();basemap=which;layers[which].addTo(map);document.querySelectorAll('[data-base]').forEach(b=>b.classList.toggle('selected',b.dataset.base===which));$('baseSelect').value=which}document.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>base(b.dataset.base));$('baseSelect').onchange=e=>base(e.target.value);
function iraSwitch(v){heat=v;$('heatCheck').checked=v;$('heatToggle').classList.toggle('enabled',v);$('heatToggle').querySelector('span').textContent=v?'ON':'OFF';$('heatToggle').querySelector('span').style.color=v?'#168558':'';$('mapStatus').textContent=v?'Calculando IRA relativo de la ruta…':'IRA desactivado · ruta azul uniforme.';$('mapStatus').title='Bandas relativas de GeoRisk V112; elevación Open-Meteo';$('heatToggle').title='Bandas IRA relativas de GeoRisk V112(9); diferencias posibles en fuente de altitud';$('heatToggle').style.borderColor=v?'#0a70b9':'';drawHeat()};$('heatCheck').onchange=e=>iraSwitch(e.target.checked);$('heatToggle').onclick=()=>iraSwitch(!heat);$('showSites').onchange=e=>e.target.checked?siteLayer.addTo(map):siteLayer.remove();$('showRoutes').onchange=e=>e.target.checked?routingLayer.addTo(map):routingLayer.remove();
function paintSites(){siteLayer.clearLayers();mapsites=[];bodegas.forEach(s=>{let marker=L.circleMarker(s.ll,{radius:5,weight:1.7,color:'#fff',fillColor:'#006eb7',fillOpacity:.95});marker.bindPopup(`<b>${escapeHtml(s.name)}</b><br>${escapeHtml(s.type)}<br><button onclick="chooseSite(${s.idx})">Usar como origen</button>`);siteLayer.addLayer(marker);mapsites.push(marker)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// Instala una ubicación nueva SOLO tras confirmar su punto sobre el mapa.
window.geoRegisterOfficialSite=(metadata,coords)=>{
 const lat=Number(coords?.[0]),lng=Number(coords?.[1]);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<14||lat>33||lng< -119||lng> -86)throw Error('Coordenadas fuera de México o no válidas');
 const already=bodegas.find(b=>b.officialId===metadata.id);
 if(already){already.ll=[lat,lng];return already;}
 const site={name:metadata.name,type:metadata.kind==='Cemento'?'Planta de cemento':metadata.kind==='Concreto'?'Planta de concreto':'Planta de agregados',ll:[lat,lng],idx:bodegas.length,officialId:metadata.id,officialUrl:metadata.url,officialAddress:metadata.address,verifiedByUser:true};
 bodegas.push(site);
 try{const store=JSON.parse(localStorage.getItem('geocoast-cemex-puntos-verificados-v1')||'{}');store[metadata.id]={lat,lng};localStorage.setItem('geocoast-cemex-puntos-verificados-v1',JSON.stringify(store))}catch(_){}
 const option=document.createElement('option');option.value=site.name;$('bodegaList').appendChild(option);
 $('frontCount').textContent=`${frentes.length.toLocaleString('es-MX')} frentes y ${bodegas.length} ubicaciones CEMEX geolocalizadas disponibles`;
 if(typeof window.geoLayers?.addSite==='function')window.geoLayers.addSite(site);
 else paintSites();
 return site;
};
window.geoUseOfficialSite=(site,asDestination=false)=>{
 if(!site?.ll)throw Error('Primero verifica las coordenadas de la instalación');
 if(asDestination){selectedDest={...site,nombre:site.name,cemex_id:'CEMEX',isWarehouse:true};$('destino').value=site.name;}
 else{selectedSite=site;$('origen').value=site.name;}
 map.setView(site.ll,Math.max(11,map.getZoom()));
 setStatus(`${site.name}: ubicación seleccionada. Confirma el acceso vial antes de cotizar.`);
};

async function load(){try{const [fs,bs]=await Promise.all([fetch('data/frentes.json').then(r=>r.json()),fetch('data/bodegas.json').then(r=>r.json())]);frentes=fs.filter(f=>Number.isFinite(+f.lat)&&Number.isFinite(+f.lng)).map((f,i)=>({...f,idx:i,ll:[+f.lat,+f.lng]}));bodegas=bs.filter(b=>Array.isArray(b[1])&&b[1].length===2).map((b,i)=>({name:b[0],ll:b[1],type:b[2],idx:i}));window.bodegas=bodegas;window.frentes=frentes;document.dispatchEvent(new CustomEvent('geocoast:catalog-loaded',{detail:{sites:bodegas.length,clients:frentes.length}}));$('bodegaList').innerHTML=bodegas.slice(0,45).map(s=>`<option value="${escapeHtml(s.name)}">`).join('');$('frenteList').innerHTML='';$('frontCount').textContent=`${frentes.length.toLocaleString('es-MX')} frentes y ${bodegas.length} ubicaciones CEMEX disponibles`;selectedSite=bodegas.find(s=>s.name.toLowerCase().includes('vallejo'))||bodegas[0];$('origen').value=selectedSite.name;paintSites();siteLayer.remove();setStatus('Catálogos cargados · Selecciona un origen y destino')}catch(e){setStatus('Error al cargar catálogos. Ejecuta con un servidor local (no file://).')}}load();
function findSite(){
 const value=$('origen').value.trim().toLowerCase();
 const found=bodegas.find(x=>x.name.toLowerCase()===value)||bodegas.find(x=>value.length>=3&&x.name.toLowerCase().includes(value));
 return found||((selectedSite?.idx===-1&&selectedSite.name.toLowerCase()===value)?selectedSite:null);
}
function findFront(){
 const value=$('destino').value.trim().toLowerCase();
 const site=bodegas.find(x=>x.name.toLowerCase()===value)||bodegas.find(x=>value.length>=3&&x.name.toLowerCase().includes(value));
 if(site)return {...site,nombre:site.name,cemex_id:'CEMEX',isWarehouse:true};
 const front=frentes.find(x=>(x.nombre+' · '+x.cemex_id).toLowerCase()===value)||frentes.find(x=>x.cemex_id?.toLowerCase()===value)||frentes.find(x=>x.nombre.toLowerCase()===value);
 if(front)return front;
 return selectedDest&&selectedDest.ll&&$('destino').value.trim()===(selectedDest.nombre||'')?selectedDest:null;
}
window.chooseSite=i=>{selectedSite=bodegas[i];$('origen').value=selectedSite.name;panel('ruta',true);if(selectedDest)goRoute()};map.on('click',e=>{if(window.GCStationClusters?.isPickingCenter?.())return;selectedDest={nombre:'Punto seleccionado',ll:[e.latlng.lat,e.latlng.lng]};$('destino').value=`Punto: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;panel('ruta',true);setStatus('Punto de destino fijado · Pulsa Trazar y cotizar')});$('destino').addEventListener('change',()=>{const f=findFront();if(f)selectedDest=f});$('origen').addEventListener('change',()=>{const s=findSite();if(s)selectedSite=s});$('swap').onclick=()=>{alert('Para invertir la operación, selecciona un nuevo origen del catálogo y un destino válido.')};$('draw').onclick=goRoute;
function dist(a,b){const r=Math.PI/180,p1=a[0]*r,p2=b[0]*r,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dlon/2)**2))}
// Selección por radio progresivo desde el frente destino, nunca desde el origen.
// El radio sólo preselecciona; la prioridad comercial usa km viales comprobados.
const RADII_KM=[25,50,100,150,250,400,650,1000];
function eligibleOrigin(s){return !/virtual|nombre interno|unidad estratégica|centro tecnológico/i.test(s.type||'') && !(s.officialId && /agregados|concreto/i.test(s.type||''))}
function findNearbySites(maxResults=4){
 if(!selectedDest)return {items:[],radius:null,total:0};
 const origin=findSite()||selectedSite;
 const pool=bodegas.filter(s=>eligibleOrigin(s)&&(!origin||s.idx!==origin.idx))
  .map(site=>({site,linear:dist(site.ll,selectedDest.ll)})).sort((a,b)=>a.linear-b.linear);
 let radius=RADII_KM.find(r=>pool.filter(x=>x.linear<=r).length>=maxResults);
 if(radius===undefined)radius=RADII_KM[RADII_KM.length-1];
 const local=pool.filter(x=>x.linear<=radius);
 return {items:local.slice(0,maxResults),radius,total:local.length,available:pool.length};
}
function nearest(){
 if(!selectedDest)return;
 nearbySelection=findNearbySites(4);
 const origin=findSite()||selectedSite;
 const {items,radius,total}=nearbySelection;
 $('alternatives').innerHTML=`<div class="hint"><b>Radio automático: ${radius} km</b> desde el frente destino.</div>`+items.map(x=>`<div class="site"><div><strong>${escapeHtml(x.site.name)}</strong><small>${N(x.linear)} km geográficos · ${escapeHtml(x.site.type)}</small></div><button onclick="chooseSite(${x.site.idx})">Usar</button></div>`).join('');
}
function renderSelectableRoutes(activeIndex){
 routingLayer.clearLayers();
 lastRouted.slice().reverse().forEach(r=>{
  const active=r.index===activeIndex, color=active?'#084ddb':'#ec9028';
  const line=L.polyline(r.coords,{color,weight:active?7:5,opacity:active?1:.78}).addTo(routingLayer);
  const hit=L.polyline(r.coords,{color:'#ffffff',opacity:0,weight:23}).addTo(routingLayer);
  const choose=()=>window.selectRoute(r.index);
  line.on('click',choose);hit.on('click',choose);
  line.bindTooltip(`Ruta ${r.index+1} · ${N(r.km)} km · clic para recotizar`,{sticky:true});
 });
}
async function goRoute(){document.dispatchEvent(new Event('geocoast:route-start'));quoteRequest++;originQuotes=[];selectedSite=findSite();selectedDest=findFront()||selectedDest;if(selectedSite&&selectedDest&&dist(selectedSite.ll,selectedDest.ll)<0.05){setStatus('Selecciona dos instalaciones diferentes para una operación de abasto.');return;}if(!selectedSite||!selectedDest){panel('ruta',true);setStatus(!selectedSite?'Origen no geolocalizado: selecciona una bodega con coordenadas disponibles o verifica el punto exacto antes de cotizar.':'Selecciona un frente o destino geolocalizado.');return}if(!validate()){panel('unidad',true);return}routingLayer.clearLayers();extraLayer.clearLayers();heatLayer.clearLayers();terrainSamples=null;setStatus('Consultando rutas por carretera…');const start=selectedSite.ll,end=selectedDest.ll;map.fitBounds(L.latLngBounds(start,end).pad(.22));L.marker(start).addTo(extraLayer).bindPopup('Origen: '+escapeHtml(selectedSite.name));L.marker(end).addTo(extraLayer).bindPopup('Frente: '+escapeHtml(selectedDest.nombre));nearest();$('originQuoteResults').innerHTML='<p class="hint">Consultando rutas desde bodegas cercanas…</p>';try{let url=`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true&steps=true`;const response=await fetch(url,{signal:AbortSignal.timeout(18000)});const data=await response.json();if(data.code!=='Ok'||!data.routes?.length)throw Error('Sin ruta vial');lastRouted=data.routes.slice(0,3).map((r,i)=>({km:r.distance/1000,h:r.duration/3600,coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),index:i,raw:r}));for(const r of lastRouted){const geometryKm=(r.coords||[]).slice(1).reduce((sum,p,j)=>sum+dist(r.coords[j],p),0);r.geometryKm=geometryKm;r.distanceQuality=Math.abs(geometryKm-r.km)/Math.max(.001,r.km)>0.12?'La geometría y el kilometraje del motor vial difieren más de 12%. Revisar trazado.':'Consistente';}
renderSelectableRoutes(0);route=lastRouted[0];map.fitBounds(L.latLngBounds(route.coords).pad(.08));setStatus(`Rutas preliminares (OSRM automóvil): ${N(route.km)} km · ${lastRouted.length} alternativa(s) · NOM-012 pendiente de validar por tramo · velocidad de simulación máx. 80 km/h`);updateCalculations();panel('resumen',true);panel('costos',true);void activateSelectedRoute(route);void compareNearbyOrigins()}catch(e){route=null;lastRouted=[];setStatus('No fue posible obtener trazado por carretera. Reintenta con conexión. No se estimarán kilómetros por línea recta.');$('summary').innerHTML='<p class="error">Servicio de rutas no disponible. No hay distancia vial verificada.</p>';panel('resumen',true)}}
async function elevations(coords){
 try{
  const axis=axisRoute(coords),max=Math.min(180,Math.max(48,Math.ceil(axis.total/350)+1)),pts=Array.from({length:max},(_,i)=>pointOnAxis(axis,axis.total*i/(max-1)));
  // Peticiones breves: evitan respuestas largas o límites del servicio de elevación.
  const heights=[];
  const batches=[];for(let start=0;start<pts.length;start+=55)batches.push(pts.slice(start,start+55));
  const fetched=await Promise.all(batches.map(async batch=>{
   const q=new URLSearchParams({latitude:batch.map(p=>p[0].toFixed(5)).join(','),longitude:batch.map(p=>p[1].toFixed(5)).join(',')});
   const response=await fetch('https://api.open-meteo.com/v1/elevation?'+q.toString(),{signal:AbortSignal.timeout(9500)});
   if(!response.ok)throw new Error('elevation HTTP '+response.status);
   const j=await response.json();if(!Array.isArray(j.elevation)||j.elevation.length!==batch.length||j.elevation.some(e=>!Number.isFinite(e)))throw new Error('elevation invalid');
   return j.elevation;
  }));heights.push(...fetched.flat());
  return pts.map((p,i)=>({p,e:heights[i]}));
 }catch(err){console.warn('No se pudo consultar altimetría:',err);return null;}
}
// Clasificación operativa preliminar basada en las siete clases GR-EL-2.3-RNC2025.
// Sin geometría oficial RNC: la clase vial es desconocida. Nunca se presume una autorización NOM-012.
function axisRoute(coords){let cumulative=[0];for(let i=1;i<coords.length;i++)cumulative.push(cumulative.at(-1)+dist(coords[i-1],coords[i])*1000);return {coords,cumulative,total:cumulative.at(-1)}}
function pointOnAxis(ax,meters){let i=1;while(i<ax.cumulative.length-1&&ax.cumulative[i]<meters)i++;let a=ax.coords[i-1],b=ax.coords[i],t=(meters-ax.cumulative[i-1])/Math.max(1,ax.cumulative[i]-ax.cumulative[i-1]);return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]}
function effortAnalysis(samples,km){
 const labels=['Urbano','Autopista sin sierra','Autopista con sierra','Pavimento sin sierra','Pavimento con sierra','Terracería sin sierra','Terracería con sierra'];
 if(!samples||samples.length<3)return {available:false,reason:'Altimetría insuficiente; sin ajuste automático',labels};
 const intervals=[];let ascent=0,descent=0,sierra=0,strong=0,weighted=0;
 for(let i=1;i<samples.length;i++){
  const metres=dist(samples[i-1].p,samples[i].p)*1000,delta=samples[i].e-samples[i-1].e;
  if(metres<1)continue;
  let grade=Math.abs(delta)/metres*100;
  if(delta>0)ascent+=delta;else descent-=delta;
  // Umbral preliminar de la metodología GeoRisk para pendiente fuerte: >=3%.
  // No sustituye la ventana sostenida de 500-1000 m del motor completo.
  const mountain=grade>=3; if(mountain)sierra+=metres;
  if(grade>=5)strong+=metres;
  weighted+=Math.min(15,grade)*metres;
  intervals.push({metres,grade,mountain});
 }
 let covered=intervals.reduce((n,x)=>n+x.metres,0),sierraShare=covered?sierra/covered:0,meanGrade=covered?weighted/covered:0;
 return {available:true,labels,ascent,descent,sierraShare,meanGrade,high:Math.max(...samples.map(s=>s.e)),low:Math.min(...samples.map(s=>s.e)),coveredKm:covered/1000,
  // Por carecer de atributos viales verificados, se reportan solo kilómetros por relieve.
  classes:null,roadStatus:'Tipo vial sin verificar (no se inventa autopista, pavimento ni terracería)',
  effortLevel:sierraShare>.45?'Alto':sierraShare>.2?'Medio':'Bajo',
  // Coeficientes demostrativos calibrables: mayor carga y mayor ascenso implican más diésel.
  fuelFactor:Math.min(.35,meanGrade*.015+(ascent/(Math.max(1,km)*1000))*.28),
  maintenanceFactor:Math.min(.25,sierraShare*.18+meanGrade*.008),
  timeFactor:Math.min(.25,sierraShare*.14+meanGrade*.009)};
}
// GeoRisk V112 category dictionary and sustained-relief concept (GR-EL-2.3-RNC2025).
// In this standalone cotizador no OSM/RNC road surface geometries are loaded.
// Hence unverified roads remain pending; never assign all km to a fictional road class.
const GEO_CLASSES=[['urbano','Urbano'],['autopista_sin','Autopista sin sierra'],['autopista_con','Autopista con sierra'],['pavimento_sin','Pavimento sin sierra'],['pavimento_con','Pavimento con sierra'],['terraceria_sin','Terracería sin sierra'],['terraceria_con','Terracería con sierra']];
function geoModel(eff,km){
 const result=route?.geoRiskEfforts;
 if(result?.rows?.length){
  return {rows:result.rows.map(x=>({id:x.id,name:x.label,km:x.meters/1000,share:x.share,estimatedKm:x.estimatedMeters/1000})),unknownKm:result.pendingMeters/1000,mountainKm:km*(eff?.sierraShare||0),version:result.version,verifiedRoadKm:Math.max(0,km-result.estimatedMeters/1000),estimatedKm:result.estimatedMeters/1000};
 }
 return {rows:GEO_CLASSES.map(([id,name])=>({id,name,km:null,share:null})),unknownKm:km,mountainKm:km*(eff?.sierraShare||0),version:'GeoRisk pendiente',verifiedRoadKm:0};
}
async function analyzeGeoRiskRoute(){
 if(!route)return;
 try{route.geoRiskEfforts=await window.GeoRiskEfforts?.analyze(route,terrainSamples)||null;}
 catch(error){console.warn('Error al clasificar esfuerzos logísticos:',error);route.geoRiskEfforts=null;}
}
function geoMultipliers(eff){
 const relief=eff?.available?eff:{fuelFactor:0,maintenanceFactor:0,timeFactor:0};
 // Editable coefficients below are increments applied to route cost, not fixed shares of total.
 const urbanFuel=input('urbanFuel')/100,urbanMaintenance=input('urbanMaintenance')/100;
 const mountainFuel=input('mountainFuel')/100,mountainMaint=input('mountainMaintenance')/100;
 const mountain=eff?.available?eff.sierraShare:0;
 // No verified urban kilometres -> don't apply urban coefficient without proof.
 const urban=route?.geoRiskEfforts?.rows?.find(r=>r.id==='urbano')?.share/100||0;
 return {fuel:Math.max(0,relief.fuelFactor||0)+mountain*mountainFuel+urban*urbanFuel,
 maintenance:Math.max(0,relief.maintenanceFactor||0)+mountain*mountainMaint+urban*urbanMaintenance,
 time:Math.max(0,relief.timeFactor||0),urban};
}
function geoBreakdown(eff,km){
 const editor=window.GCEffortEditor, raw=editor?.rows?.()||[];
 const rows=raw.length?raw:GEO_CLASSES.map(([id,name])=>({id,name,km:0}));
 const sumKm=rows.reduce((s,x)=>s+Math.max(0,Number(x.km)||0),0);
 const missing=Math.max(0,km-sumKm);
 const manual=editor?.modified?.()===true;
 const entries=rows.map(x=>{
  const v=Math.max(0,Number(x.km)||0),pct=km?100*v/km:0;
  return `<label class="gc-effort-inputrow"><span>${escapeHtml(x.name)}</span><input aria-label="${escapeHtml(x.name)} kilómetros" data-gc-effort="${escapeHtml(x.id)}" type="number" min="0" step="0.01" value="${v.toFixed(2)}"><b>km</b><strong>${pct.toFixed(1)}%</strong></label><div class="effort-meter"><i style="width:${Math.min(100,pct)}%"></i></div>`;
 }).join('');
 return `<section class="geo-effort gc-editable-effort"><div class="gc-effort-heading"><h4>Esfuerzos logísticos · GeoRisk SC</h4><button type="button" class="secondary" id="gcEffortResetInline">Restaurar automático</button></div><p class="hint">Edita kilómetros de la <b>ida</b>. La aplicación calculará la participación y ajustará diésel, llantas y mantenimiento del <b>ciclo ida + vuelta</b>. Las correcciones son locales de esta ruta. ${manual?'<b>Edición manual activa.</b>':'Se muestran los valores detectados automáticamente.'}</p><div class="gc-effort-grid-head"><span>Clasificación vial</span><span>Km ida</span><span></span><span>% ruta</span></div>${entries}<div class="gc-effort-pending">Sin clasificar: <b>${missing.toFixed(2)} km</b> (${km?(missing/km*100).toFixed(1):'0'}%)</div><div class="gc-effort-pending">Total clasificado: <b>${sumKm.toFixed(2)} / ${km.toFixed(2)} km</b></div>${sumKm>km+.1?'<p class="error">La suma supera la distancia. Reduce kilómetros para poder cotizar.</p>':''}<p class="hint">La clasificación automática depende de datos cartográficos y altimétricos; verifica los tramos antes de establecer tarifas. Los kilómetros no clasificados no reciben un recargo de superficie.</p></section>`;
}
document.addEventListener('change',e=>{
 const id=e.target?.dataset?.gcEffort;
 if(!id)return;
 const value=Number(e.target.value);
 if(!Number.isFinite(value)||value<0){alert('Ingresa kilómetros válidos (mayor o igual a cero).');return;}
 window.GCEffortEditor?.setManual?.(id,value);
});
document.addEventListener('click',e=>{if(e.target?.id==='gcEffortResetInline')window.GCEffortEditor?.restore?.();});
function nomPrecheck(unit,tons){return {status:'PENDIENTE DE VALIDACIÓN',reason:`${unit.name}: carga comercial ${N(tons)} Tn; verificar PBV real, configuración de ejes, dimensiones, clasificación oficial ET/A/B/C/D y restricciones por tramo antes de operar. El enrutador OSRM utiliza perfil de automóvil y no acredita compatibilidad NOM-012.`}}

// GeoRisk SC V112(9): escala de IRA relativa al mínimo/máximo de la ruta.
// GeoCoast usa Open-Meteo elevation; la fuente de elevación puede diferir de Terrarium GeoRisk.
function geoRiskIRABreakdown(){
 if(!route||!terrainSamples||terrainSamples.length<4)return null;
 const raw=terrainSamples.map(x=>Number(x.e));
 if(raw.some(v=>!Number.isFinite(v)))return null;
 const min=Math.min(...raw), max=Math.max(...raw), span=Math.max(600,max-min);
 const geometry=axisRoute(route.coords), rows=Array.from({length:6},(_,id)=>({id,meters:0,share:0})),segments=[];
 const colors=['#1588d6','#28b66c','#e4dc32','#f39822','#e84847','#8156b5'];
 for(let i=1;i<terrainSamples.length;i++){
  const a=terrainSamples[i-1],b=terrainSamples[i];
  const begin=geometry.total*(i-1)/(terrainSamples.length-1),end=geometry.total*i/(terrainSamples.length-1);
  const d=b.e-a.e,cuts=[0,1];
  if(d!==0)for(let k=1;k<6;k++){const t=(min+span*k/6-a.e)/d;if(t>1e-9&&t<1-1e-9)cuts.push(t);}
  cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){
   const t0=cuts[j-1],t1=cuts[j],e=a.e+d*(t0+t1)/2;
   const level=Math.max(0,Math.min(5,Math.floor((e-min)/span*6+1e-10)));
   const from=begin+(end-begin)*t0,to=begin+(end-begin)*t1;
   const meters=(to-from)*route.km*1000/Math.max(1,geometry.total);
   rows[level].meters+=meters;segments.push({level,from,to,meters});
  }
 }
 const known=rows.reduce((sum,x)=>sum+x.meters,0);
 rows.forEach(x=>x.share=known?100*x.meters/known:0);
 return {min,max,rows,segments,colors,known,total:route.km*1000,version:'Escala altimétrica relativa GeoRisk V112(9)',source:'Open-Meteo (puede diferir de Terrarium de GeoRisk)'};
}
function geoRiskIRAHtml(){
 const data=geoRiskIRABreakdown();
 if(!data)return '<section class="geo-effort"><h4>Desglose IRA 0–5</h4><p class="hint">Pendiente de elevaciones completas; no se inventan clases.</p></section>';
 const table=data.rows.map(r=>`<div class="effort-entry"><span><i style="display:inline-block;background:${data.colors[r.id]};width:11px;height:11px;border-radius:3px;margin-right:7px"></i>IRA ${r.id}</span><b>${(r.meters/1000).toFixed(2)} km</b><b>${r.share.toFixed(1)}%</b></div>`).join('');
 const low=data.rows.slice(0,3).reduce((a,r)=>a+r.meters,0),high=data.rows.slice(3).reduce((a,r)=>a+r.meters,0);
 return `<section class="geo-effort"><h4>Desglose de ruta por IRA · GeoRisk V112</h4><p class="hint">Mín. ${Math.round(data.min)} m · Máx. ${Math.round(data.max)} m · 0–2: ${(low/data.known*100).toFixed(1)}% · 3–5: ${(high/data.known*100).toFixed(1)}%</p><div class="effort-head"><span>Nivel IRA</span><span>Kilómetros</span><span>Participación</span></div>${table}<p class="hint">Mismo criterio de bandas de altitud relativa del GeoRisk V112(9). Las elevaciones proceden de Open-Meteo, por lo que puede haber diferencias frente a GeoRisk. El IRA por sí solo no certifica seguridad de unidades pesadas.</p></section>`;
}
function drawHeat(){
 heatLayer.clearLayers();
 const legend=document.querySelector('.legend');if(legend)legend.style.display=heat?'block':'none';
 if(!heat){if(route)setStatus('IRA desactivado · ruta azul uniforme.');return;}
 const data=geoRiskIRABreakdown();
 if(!data){setStatus('IRA pendiente: elevación no disponible o incompleta.');return;}
 if(!map.getPane('iraSegments'))map.createPane('iraSegments');
 map.getPane('iraSegments').style.zIndex='460';map.getPane('iraSegments').style.pointerEvents='none';
 const ax=axisRoute(route.coords),walk=(lo,hi)=>{
  const pts=[pointOnAxis(ax,lo)];
  for(let k=1;k<ax.cumulative.length-1;k++)if(ax.cumulative[k]>lo&&ax.cumulative[k]<hi)pts.push(ax.coords[k]);
  pts.push(pointOnAxis(ax,hi));return pts;
 };
 for(const s of data.segments)L.polyline(walk(s.from,s.to),{pane:'iraSegments',color:data.colors[s.level],weight:10,opacity:1,interactive:false,lineCap:'round'}).addTo(heatLayer);
 setStatus('IRA relativo por altitud · referencia GeoRisk V112(9); elevación Open-Meteo.');
}

const vehSel=$('vehiculo');function vehicles(){let allowed=units.filter(x=>presentation==='Granel'?x.name==='Full':x.name!=='Full');vehSel.innerHTML=allowed.map(u=>`<option value="${u.name}">${u.name} · hasta ${u.cap} Tn</option>`).join('');vehSel.value=allowed.some(u=>u.name==='Rabón')?'Rabón':allowed[0].name;validUnit()}function validUnit(){const u=units.find(x=>x.name===vehSel.value);$('ton').max=u.cap;$('maxInfo').textContent=`Capacidad operativa: hasta ${u.cap} Tn · ${presentation}`;validate()}function validate(){const u=units.find(x=>x.name===vehSel.value),tn=+$('ton').value,valid=u&&tn>0&&tn<=u.cap;$('unitError').textContent=valid?'':`Introduce un volumen entre 0.1 y ${u.cap} Tn para ${u.name}.`;$('recalc').disabled=!valid;return valid}$('sacos').onclick=()=>{presentation='Sacos';$('sacos').classList.add('selected');$('granel').classList.remove('selected');vehicles()};$('granel').onclick=()=>{presentation='Granel';$('granel').classList.add('selected');$('sacos').classList.remove('selected');vehicles()};vehSel.onchange=validUnit;$('ton').oninput=validate;vehicles();$('recalc').onclick=()=>{if(validate()){updateCalculations();if(route)compareNearbyOrigins()}};$('apply').onclick=()=>{updateCalculations();if(route)compareNearbyOrigins()};
function effortEditImpact(km){
 const editor=window.GCEffortEditor;
 if(!editor?.modified?.())return {fuel:1,wear:1,operator:1,delta:0,valid:true};
 const rows=editor.rows(),original=editor.original?.()||[];
 const total=rows.reduce((n,r)=>n+(Number(r.km)||0),0);
 if(total>km+0.1)return {fuel:1,wear:1,operator:1,delta:0,valid:false};
 const factor={urbano:1.35,autopista_sin:1,autopista_con:1.10,pavimento_sin:1,pavimento_con:1.15,terraceria_sin:1.35,terraceria_con:2};
 const velocity={urbano:21,autopista_sin:57,autopista_con:38,pavimento_sin:50,pavimento_con:34,terraceria_sin:17,terraceria_con:7};
 const weigh=(items,scale)=>items.reduce((sum,r)=>sum+(Number(r.km)||0)*(scale[r.id]||1),0);
 const delta=weigh(rows,factor)-weigh(original,factor);
 const timeDelta=rows.reduce((sum,r)=>sum+(Number(r.km)||0)/(velocity[r.id]||57),0)-original.reduce((sum,r)=>sum+(Number(r.km)||0)/(velocity[r.id]||57),0);
 return {fuel:Math.max(.6,1+.24*delta/Math.max(km,.1)),wear:Math.max(.6,1+.45*delta/Math.max(km,.1)),operator:Math.max(.6,1+.25*timeDelta/Math.max(km/57,.1)),delta,valid:true};
}
function input(id){return Math.max(0,Number($(id).value)||0)}function gcCarrierFactor(){const t=document.getElementById('tipoTransportista')?.value||'mediano';const id=t==='chico'?'factorChico':t==='grande'?'factorGrande':'factorMediano';const x=Number(document.getElementById(id)?.value);return Number.isFinite(x)&&x>=0?Math.min(x,5):1;}
function updateCalculations(){
 if(!route||!validate())return;
 const u=units.find(x=>x.name===vehSel.value),km=route.km,ton=input('ton');
 const effort=effortAnalysis(terrainSamples,km),nom=nomPrecheck(u,ton),geoRows=window.GCEffortEditor?.rows?.()||[];
 let q;
 try{
  if(!window.GCIMT)throw Error('No se pudo cargar el motor único IMT–GeoRisk.');
  q=window.GCIMT.fromApp(route,terrainSamples,geoRows);
  window.geocostIMTQuote=q;window.dispatchEvent(new CustomEvent('geocoast:quote',{detail:{q,route,dest:selectedDest,site:selectedSite,unit:u.name,granel:presentation==='Granel'}}));
  //window.dispatchEvent(new CustomEvent('geocoast:quote',{detail:{q,route,dest:selectedDest,site:selectedSite,unit:u.name,granel:presentation==='Granel'}}));
  $('costOutput').innerHTML=window.GCIMT.render(q);
  $('floatTitle').textContent=`${MX(q.tariff)} · ${u.name} · C`;
  $('floatSub').textContent=`${N(q.kmTotal)} km del ciclo · ${MX(q.tariff/ton)}/Tn · utilidad ${N(q.utility*100)}%`;
 }catch(error){
  window.geocostIMTQuote=null;
  $('costOutput').innerHTML=`<p class="error">No se pudo calcular el modelo IMT–GeoRisk: ${escapeHtml(error.message)}. No se mostrará una tarifa calculada por otro método.</p>`;
  $('floatTitle').textContent='Cotización no disponible';$('floatSub').textContent='Revisa los datos de ruta y unidad.';
 }
 const high=effort.high??null,climb=effort.ascent||0;
 $('summary').innerHTML=`<div class="metricgrid"><div class="metric"><small>Ruta de ida</small><b>${N(km)} km</b></div><div class="metric"><small>Recorrido de ida y regreso</small><b>${N(km*2)} km</b></div><div class="metric"><small>Altitud máxima</small><b>${high===null?'Pendiente':N(high)+' m'}</b></div><div class="metric"><small>Ascenso muestreado</small><b>${high===null?'Sin datos':N(climb)+' m'}</b></div><div class="metric"><small>Esfuerzo logístico</small><b>${effort.available?escapeHtml(effort.effortLevel):'Pendiente'}</b></div><div class="metric"><small>NOM-012</small><b>Pendiente validar</b></div></div><p class="hint"><b>Prevalidación NOM-012:</b> ${escapeHtml(nom.reason)}. No equivale a autorización vial.</p>${geoBreakdown(effort,km)}${geoRiskIRAHtml()}<b>Rutas viales alternativas (sin certificación NOM-012)</b>${lastRouted.map(r=>`<div class="site"><div><strong>Ruta ${r.index+1}${r.index===0?' · principal':''}</strong><small>${N(r.km)} km · ${N(Math.max(r.h,r.km/80))} h</small></div><button onclick="selectRoute(${r.index})">Usar</button></div>`).join('')}`;
}
let routeAnalysisToken=0;
async function activateSelectedRoute(selected,{reuseElevation=false}={}){
 const token=++routeAnalysisToken;
 route=selected;document.dispatchEvent(new Event('geocoast:route-selected'));renderSelectableRoutes(selected.index);void window.GCFuel?.refreshRoute?.(selected);for(const id of ['p-resumen','p-costos','p-bodegas','effort-editor-panel']){const element=document.getElementById(id);if(element)element.hidden=false;}
window.GCEffortEditor?.automatic(selected.geoRiskEfforts,selected.km);
 // Mostrar esfuerzos preliminares de inmediato. La consulta OSM actualiza despues.
 if(!selected.geoRiskEfforts&&window.GeoRiskEfforts?.analyze){
   try{
     const preliminary=await window.GeoRiskEfforts.analyze(selected,null,{skipOSM:true});
     if(token!==routeAnalysisToken)return;
     if(preliminary){selected.geoRiskEfforts=preliminary;window.GCEffortEditor?.automatic(preliminary,selected.km);}
   }catch(error){console.warn('Esfuerzos preliminares:',error);}
 }
 terrainSamples=selected.terrainCache||null;
 heatLayer.clearLayers();map.fitBounds(L.latLngBounds(selected.coords).pad(.08));
 updateCalculations();
 setStatus(`Ruta ${selected.index+1} seleccionada · ${N(selected.km)} km · consultando evidencia vial y relieve…`);
 // Ejecutar ambas consultas en paralelo. Una fuente caída no bloquea la otra.
 const elevationPromise=terrainSamples?Promise.resolve(terrainSamples):elevations(selected.coords);
 const roadsPromise=window.GeoRiskEfforts?.analyze(selected,null);
 // La altimetría nunca debe esperar a Overpass, ni viceversa.
 const onElevation=Promise.resolve(elevationPromise).then(async samples=>{
  if(token!==routeAnalysisToken)return;
  terrainSamples=samples||null;selected.terrainCache=terrainSamples;
  drawHeat();updateCalculations();
  // Si la evidencia OSM llegó antes, recalcular con el perfil disponible.
  if(selected.geoRiskEfforts&&selected.geoRiskEfforts.evidenceStatus==='consulta completada'&&terrainSamples?.length>1){
   const refreshed=await window.GeoRiskEfforts?.analyze(selected,terrainSamples,{reuseEvidence:true});
   if(token===routeAnalysisToken&&refreshed){selected.geoRiskEfforts=refreshed;window.GCEffortEditor?.automatic(refreshed,selected.km);updateCalculations();}
  }
 }).catch(e=>console.warn('Relieve:',e));
 const onRoads=Promise.resolve(roadsPromise).then(async data=>{
  if(token!==routeAnalysisToken)return;
  if(data){selected.geoRiskEfforts=data;window.GCEffortEditor?.automatic(data,selected.km);updateCalculations();}
  // Esperar sólo al perfil en curso; la actualización provisional ya se mostró.
  await onElevation;
  if(token!==routeAnalysisToken)return;
  if(data&&terrainSamples?.length>1){
   const refreshed=await window.GeoRiskEfforts?.analyze(selected,terrainSamples,{reuseEvidence:true});
   if(token===routeAnalysisToken&&refreshed){selected.geoRiskEfforts=refreshed;window.GCEffortEditor?.automatic(refreshed,selected.km);updateCalculations();}
  }
 }).catch(e=>console.warn('Vialidad:',e));
 await Promise.allSettled([onElevation,onRoads]);
 if(token!==routeAnalysisToken)return;
 const diagnostic=selected.geoRiskEfforts?.evidenceError;
 setStatus(`Ruta ${selected.index+1} · ${N(selected.km)} km · ${diagnostic?'evidencia OSM parcial: '+diagnostic:'desglose recalculado'}${!terrainSamples?' · elevación no disponible':''}`);
}

window.selectRoute=i=>{const selected=lastRouted.find(x=>x.index===i);if(selected)void activateSelectedRoute(selected);};
for(const id of ['tipoTransportista','factorChico','factorMediano','factorGrande'])document.getElementById(id)?.addEventListener('change',()=>{if(route)updateCalculations()});

if($('showResults'))$('showResults').onclick=()=>{panel('costos',true);panel('resumen',true)};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('active',n===b));const tab=b.dataset.tab;if(tab==='frentes')panel('ruta',true);if(tab==='comparar')if(tab==='reporte'){panel('costos',true);if(route)window.print();else alert('Primero traza una ruta para generar un reporte.')}if(tab==='cot')panel('ruta',true)});

// Cotizaciones de bodegas cercanas: se identifican por distancia geográfica,
// pero se comparan SOLO con distancias y tiempos de rutas viales efectivamente consultadas.
function estimateOriginQuote(r,eff){
 try{const q=window.GCIMT.fromApp(r,r.terrainCache||null,(r.geoRiskEfforts?.rows||[]).map(x=>({id:x.id,km:x.meters/1000})),{type:vehSel.value,includeManualCosts:r===route});
  return {cost:q.cost,tariff:q.tariff,vdu:q.journeyHours?input('workday')/q.journeyHours:0,time:q.journeyHours,eff,items:q.variable,imtQuote:q};
 }catch(err){console.warn('IMT alternativo:',err.message);return {cost:NaN,tariff:NaN,vdu:0,time:0,eff,error:err.message};}
}
async function sampleOriginEffort(coords,km){
 try{const ax=axisRoute(coords),pts=Array.from({length:28},(_,i)=>pointOnAxis(ax,ax.total*i/27));
 const url=`https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p=>p[0].toFixed(5)).join(',')}&longitude=${pts.map(p=>p[1].toFixed(5)).join(',')}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(8500)});if(!response.ok)throw Error('altimetría');
 const j=await response.json();if(!Array.isArray(j.elevation)||j.elevation.length!==pts.length)throw Error('elevaciones incompletas');
 return effortAnalysis(pts.map((p,i)=>({p,e:j.elevation[i]})),km);
 }catch{return effortAnalysis(null,km)}
}
async function compareNearbyOrigins(){
 if(!selectedDest||!validate()||!route)return;
 const request=++quoteRequest;
 const selection=findNearbySites(4);
 const origin=selectedSite,options=selection.items;
 const box=$('originQuoteResults');box.innerHTML='<p class="hint">Buscando hasta cuatro orígenes físicos cercanos al destino (radio progresivo ${selection.radius} km) y consultando sus rutas viales…</p>';
 const results=await Promise.all(options.map(async x=>{
  const a=x.site.ll,b=selectedDest.ll;
  try{
   const url=`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson&alternatives=false`;
   const response=await fetch(url,{signal:AbortSignal.timeout(14000)});
   const data=await response.json();if(data.code!=='Ok'||!data.routes?.[0])throw Error('sin ruta vial');
   const z=data.routes[0],r={km:z.distance/1000,h:z.duration/3600,coords:z.geometry.coordinates.map(c=>[c[1],c[0]])};
   const effort=await sampleOriginEffort(r.coords,r.km);
   const quote=estimateOriginQuote(r,effort);return {...x,route:r,quote,ok:Number.isFinite(quote.tariff)};
  }catch{return {...x,ok:false}}
 }));
 if(request!==quoteRequest)return;
 originQuotes=results;
 const current=estimateOriginQuote(route,effortAnalysis(terrainSamples,route.km));
 if(!Number.isFinite(current.tariff)){box.textContent="Cotización no disponible con el motor único IMT–GeoRisk. Corrige los parámetros del vehículo.";return;}
 const valid=results.filter(x=>x.ok);const lowest=valid.length?Math.min(...valid.map(x=>x.quote.tariff)):null;
 const bad=results.filter(x=>!x.ok);
 box.innerHTML=`<div class="comparison-meta"><span><strong>${escapeHtml(selectedDest.nombre||'Destino seleccionado')}</strong> · ${N(input('ton'))} Tn · Integral ida y vuelta</span><span>Radio de búsqueda: ${selection.radius} km · ${options.length} alternativa(s) evaluadas · ${valid.length} con cotización</span></div>
 <table class="executive-table" aria-label="Comparativo ejecutivo de orígenes y costos">
 <thead><tr><th>Origen</th><th>Ruta (km)</th><th>Tiempo (h)</th><th>Esfuerzo</th><th>Tarifa (MXN)</th><th>$/Tn</th><th>ICO</th><th>Acción</th></tr></thead>
 <tbody><tr class="origin-current"><td><strong>${escapeHtml(origin.name)}</strong><span class="origin-tag">Principal</span></td><td>${N(route.km)}</td><td>${N(Math.max(route.h,route.km/80))}</td><td>${current.eff?.available?escapeHtml(current.eff.effortLevel):'Sin dato'}</td><td><strong>${MX(current.tariff)}</strong></td><td>${MX(current.tariff/input('ton'))}</td><td>${N(current.vdu)}</td><td><span class="selected-route">Actual</span></td></tr>`+
 valid.map((x,i)=>`<tr class="${x.quote.tariff===lowest?'best-route':''}"><td><strong>${escapeHtml(x.site.name)}</strong>${x.quote.tariff===lowest?'<span class="origin-tag recommended">Menor tarifa</span>':''}</td><td>${N(x.route.km)}</td><td>${N(Math.max(x.route.h,x.route.km/80))}</td><td>${x.quote.eff.available?escapeHtml(x.quote.eff.effortLevel):'Sin dato'}</td><td><strong>${MX(x.quote.tariff)}</strong></td><td>${MX(x.quote.tariff/input('ton'))}</td><td>${N(x.quote.vdu)}</td><td><button class="route-action" onclick="selectOriginQuote(${x.site.idx})">Ver ruta</button></td></tr>`).join('')+
 bad.map(x=>`<tr class="unavailable-route"><td><strong>${escapeHtml(x.site.name)}</strong></td><td colspan="6">No se obtuvo ruta vial; sin cotización verificable</td><td>—</td></tr>`).join('')+
 `</tbody></table><div class="comparison-footnote">Tarifas estimadas con parámetros de prueba. ICO = Índice de Capacidad Operativa. El filtro inicial utiliza distancia geográfica; los kilómetros mostrados corresponden a rutas por carretera. Alternativas IMT sin evidencia vial GeoRisk completa: sólo costos base, pendientes por validar. Peajes manuales, inventario y NOM-012 pendientes de validar.</div>`;
 
}
window.selectOriginQuote=idx=>{
 const candidate=originQuotes.find(x=>x.site.idx===idx&&x.ok);if(!candidate)return;
 selectedSite=candidate.site;$('origen').value=candidate.site.name;
 routeAnalysisToken++;lastRouted=[{...candidate.route,index:0,raw:{legs:[]}}];
 routingLayer.clearLayers();renderSelectableRoutes(0);
 void activateSelectedRoute(lastRouted[0]);
 // Route already calculated during comparison; no redundant OSRM request.
};

Object.defineProperties(window,{bodegas:{get:()=>bodegas},frentes:{get:()=>frentes},route:{get:()=>route},map:{get:()=>map}});

window.geocostReportData=()=>({route,selectedSite,selectedDest,originQuotes,units,terrainSamples,effort:route?effortAnalysis(terrainSamples,route.km):null,presentation,connection:document.getElementById('conexion').value});

// V22: buscadores universales, combinan CEMEX y frentes sin modo manual.
(function(){
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const entries=kind=>kind==='origen'?[...bodegas.map(x=>({item:x,text:x.name,kind:'site'}))]:[
  ...bodegas.map(x=>({item:x,text:x.name+' · CEMEX',kind:'site'})),
  ...frentes.map(x=>({item:x,text:x.nombre+' · '+x.cemex_id,kind:'front'}))
 ];
 for(const kind of ['origen','destino']){
   const inputEl=$(kind),box=$(kind+'Suggestions');
   function hide(){box.hidden=true;box.replaceChildren()}
   inputEl.addEventListener('input',()=>{
     const q=normalize(inputEl.value);if(q.length<2){hide();return}
     const found=entries(kind).filter(e=>normalize(e.text).includes(q)).slice(0,10);
     box.replaceChildren();
     for(const entry of found){const b=document.createElement('button');b.type='button';b.className='search-option';b.textContent=entry.text;
       b.onclick=()=>{if(kind==='origen'){selectedSite=entry.item;inputEl.value=entry.item.name}
       else if(entry.kind==='site'){selectedDest={...entry.item,nombre:entry.item.name,cemex_id:'CEMEX',isWarehouse:true};inputEl.value=entry.item.name}
       else{selectedDest=entry.item;inputEl.value=entry.item.nombre+' · '+entry.item.cemex_id}
       hide();setStatus(kind==='origen'?'Origen seleccionado':'Destino seleccionado; presiona Calcular ruta y cotizar');};box.appendChild(b)}
     box.hidden=!found.length;
   });
   inputEl.addEventListener('blur',()=>setTimeout(hide,160));
   inputEl.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(e.key==='Enter'&&!box.hidden){e.preventDefault();box.querySelector('button')?.click()}});
 }
})();



window.addEventListener('effort:changed',()=>{if(route)updateCalculations()});


// Reactividad del motor IMT cuando se edita vehículo, antigüedad, rendimiento y costos.
document.addEventListener('DOMContentLoaded',()=>window.GCIMT?.prepare?.());
document.addEventListener('geocoast:imt-edit',()=>{if(route)updateCalculations();});
