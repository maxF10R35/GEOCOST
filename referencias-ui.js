/* GeoCost SC · pines de referencia (Leaflet) y aviso de casetas. Se activa con el evento 'geocoast:quote'. */
(()=>{
 'use strict';
 const R=window.GCReferencias,MXN=n=>'$'+Math.round(n).toLocaleString('es-MX');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let datos=null,timer=0,turno=0,layer=null,banner=null;
 const css=document.createElement('style');
 css.textContent=`.gcref-pin{background:#fff;color:#0000B3;border:2px solid #0000B3;border-radius:14px;padding:2px 8px;font:700 12px/18px Outfit,Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3);text-align:center;white-space:nowrap}
 .gcref-pin.cas{border-color:#FFB000}.gcref-pin:hover{background:#0000B3;color:#fff}
 .gcref-banner{position:absolute;z-index:1000;left:50%;top:12px;transform:translateX(-50%);max-width:min(560px,90%);background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.3);padding:8px 12px;font:13px/1.35 Outfit,Arial,sans-serif;color:#3D3D3D}
 .gcref-banner b{color:#0000B3}.gcref-banner .warn{margin-top:6px;padding:6px 8px;background:#FFF4D6;border-left:4px solid #FFB000;border-radius:4px}`;
 document.head.appendChild(css);
 async function cargar(){
  if(datos)return datos;
  datos=Promise.all([fetch('data/referencias.json').then(r=>r.json()),fetch('data/origen_map.json').then(r=>r.json())])
   .then(([j,mapa])=>({indice:R.indexar(j),mapa})).catch(e=>{datos=null;throw e;});
  return datos;
 }
 function limpiar(){layer?.clearLayers();if(banner)banner.hidden=true;}
 function mostrarBanner(html){
  if(!banner){banner=document.createElement('div');banner.className='gcref-banner';window.map.getContainer().appendChild(banner);L.DomEvent.disableClickPropagation(banner);}
  banner.innerHTML=html;banner.hidden=false;
 }
 function popup(p){
  return `<b>${esc(p.Municipio||p.ZT)}, ${esc(p.Estado||'')}</b><br><small>ZT ${esc(p.ZT)} · a ${p.dist.toFixed(1)} km del destino</small><br>
  Base: ${MXN(p.Base||0)}<br>Ajustes: ${MXN(p.Ajustes||0)}<br>Casetas: ${p.Casetas>0?MXN(p.Casetas):'no incluidas'}<br>
  <b>Mediana: ${MXN(p.Mediana)}</b> (mín ${MXN(p.Min)} – máx ${MXN(p.Max)})<br>${p.nFleteros} fletero(s) · ${p.Kms==null?'km sin dato':p.Kms+' km'} · ${esc(p.Fecha)}
  ${p.aprox?'<br><i>Ubicación aproximada (zona amplia)</i>':''}`;
 }
 async function actualizar(d){
  const mi=++turno;
  try{
   const {indice,mapa}=await cargar();if(mi!==turno)return;
   const idOrigen=mapa[d.site?.name],tipo=R.tipoConexion(d.unit,d.granel),ll=d.dest?.ll;
   if(!layer)layer=L.layerGroup().addTo(window.map);
   limpiar();
   if(!ll)return;
   if(!idOrigen||!tipo)return mostrarBanner(`<b>Referencias:</b> este origen o tipo de unidad no tiene equivalente en la base de tarifas.`);
   const r=R.buscar({indice,idOrigen,tipo,lat:ll[0],lon:ll[1],kms:d.route?.km,casetasModelo:d.q?.variable?.tolls});
   if(!r.pines.length)return mostrarBanner(`<b>Referencias:</b> sin tarifas comparables a ≤15 km del destino (mismo origen, conexión ${esc(tipo)} y kms similares).`);
   L.circle(ll,{radius:r.radio*1000,color:'#0000B3',weight:1.5,fillOpacity:.04,interactive:false}).addTo(layer);
   for(const p of r.pines)L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:`<div class="gcref-pin${p.TieneCasetas?' cas':''}">${R.precioCompacto(p.Mediana)}</div>`,iconSize:[56,24],iconAnchor:[28,24]})}).bindPopup(popup(p)).addTo(layer);
   let h=`<b>${r.pines.length} referencia(s)</b> a ≤${r.radio} km · mediana ${MXN(r.refMediana)} · modelo C ${MXN(d.q.tariff)}`;
   if(r.ampliado)h+=`<br><small>Radio ampliado a ${r.radio} km (hubo menos de 3 a 5 km).</small>`;
   if(r.avisoCasetas)h+=`<div class="warn">Esta tarifa no incluye casetas; las referencias cercanas incluyen en mediana <b>${MXN(r.casetasRefMediana)}</b>. Referencia sin casetas (base + ajustes): <b>${MXN(r.refSinCasetas)}</b>.</div>`;
   mostrarBanner(h);
  }catch(e){console.error('[Referencias]',e);try{mostrarBanner('<b>Referencias no disponibles:</b> '+esc(e.message||e)+'. Revisa que data/referencias.json y data/origen_map.json estén publicados y que abras la app por http, no por archivo.');}catch(_){}}
 }
 document.addEventListener('geocoast:route-start',()=>{turno++;clearTimeout(timer);limpiar();});
 window.addEventListener('geocoast:quote',ev=>{console.info('[Referencias] cotización recibida',{origen:ev.detail?.site?.name,unidad:ev.detail?.unit,destino:ev.detail?.dest?.ll});clearTimeout(timer);timer=setTimeout(()=>actualizar(ev.detail),350);});
 R.diagnostico=async()=>{const o={modulo:true,leaflet:typeof L!=='undefined',mapa:!!window.map,protocolo:location.protocol,cotizacion:!!window.geocostIMTQuote};
  for(const f of ['data/referencias.json','data/origen_map.json']){try{o[f]=(await fetch(f,{method:'HEAD'})).status;}catch(e){o[f]='error: '+e.message;}}
  console.table(o);return o;};
 console.info('[Referencias] módulo cargado; en la consola: GCReferencias.diagnostico()');
})();
