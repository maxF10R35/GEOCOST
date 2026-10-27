const $=id=>document.getElementById(id); const MX=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);const N=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);
const units=[{name:'Camioneta',cap:5,kml:7.5},{name:'Rabón',cap:9,kml:3.6},{name:'Torton',cap:18,kml:3.0},{name:'Tráiler',cap:28,kml:2.5},{name:'Full',cap:50,kml:1.65}];let nearbySelection=null;let originQuotes=[],quoteRequest=0,frentes=[],bodegas=[],selectedDest=null,selectedSite=null,route=null,heat=false,presentation='Sacos',lastRouted=[],mapsites=[],terrainSamples=null;
const map=L.map('map',{zoomControl:false}).setView([19.3,-99],7);window.map=map;L.control.zoom({position:'bottomright'}).addTo(map);
const layers={calles:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}),satelite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagery © Esri'}),relieve:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenTopoMap, OpenStreetMap'})};layers.calles.addTo(map);let basemap='calles',siteLayer=L.layerGroup().addTo(map),routingLayer=L.layerGroup().addTo(map),heatLayer=L.layerGroup().addTo(map),extraLayer=L.layerGroup().addTo(map);
function setStatus(s){$('mapStatus').textContent=s};function panel(name,force){const e=$('p-'+name); if(!e) return; const show=force===undefined?e.classList.contains('hidden'):force; e.classList.toggle('hidden',!show)}document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>panel(b.dataset.close,false)); if($('hideAll')) $('hideAll').onclick=()=>{};
function base(which){layers[basemap].remove();basemap=which;layers[which].addTo(map);document.querySelectorAll('[data-base]').forEach(b=>b.classList.toggle('selected',b.dataset.base===which));$('baseSelect').value=which}document.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>base(b.dataset.base));$('baseSelect').onchange=e=>base(e.target.value);
function iraSwitch(v){heat=v;$('heatCheck').checked=v;$('heatToggle').classList.toggle('enabled',v);$('heatToggle').querySelector('span').textContent=v?'ON':'OFF';$('heatToggle').querySelector('span').style.color=v?'#168558':'';$('mapStatus').textContent=v?'Calculando IRA relativo de la ruta…':'IRA desactivado · ruta azul uniforme.';$('mapStatus').title='Bandas relativas de GeoRisk V112; elevación Open-Meteo';$('heatToggle').title='Bandas IRA relativas de GeoRisk V112(9); diferencias posibles en fuente de altitud';$('heatToggle').style.borderColor=v?'#0a70b9':'';drawHeat()};$('heatCheck').onchange=e=>iraSwitch(e.target.checked);$('heatToggle').onclick=()=>iraSwitch(!heat);$('showSites').onchange=e=>e.target.checked?siteLayer.addTo(map):siteLayer.remove();$('showRoutes').onchange=e=>e.target.checked?routingLayer.addTo(map):routingLayer.remove();
function paintSites(){siteLayer.clearLayers();mapsites=[];bodegas.forEach(s=>{let marker=L.circleMarker(s.ll,{radius:5,weight:1.7,color:'#fff',fillColor:'#006eb7',fillOpacity:.95});marker.bindPopup(`<b>${escapeHtml(s.name)}</b><br>${escapeHtml(s.type)}<br><button onclick="chooseSite(${s.idx})">Usar como origen</button>`);siteLayer.addLayer(marker);mapsites.push(marker)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function decorateSiteName(name,type=''){
 const clean=String(name||'').trim();
 const typeNorm=String(type||'').toLowerCase();
 if(!clean)return clean;
 if(/^(pta\.|cedis|cadis)\s/i.test(clean))return clean;
 if(/planta/i.test(typeNorm))return clean;
 if(/concreto/i.test(typeNorm))return `CADIS ${clean}`;
 if(/bodega|unidad|terminal|centro/i.test(typeNorm))return `CEDIS ${clean}`;
 return clean;
}
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

async function load(){try{const [fs,bs]=await Promise.all([fetch('data/frentes.json').then(r=>r.json()),fetch('data/bodegas.json').then(r=>r.json())]);frentes=fs.filter(f=>Number.isFinite(+f.lat)&&Number.isFinite(+f.lng)).map((f,i)=>({...f,idx:i,ll:[+f.lat,+f.lng]}));bodegas=bs.filter(b=>Array.isArray(b[1])&&b[1].length===2).map((b,i)=>({name:decorateSiteName(b[0],b[2]),baseName:b[0],ll:b[1],type:b[2],idx:i}));window.bodegas=bodegas;window.frentes=frentes;document.dispatchEvent(new CustomEvent('geocoast:catalog-loaded',{detail:{sites:bodegas.length,clients:frentes.length}}));$('bodegaList').innerHTML=bodegas.slice(0,45).map(s=>`<option value="${escapeHtml(s.name)}">`).join('');$('frenteList').innerHTML='';$('frontCount').textContent=`${frentes.length.toLocaleString('es-MX')} frentes y ${bodegas.length} ubicaciones CEMEX disponibles`;selectedSite=bodegas.find(s=>s.name.toLowerCase().includes('vallejo'))||bodegas[0];$('origen').value=selectedSite.name;paintSites();siteLayer.remove();setStatus('Catálogos cargados · Selecciona un origen y destino')}catch(e){setStatus('Error al cargar catálogos. Ejecuta con un servidor local (no file://).')}}load();
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
window.chooseSite=i=>{selectedSite=bodegas[i];$('origen').value=selectedSite.name;panel('ruta',true);if(selectedDest)goRoute()};map.on('click',e=>{if(window.GCStationClusters?.isPickingCenter?.())return;selectedDest={nombre:'Punto seleccionado',ll:[e.latlng.lat,e.latlng.lng]};$('destino').value=`Punto: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;panel('ruta',true);setStatus('Punto de destino fijado · Pulsa Trazar y cotizar')});$('destino').addEventListener('change',()=>{const f=findFront();if(f)selectedDest=f});$('origen').addEventListener('change',()=>{const s=findSite();if(s)selectedSite=s});$('swap').onclick=()=>{alert('Para invertir la operación, selecciona un nuevo origen del catálogo y un destino válido.');};
function dist(a,b){const r=Math.PI/180,p1=a[0]*r,p2=b[0]*r,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dlon/2)**2))}
// Selección por radio progresivo desde el frente destino, nunca desde el origen.
// El radio sólo preselecciona; la prioridad comercial usa km viales comprobados.
const RADII_KM=[25,50,100,150,250,400,650,1000];
function eligibleOrigin(s){return !/virtual|nombre interno|unidad estratégica|centro\s*\/\s*terminal interna/i.test(s.type||'') && !(s.officialId && /agregados|concreto/i.test(s.type||''))}
function findNearbySites(maxResults=4){
 if(!selectedDest)return {items:[],radius:null,total:0};
 const origin=findSite()||selectedSite,seen=new Set();
 const pool=bodegas.filter(site=>eligibleOrigin(site)&&(!origin||site.idx!==origin.idx)&&dist(site.ll,selectedDest.ll)>.1)
  .map(site=>({site,linear:dist(site.ll,selectedDest.ll)})).sort((a,b)=>a.linear-b.linear)
  .filter(x=>{const key=x.site.ll.map(v=>v.toFixed(4)).join(',');if(seen.has(key))return false;seen.add(key);return true;});
 if(!pool.length)return {items:[],radius:null,total:0,available:0};
 let radius=RADII_KM.find(r=>pool.filter(x=>x.linear<=r).length>=Math.min(maxResults,pool.length));
 if(radius===undefined){const farthest=pool[Math.min(maxResults,pool.length)-1].linear;radius=Math.ceil(farthest/50)*50||50;}
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
function gcRoutingProfile(){
 // Se calcula automáticamente desde la UN seleccionada; sin inputs ni valores fingidos.
 const type=$('vehiculo')?.value||'Rabón';
 return window.GCRouteCompliance.profileForUnit(type);
}
function gcRouteMode(){return 'public'} // Rutas viales públicas sin token; no confundir con autorización para carga.
function gcPrevalidate(r){const check=window.GCRouteCompliance?.evaluate?.(gcRoutingProfile(),r?.segments||[])||{status:'PENDING',blocked:[],pending:['Motor de validación no disponible']};if(r?.routedAxles&&r.routedAxles!==gcRoutingProfile().axles){check.pending.push('La ruta fue calculada para otro número de ejes: recalcular');check.status='PENDING';}return check;}
$('vehiculo')?.addEventListener('change',()=>{if(route)setStatus('El vehículo cambió: vuelve a calcular la ruta y valida limitaciones locales para esta unidad.');});
// V4: el error de una cotización o de una fuente secundaria jamás borra una ruta vial válida.
let routingRun=0,routeBusy=false;
async function goRoute(event){
 event?.preventDefault?.();
 // Evita solicitudes dobles y trabajos paralelos iniciados por el mismo clic.
 if(routeBusy){setStatus('La ruta ya se está consultando; conserva el origen y destino actuales.');return;}
 const run=++routingRun;document.dispatchEvent(new Event('geocoast:route-start'));
 quoteRequest++;activeComparison=null;originQuotes=[];
 selectedSite=findSite();selectedDest=findFront()||selectedDest;
 if(selectedSite&&selectedDest&&dist(selectedSite.ll,selectedDest.ll)<.05){setStatus('Selecciona un origen distinto del destino.');return;}
 if(!selectedSite||!selectedDest){panel('ruta',true);setStatus(!selectedSite?'Origen no geolocalizado: elige una bodega válida.':'Selecciona un destino con coordenadas.');return;}
 if(!validate()){panel('unidad',true);return;}
 const start=selectedSite.ll,end=selectedDest.ll;
 routeBusy=true;const button=$('draw');if(button){button.disabled=true;button.textContent='Consultando ruta…';}
 setStatus('Consultando una ruta por carretera…');
 let candidates;
 try{
  // Motor de geometría abierta: no requiere credenciales. Es un trazado vial
  // preliminar, NO un ruteo certificado para vehículos pesados / NOM-012.
  const maxSpeed=gcRoutingProfile().planningSpeedKmh||65;
  const url=`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  const response=await fetch(url,{signal:AbortSignal.timeout(22000)});
  if(!response.ok)throw Error('Ruteo por carretera: HTTP '+response.status);
  const data=await response.json();
  if(data.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)throw Error('No se obtuvo trazado por carretera entre origen y destino');
  candidates=data.routes.slice(0,3).map((r,i)=>({
    km:r.distance/1000,h:Math.max(r.duration/3600,(r.distance/1000)/Math.max(15,maxSpeed)),
    coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),index:i,raw:r,
    routeKind:i?'Alternativa vial':'Ruta vial de referencia',
    routingSource:'OSRM / OSM · trazo orientativo, restricciones de carga sin validar',
    routingVerifiedForTruck:false,truckCompliance:'PENDING',
    policyMaxSpeed:maxSpeed,segments:[],tollStatus:'pending',tollsOneWay:0,
    routingWarnings:['No se han verificado gálibos, PBV, NOM-012, horario ni restricciones por tramo.']
  }));
  if(candidates.some(r=>!(r.km>0)||!Number.isFinite(r.km)||r.coords.length<2))throw Error('Geometría de carretera incompleta');
  for(const r of candidates){const geometryKm=(r.coords||[]).slice(1).reduce((sum,point,j)=>sum+dist(r.coords[j],point),0);r.geometryKm=geometryKm;r.distanceQuality=Math.abs(geometryKm-r.km)/Math.max(.001,r.km)>.12?'Geometría y distancia de la fuente difieren más de 12%; revisar trazado.':'Consistente';}
 }catch(error){
  if(run===routingRun){setStatus('No se obtuvo ruta nueva: '+String(error.message||error)+'. Conservamos la última cotización, si existe.');if(!route){$('summary').innerHTML='<p class="error">Servicio vial no disponible. Intenta otra vez; no se usarán distancias en línea recta.</p>';panel('resumen',true);}}
  return;
 }finally{routeBusy=false;if(button){button.disabled=false;button.textContent='Calcular ruta y cotizar';}}
 if(run!==routingRun)return;
 // Se reemplaza la ruta únicamente después de haber recibido geometría vial válida.
 lastRouted=candidates;
 try{
  routingLayer.clearLayers();extraLayer.clearLayers();heatLayer.clearLayers();
  map.fitBounds(L.latLngBounds(start,end).pad(.22));
  L.marker(start).addTo(extraLayer).bindPopup('Origen: '+escapeHtml(selectedSite.name));
  L.marker(end).addTo(extraLayer).bindPopup('Destino: '+escapeHtml(selectedDest.nombre||selectedDest.name));
  renderSelectableRoutes(0);route=lastRouted[0];terrainSamples=null;
  panel('resumen',true);panel('costos',true);
  activateSelectedRoute(route);
 }catch(error){
  // No eliminar route ni lastRouted; el usuario puede reintentar analizar la ruta recibida.
  console.error('GeoCoast: error al representar/cotizar ruta',error);
  route=route||lastRouted[0];panel('resumen',true);panel('costos',true);
  setStatus('La carretera fue calculada, pero falló el análisis: '+String(error.message||error));
  $('costOutput').innerHTML='<p class="error">No se pudo completar la cotización. Verifica datos y utiliza Calcular de nuevo. La ruta se conserva.</p>';
 }
}
$('draw').type='button';$('draw').onclick=event=>{void goRoute(event)};
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
function nomPrecheck(unit,tons){const check=gcPrevalidate(route),src=route?.routingSource||'Origen de ruta no confirmado',detail=check.blocked.length?check.blocked.join('; '):check.pending.slice(0,4).join('; ');
 return {status:check.status,reason:`${unit.name}, ${N(tons)} Tn de carga. Fuente: ${src}. ${detail}. Falta verificar restricciones locales, horarios, PBV, dimensiones y permisos por tramo. Esta prevalidación NO equivale a una autorización NOM-012.`};}

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

const vehSel=$('vehiculo');
function vehicles(){
  const allowed=units.filter(u=>presentation==='Granel'?['Tráiler','Full'].includes(u.name):u.name!=='Full');
  const previous=vehSel.value;
  vehSel.innerHTML=allowed.map(u=>`<option value="${u.name}">${u.name} · ${u.cap} Tn</option>`).join('');
  vehSel.value=allowed.some(u=>u.name===previous)?previous:(presentation==='Granel'?'Tráiler':'Rabón');
  vehSel.dispatchEvent(new Event('change'));
}
function validUnit(){
  const u=units.find(x=>x.name===vehSel.value);
  if(!u){$('unitError').textContent='Selecciona una unidad compatible con '+presentation+'.';$('recalc').disabled=true;return false;}
  $('ton').value=String(u.cap); // lote óptimo interno; sin captura de demanda/carga
  $('maxInfo').textContent=`Lote óptimo: ${u.cap} Tn · ${presentation} · ${window.GCRouteCompliance?.AXLE_HINT?.[u.name]||'—'} ejes automáticos`;
  return validate();
}
function validate(){
  const u=units.find(x=>x.name===vehSel.value),tn=Number($('ton').value);
  const valid=Boolean(u&&tn===u.cap&&tn>0);
  $('unitError').textContent=valid?'':'La cotización debe utilizar el lote óptimo de la unidad.';
  $('recalc').disabled=!valid;
  return valid;
}
$('sacos').onclick=()=>{presentation='Sacos';$('sacos').classList.add('selected');$('granel').classList.remove('selected');vehicles()};
$('granel').onclick=()=>{presentation='Granel';$('granel').classList.add('selected');$('sacos').classList.remove('selected');vehicles()};
vehSel.onchange=validUnit;vehicles();
$('recalc').onclick=()=>{if(validate()){updateCalculations();if(route)paintOriginComparisons()}};
$('apply').onclick=()=>{if(validate()){updateCalculations();if(route)paintOriginComparisons()}};
function input(id){return Math.max(0,Number($(id).value)||0)}function gcCarrierFactor(){const t=document.getElementById('tipoTransportista')?.value||'mediano';const id=t==='chico'?'factorChico':t==='grande'?'factorGrande':'factorMediano';const x=Number(document.getElementById(id)?.value);return Number.isFinite(x)&&x>=0?Math.min(x,5):1;}
function physicalSummaryHtml(physical,km){
 if(!physical)return `<section class="gc-physical-summary"><h4>Superficie y pendientes · análisis propio de GeoCoast</h4><p class="hint">Clasificación vial automática en curso. Las correcciones físicas se realizan en Configurar costos.</p></section>`;
 const type={urbano:'Urbano',autopista_sin:'Autopista',autopista_con:'Autopista con pendiente',pavimento_sin:'Pavimento',pavimento_con:'Pavimento con pendiente',terraceria_sin:'Terracería',terraceria_con:'Terracería con pendiente'};
 const rows=(physical.rows||[]).filter(x=>Number(x.km)>0.01).sort((a,b)=>b.km-a.km);
 const coverage=km>0?Math.max(0,Math.min(100,100*Number(physical.classifiedKm||0)/km)):0;
 const top=rows.slice(0,4).map(x=>`<div class="gc-road-line"><span>${escapeHtml(type[x.id]||x.id)}</span><strong>${N(x.km)} km</strong></div>`).join('');
 return `<section class="gc-physical-summary"><h4>Superficie y pendientes · análisis propio</h4><div class="gc-road-line"><span>Vialidad identificada (${escapeHtml(physical.dataSource||'OSM')})</span><strong>${coverage.toFixed(0)}%</strong></div>${top}<div class="gc-road-line"><span>Coincidencia RNC</span><strong>${N(physical.rncKm||0)} km</strong></div><div class="gc-road-line"><span>Respaldo OSM</span><strong>${N(physical.osmKm||0)} km</strong></div>${physical.unspecifiedUrbanKm>0.1?`<p class="hint">${N(physical.unspecifiedUrbanKm)} km urbanos sin recubrimiento certificado en la RNC.</p>`:''}<div class="gc-road-line"><span>Sin clasificación confirmada</span><strong>${N(physical.unknownKm||0)} km</strong></div><p class="hint">Pendiente y superficie modifican directamente consumo, tiempo y desgaste. Para corregir km utiliza Configurar costos → Tipo de camino y pendiente. El costo deriva de la ruta y los parámetros de la unidad.</p></section>`;
}
function updateCalculations(){
 if(!route||!validate())return;
 const u=units.find(x=>x.name===vehSel.value),km=route.km,ton=input('ton');
 const effort=effortAnalysis(terrainSamples,km),nom=nomPrecheck(u,ton),physical=window.GCPhysicsEditor?.get?.(route)||route.roadPhysics,geoRows=physical?.rows||[];
 let q;
 try{
  if(!window.GCIMT)throw Error('No se pudo cargar el modelo GeoCoast–IMT.');
  q=window.GCIMT.fromApp(route,terrainSamples,geoRows,{roadRows:geoRows,ascent:physical?.ascent,descent:physical?.descent});
  window.geocostIMTQuote=q;window.dispatchEvent(new CustomEvent('geocoast:quote',{detail:{q,route,dest:selectedDest,site:selectedSite,unit:u.name,granel:presentation==='Granel'}}));
  $('costOutput').innerHTML=window.GCIMT.render(q);
  $('floatTitle').textContent=`${MX(q.tariff)} · ${u.name}`;
  $('floatSub').textContent=`${N(q.kmTotal)} km del ciclo · ${MX(q.tariff/ton)}/Tn · utilidad ${N(q.utility*100)}%`;
 }catch(error){
  window.geocostIMTQuote=null;
  $('costOutput').innerHTML=`<p class="error">No se pudo calcular el modelo físico GeoCoast–IMT: ${escapeHtml(error.message)}. No se mostrará una tarifa calculada por otro método.</p>`;
  $('floatTitle').textContent='Cotización no disponible';$('floatSub').textContent='Revisa los datos de ruta y unidad.';
 }
 const high=effort.high??null,climb=effort.ascent||0;
 $('summary').innerHTML=`<div class="metricgrid"><div class="metric"><small>Ruta de ida</small><b>${N(km)} km</b></div><div class="metric"><small>Recorrido de ida y regreso</small><b>${N(km*2)} km</b></div><div class="metric"><small>Altitud máxima</small><b>${high===null?'Pendiente':N(high)+' m'}</b></div><div class="metric"><small>Ascenso muestreado</small><b>${high===null?'Sin datos':N(climb)+' m'}</b></div><div class="metric"><small>Tipo de vía (RNC / OSM)</small><b>${physical?.classifiedKm!=null?N(100*physical.classifiedKm/km)+'% evaluado':'Analizando'}</b></div><div class="metric"><small>NOM-012</small><b>${escapeHtml(nom.status)}</b></div></div><p class="hint"><b>Prevalidación NOM-012:</b> ${escapeHtml(nom.reason)}. No equivale a autorización vial.</p>${physicalSummaryHtml(physical,km)}${geoRiskIRAHtml()}<b>Rutas viales candidatas · ${escapeHtml(route?.routingSource||"sin fuente")} · no autorizadas para despacho</b>${lastRouted.map(r=>`<div class="site"><div><strong>Ruta ${r.index+1}${r.index===0?' · principal':''}</strong><small>${N(r.km)} km · ${N(Math.max(r.h,r.km/80))} h · ${escapeHtml(r.routeKind||'referencial (no validada para carga)')}</small></div><button onclick="selectRoute(${r.index})">Usar</button></div>`).join('')}`;
 if(activeComparison&&activeComparison.request===quoteRequest)paintOriginComparisons();
}
let routeAnalysisToken=0;
function activateSelectedRoute(selected){
 const token=++routeAnalysisToken;
 quoteRequest++;activeComparison=null;originQuotes=[];
 route=selected;terrainSamples=selected.terrainCache||null;
 document.dispatchEvent(new Event('geocoast:route-selected'));
 renderSelectableRoutes(selected.index);
 for(const id of ['p-resumen','p-costos','p-bodegas']){const element=$(id);if(element)element.hidden=false;}
 map.fitBounds(L.latLngBounds(selected.coords).pad(.08));heatLayer.clearLayers();
 try{nearest();showNearbyPreview();updateCalculations();}catch(error){console.warn('Resumen inicial:',error);setStatus('Ruta válida; el resumen requiere recalcularse: '+error.message);}
 setStatus(`Ruta ${selected.index+1} · ${N(selected.km)} km · ${selected.routingVerifiedForTruck?"validación NOM-012 pendiente":"OSRM referencial, NO apta para despacho"} · analizando costos…`);
 // Es crucial que la comparación no espere a Overpass: las bodegas se muestran de inmediato.
 const fuelJob=Promise.resolve().then(()=>window.GCFuel?.refreshRoute?.(selected)).then(()=>{
  if(token!==routeAnalysisToken)return;
  selected.dieselPrice=window.GCFuel?.getPrice?.();
  updateCalculations();
  void compareNearbyOrigins();
 }).catch(e=>{
  if(token!==routeAnalysisToken)return;
  console.warn('Diésel estatal principal:',e);
  void compareNearbyOrigins(); // Comparativo con trazados abiertos
 });
 const altitudeJob=Promise.resolve(selected.terrainCache||elevations(selected.coords)).then(samples=>{
  if(token!==routeAnalysisToken)return;
  terrainSamples=samples||null;selected.terrainCache=terrainSamples;
  drawHeat();updateCalculations();
  if(terrainSamples){
   void Promise.resolve().then(()=>window.GCRoadPhysics?.analyze?.(selected,terrainSamples,{force:true})).then(()=>{
    if(token===routeAnalysisToken)updateCalculations();
   }).catch(e=>console.warn('Clasificación física con altimetría:',e));
  }
 }).catch(e=>console.warn('Elevación:',e));
 const physicsJob=Promise.resolve().then(()=>window.GCRoadPhysics?.analyze?.(selected,selected.terrainCache||null)).then(()=>{
  if(token===routeAnalysisToken)updateCalculations();
 }).catch(e=>console.warn('Clasificación vial propia GeoCoast:',e));
 // No await a fuentes OSM: el comparativo tiene ejecución y estado independientes.
 void Promise.allSettled([fuelJob,altitudeJob,physicsJob]).then(()=>{
  if(token!==routeAnalysisToken)return;
  setStatus(`Ruta ${selected.index+1} · ${N(selected.km)} km · costos y evidencia disponibles según cobertura de fuentes externas.`);
 });
}

window.selectRoute=i=>{const selected=lastRouted.find(x=>x.index===i);if(selected)void activateSelectedRoute(selected);};
for(const id of ['tipoTransportista','factorChico','factorMediano','factorGrande'])document.getElementById(id)?.addEventListener('change',()=>{if(route)updateCalculations()});

if($('showResults'))$('showResults').onclick=()=>{panel('costos',true);panel('resumen',true)};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('active',n===b));const tab=b.dataset.tab;if(tab==='frentes')panel('ruta',true);if(tab==='comparar')if(tab==='reporte'){panel('costos',true);if(route)window.print();else alert('Primero traza una ruta para generar un reporte.')}if(tab==='cot')panel('ruta',true)});

// Orígenes cercanos: vista inmediata, costos progresivos, y enriquecimiento de OSM/altitud
// desacoplado del render. Nunca utilizar km geográficos para calcular el flete.
let activeComparison=null;
function showNearbyPreview(){
 const box=$('originQuoteResults');if(!box||!selectedDest)return;
 const chosen=findNearbySites(4);
 box.innerHTML=`<div class="comparison-meta"><strong>Orígenes próximos a ${escapeHtml(selectedDest.nombre||'destino')}</strong><span>Radio de identificación: ${chosen.radius} km</span></div>`+
 (chosen.items.length?`<table class="executive-table"><thead><tr><th>Origen cercano</th><th>Distancia geográfica</th><th>Ruta vial</th><th>Cotización</th></tr></thead><tbody>`+
 chosen.items.map(x=>`<tr><td>${escapeHtml(x.site.name)}</td><td>${N(x.linear)} km</td><td>Por consultar</td><td>Esperando ruta principal</td></tr>`).join('')+'</tbody></table>':
 '<p class="hint">No hay bodegas adicionales geolocalizadas en el radio de búsqueda. Verifica las ubicaciones del catálogo.</p>')+
 '<p class="comparison-footnote">Distancia geográfica sólo para identificar candidatos. GeoCost calcula recorridos viales públicos independientes por origen, sin claves. No son rutas autorizadas para vehículos pesados; restricciones y horarios deben verificarse.</p>';
}
function estimateOriginQuote(r){
 try{
  const phys=window.GCPhysicsEditor?.get?.(r)||r.roadPhysics;
  const fuel=r===route?window.GCFuel?.getPrice?.():r.dieselPrice;
  if(!Number.isFinite(fuel)||fuel<10)throw Error('Precio diésel estatal pendiente');
  const q=window.GCIMT.fromApp(r,r.terrainCache||null,phys?.rows||[],{type:vehSel.value,includeManualCosts:r===route,dieselPrice:fuel,ascent:phys?.ascent,descent:phys?.descent,roadRows:phys?.rows||[],elevationAvailable:Boolean(r.terrainCache?.length>1)});
  return {cost:q.cost,tariff:q.tariff,vdu:q.journeyHours?input('workday')/q.journeyHours:0,time:q.journeyHours,imtQuote:q};
 }catch(err){return {cost:NaN,tariff:NaN,vdu:0,time:0,error:err?.message||String(err)};}
}
function paintOriginComparisons(){
 if(!activeComparison||!$('originQuoteResults')||!route)return;
 const {selection,mainOrigin,request}=activeComparison;
 if(request!==quoteRequest)return;
 const box=$('originQuoteResults'),chosen=originQuotes,current=estimateOriginQuote(route);
 const valid=chosen.filter(x=>x.ok&&Number.isFinite(estimateOriginQuote(x.route).tariff));
 const lowest=valid.length?Math.min(...valid.map(x=>estimateOriginQuote(x.route).tariff)):null;
 const mainStatus=Number.isFinite(current.tariff)?'Origen seleccionado':(current.error||'Diésel estatal pendiente');
 const quality=x=>!x.route?'Buscando ruta vial':x.status==='error'?(x.error||'Faltan datos de ruta'):!x.route.terrainCache?'Elevación pendiente':!x.route.roadPhysics?'Clasificación vial pendiente':`${Math.round(100*(x.route.roadPhysics.classifiedKm||0)/x.route.km)}% vía evaluada`;
 box.innerHTML=`<div class="comparison-meta"><span><strong>${escapeHtml(selectedDest?.nombre||'Destino')}</strong> · ${N(input('ton'))} Tn · ${escapeHtml(vehSel.value)} · ida y regreso</span><span>Radio ${selection.radius} km · ${chosen.length} orígenes cercanos</span></div>`+
 `<table class="executive-table" aria-label="Cotizaciones de bodegas cercanas"><thead><tr><th>Origen</th><th>Km ida</th><th>Horas ida</th><th>Evidencia</th><th>Tarifa estimada (MXN)</th><th>$/Tn</th><th>Acción</th></tr></thead><tbody>`+
 `<tr class="origin-current"><td><strong>${escapeHtml(mainOrigin?.name||'Principal')}</strong><span class="origin-tag">Actual</span></td><td>${N(route.km)}</td><td>${N(Math.max(route.h,route.km/80))}</td><td>${route.roadPhysics?Math.round(100*(route.roadPhysics.classifiedKm||0)/route.km)+'% vía evaluada':'Clasificación vial pendiente'}</td><td>${Number.isFinite(current.tariff)?'<strong>'+MX(current.tariff)+'</strong>':'Pendiente'}</td><td>${Number.isFinite(current.tariff)?MX(current.tariff/input('ton')):'—'}</td><td>${Number.isFinite(current.tariff)?'Seleccionado':escapeHtml(mainStatus)}</td></tr>`+
 chosen.map(x=>{
  if(!x.route){return `<tr class="${x.status==='error'?'unavailable-route':''}"><td><strong>${escapeHtml(x.site.name)}</strong><small>${N(x.linear)} km geográficos</small></td><td>—</td><td>—</td><td>${escapeHtml(x.error||'Consultando ruta vial…')}</td><td>—</td><td>—</td><td>${x.status==='error'?'Revisar origen':'Consultando…'}</td></tr>`;}
  const q=estimateOriginQuote(x.route);x.quote=q;x.ok=Number.isFinite(q.tariff);
  const best=x.ok&&lowest!==null&&Math.abs(q.tariff-lowest)<.001;
  return `<tr class="${best?'best-route':''}"><td><strong>${escapeHtml(x.site.name)}</strong>${best?'<span class="origin-tag recommended">Menor tarifa estimada</span>':''}</td><td>${N(x.route.km)}</td><td>${N(Math.max(x.route.h,x.route.km/80))}</td><td>${escapeHtml(quality(x))}</td><td>${x.ok?'<strong>'+MX(q.tariff)+'</strong>':'Pendiente'}</td><td>${x.ok?MX(q.tariff/input('ton')):'—'}</td><td>${x.ok?'<button class="route-action" onclick="selectOriginQuote('+x.site.idx+')">Ver ruta</button>':escapeHtml(q.error||'Sin cotización')}</td></tr>`;
 }).join('')+
 `</tbody></table><div class="comparison-footnote">Los orígenes se eligen por cercanía geográfica; <b>cada tarifa usa su propio trazado vial, diésel estatal ponderado y altimetría disponible</b>. El resultado puede recalcularse cuando se complete evidencia RNC / OSM. GeoCost consulta automáticamente casetas OSM y cruza tarifas CAPUFE; las plazas sin evidencia quedan pendientes. Las cotizaciones sin evidencia de peajes son preliminares, nunca equivalen a ruta gratuita. Una tarifa sin relieve o clasificación completa es preliminar y requiere validación.</div>`;
}
async function sampleOriginTerrain(coords){
 try{const ax=axisRoute(coords),pts=Array.from({length:28},(_,i)=>pointOnAxis(ax,ax.total*i/27));
  const url=`https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p=>p[0].toFixed(5)).join(',')}&longitude=${pts.map(p=>p[1].toFixed(5)).join(',')}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(8500)});if(!response.ok)throw Error('Sin altimetría');
  const j=await response.json();if(!Array.isArray(j.elevation)||j.elevation.length!==pts.length||j.elevation.some(v=>!Number.isFinite(v)))throw Error('Elevaciones incompletas');
  return pts.map((p,i)=>({p,e:j.elevation[i]}));
 }catch(error){console.warn('Perfil alternativo no disponible:',error);return null;}
}
async function compareNearbyOrigins(){
 if(!selectedDest||!route)return;
 const request=++quoteRequest;
 const selection=findNearbySites(4);
 const mainOrigin=selectedSite;
 originQuotes=selection.items.map(x=>({...x,status:'pending',ok:false,route:null,error:null}));
 activeComparison={request,selection,mainOrigin};
 paintOriginComparisons();
 if(!originQuotes.length)return;
 // La ruta vial abierta (referencial) y el precio de diésel son obligatorios; la altimetría y la clasificación RNC / OSM
 // enriquecen después sin dejar la interfaz en "Consultando" indefinidamente.
 // Máximo dos rutas cercanas consultándose al mismo tiempo, evitando saturación de navegador y servidor.
 async function quoteCandidate(x){
  const a=x.site.ll,b=selectedDest.ll;
  try{
   let r;
   // Alternos: geometría vial pública, nunca distancia en línea recta.
   const url=`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson&alternatives=false`;
   const response=await fetch(url,{signal:AbortSignal.timeout(16000)});
   if(!response.ok)throw Error('Motor vial HTTP '+response.status);
   const data=await response.json();if(data.code!=='Ok'||!data.routes?.[0])throw Error('No se obtuvo trazado por carretera');
   const z=data.routes[0];const speed=gcRoutingProfile().planningSpeedKmh||65;
   r={km:z.distance/1000,h:Math.max(z.duration/3600,z.distance/1000/speed),coords:z.geometry.coordinates.map(c=>[c[1],c[0]]),raw:z,routingSource:'OSRM · referencial sin validación de carga',routingVerifiedForTruck:false,truckCompliance:'PENDING',segments:[],tollsOneWay:0,tollStatus:'pending'};
   if(!Number.isFinite(r.km)||r.km<=0||r.coords.length<2)throw Error('Geometría vial inválida');
   if(request!==quoteRequest)return;
   x.route=r;x.status='diesel';paintOriginComparisons();
   let fuel;
   for(let attempt=0;attempt<4;attempt++){
    try{fuel=await window.GCFuel?.getForRoute?.(r);break;}
    catch(e){if(/aún no cargado|no cargado/i.test(e.message)&&attempt<3)await new Promise(resolve=>setTimeout(resolve,450));else throw e;}
   }
   if(!(fuel?.price>=10))throw Error('Sin precio estatal de diésel de este origen');
   r.dieselPrice=fuel.price;r.dieselInfo=fuel;
   if(request!==quoteRequest)return;
   x.status='priced';x.ok=Number.isFinite(estimateOriginQuote(r).tariff);paintOriginComparisons();
   // Elevación y superficie se procesan después de publicar la tarifa inicial;
   // jamás mantienen ocupada la cola de origenes cercanos.
   void (async()=>{
    try{
     r.terrainCache=await sampleOriginTerrain(r.coords);
     if(request!==quoteRequest)return;
     x.status='terrain';x.ok=Number.isFinite(estimateOriginQuote(r).tariff);paintOriginComparisons();
     await window.GCRoadPhysics?.analyze?.(r,r.terrainCache||null);
     if(request!==quoteRequest)return;
     x.status='done';x.ok=Number.isFinite(estimateOriginQuote(r).tariff);paintOriginComparisons();
    }catch(error){if(request!==quoteRequest)return;x.status='partial';x.error=String(error.message||error);paintOriginComparisons();}
   })();
  }catch(error){
   if(request!==quoteRequest)return;
   x.status='error';x.error=error?.message||'Consulta no disponible';x.ok=false;
   paintOriginComparisons();
  }
 }
 let next=0;
 const workers=Array.from({length:Math.min(2,originQuotes.length)},async()=>{
  while(next<originQuotes.length&&request===quoteRequest){const candidate=originQuotes[next++];await quoteCandidate(candidate);}
 });
 await Promise.allSettled(workers);
}
window.selectOriginQuote=idx=>{
 const candidate=originQuotes.find(x=>x.site.idx===idx&&x.ok);if(!candidate)return;
 selectedSite=candidate.site;$('origen').value=candidate.site.name;
 routeAnalysisToken++;lastRouted=[{...candidate.route,index:0,raw:{legs:[]}}];
 routingLayer.clearLayers();renderSelectableRoutes(0);
 void activateSelectedRoute(lastRouted[0]);
 // Reutilizar la geometría vial de referencia, sin otra consulta.
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






// Reactividad del motor IMT cuando se edita vehículo, antigüedad, rendimiento y costos.
document.addEventListener('DOMContentLoaded',()=>window.GCIMT?.prepare?.());
document.addEventListener('geocoast:imt-edit',()=>{if(route)updateCalculations();});
document.addEventListener('geocoast:physics-edit',()=>{if(route)updateCalculations();});
