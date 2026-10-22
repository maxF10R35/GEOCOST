/* GeoCost SC V6: top controls Clients / Bodegas independently toggle map layers. */
(function(){
 let clientsVisible=false, sitesVisible=false, clientsGroup=null, sitesGroup=null, ready=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cemexIcon=L.divIcon({className:'cemex-pin-wrap',html:'<span class="cemex-pin"><img src="assets/logo-cemex.svg" alt="CEMEX"></span>',iconSize:[33,33],iconAnchor:[16,31],popupAnchor:[0,-25]});
 function initialize(){if(ready)return true;if(!window.map||!Array.isArray(window.bodegas)||!window.bodegas.length||!Array.isArray(window.frentes))return false;
   ready=true;sitesGroup=L.layerGroup();window.bodegas.forEach(b=>{if(!b.ll)return;const m=L.marker(b.ll,{icon:cemexIcon,title:b.name});m.bindPopup('<strong>'+esc(b.name)+'</strong><br>'+esc(b.type||'Ubicación CEMEX')+'<br><button onclick="chooseSite('+b.idx+')">Seleccionar origen</button>');sitesGroup.addLayer(m)});
   clientsGroup=typeof L.markerClusterGroup==='function'?L.markerClusterGroup({chunkedLoading:true,chunkInterval:80,chunkDelay:30,showCoverageOnHover:false,maxClusterRadius:55,disableClusteringAtZoom:17}):L.layerGroup();
   const clientIcon=L.divIcon({className:'geocost-front-wrap',html:'<span class="geocost-front"></span>',iconSize:[12,12],iconAnchor:[6,6]});
   const markers=[];window.frentes.forEach(f=>{if(!f.ll)return;let m=L.marker(f.ll,{icon:clientIcon,title:f.nombre});m.bindPopup('<strong>'+esc(f.nombre)+'</strong><br>ID: '+esc(f.cemex_id||'')+'<br><button class="front-pick">Usar como destino</button>');m.on('popupopen',()=>{let btn=m.getPopup().getElement()?.querySelector('.front-pick');if(btn)btn.onclick=()=>{document.getElementById('destino').value=f.nombre+' · '+f.cemex_id;document.getElementById('destino').dispatchEvent(new Event('change'));window.map.closePopup();}});markers.push(m)});
   if(clientsGroup.addLayers)clientsGroup.addLayers(markers);else markers.forEach(m=>clientsGroup.addLayer(m));
   // Clusters remain optional and hidden at initial load for a clean map.
   apply();return true;
 }
 function apply(){if(!ready)return;sitesVisible?sitesGroup.addTo(window.map):window.map.removeLayer(sitesGroup);clientsVisible?clientsGroup.addTo(window.map):window.map.removeLayer(clientsGroup);for(const [id,on] of [['topBodegas',sitesVisible],['topClients',clientsVisible]]){const b=document.getElementById(id);if(b){b.classList.toggle('layer-active',on);b.setAttribute('aria-pressed',String(on));b.title=on?'Ocultar capa':'Mostrar capa'}}}
 window.geoLayers={sitesVisible:()=>sitesVisible,clientsVisible:()=>clientsVisible,toggleClients(){if(!initialize())return;clientsVisible=!clientsVisible;apply()},setClientsVisible(on){if(!initialize())return;clientsVisible=!!on;apply()},toggleSites(){sitesVisible=!sitesVisible;initialize();apply()},setSitesVisible(on){sitesVisible=!!on;initialize();apply()},addSite(b){if(!initialize()||!b?.ll)return;const m=L.marker(b.ll,{icon:cemexIcon,title:b.name});m.bindPopup('<strong>'+esc(b.name)+'</strong><br>'+esc(b.type||'Ubicación CEMEX')+'<br><button onclick="chooseSite('+b.idx+')">Seleccionar origen</button>');sitesGroup.addLayer(m);if(sitesVisible)sitesGroup.addTo(window.map)}};
 document.addEventListener('geocoast:catalog-loaded',()=>{initialize();apply()});
 let retries=0;const tryReady=()=>{if(!initialize()&&retries++<100)setTimeout(tryReady,350)};tryReady();
})();