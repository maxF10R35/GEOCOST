/* Identificación ZT SAP (delimitaciones poligonales); sin estimación artificial de tarifas. */
(()=>{
 const $=id=>document.getElementById(id), cache=new Map();let meta=null,token=0,layer=null,last=null;
 const within=(lon,lat,b)=>lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3];
 function inRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){let a=ring[i],b=ring[j];if(((a[1]>lat)!==(b[1]>lat))&&(lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]))inside=!inside}return inside}
 const getData=async file=>{if(!cache.has(file))cache.set(file,fetch('data/zt/'+file).then(r=>{if(!r.ok)throw Error('ZT '+r.status);return r.json()}).catch(e=>{cache.delete(file);throw e}));return cache.get(file)};
 async function lookup(lat,lon){if(!meta){const r=await fetch('data/zt/index.json');if(!r.ok)throw Error('Índice ZT no disponible');meta=await r.json()}
 const stateFiles=meta.filter(m=>within(lon,lat,m.bbox));if(!stateFiles.length)return {status:'outside'};
 let matches=[];let failed=[];
 const all=await Promise.allSettled(stateFiles.map(s=>getData(s.file)));
 all.forEach((result,i)=>{if(result.status!=='fulfilled'){failed.push(stateFiles[i].estado);return}for(const z of result.value){if(within(lon,lat,z.bbox)&&z.rings.some(r=>inRing(lon,lat,r)))matches.push(z)}});
 if(failed.length)return {status:'error',failed};
 return matches.length===1?{status:'match',zt:matches[0]}:matches.length>1?{status:'multiple',matches}: {status:'gap'};
 }
 function dest(){const raw=$('destino')?.value?.trim()?.toLowerCase()||'';
 const f=(window.frentes||[]).find(x=>(x.nombre+' · '+x.cemex_id).toLowerCase()===raw||x.cemex_id?.toLowerCase()===raw||x.nombre.toLowerCase()===raw);
 if(f?.ll)return {ll:f.ll,name:f.nombre};
 const sd=window.__geoCoastZtSelected; if(sd?.ll&&((sd.nombre||'').toLowerCase()===raw||raw.startsWith('punto:')))return {ll:sd.ll,name:sd.nombre};
 const site=(window.bodegas||[]).find(x=>x.name.toLowerCase()===raw);
 if(site?.ll)return {ll:site.ll,name:site.name};
 return null;
 }
 async function check(){const info=dest(),out=$('ztSapResult'),id=++token;layer?.clearLayers();last=null;
 if(!info){out.textContent='Elige un cliente del catálogo o marca el punto en el mapa. Para direcciones externas, primero selecciona un resultado geocodificado.';return}
 out.textContent='Consultando polígono SAP para '+info.name+'…';
 try{const res=await lookup(+info.ll[0],+info.ll[1]);if(token!==id)return;last=res;
 if(res.status==='match'){const z=res.zt;out.innerHTML='<b>ZT: '+esc(z.id)+'</b> · '+esc(z.nombre)+'<div>'+esc(z.municipio)+', '+esc(z.estado)+'</div><div>Coincidencia espacial con polígono SAP · sin tarifa asociada</div>';}
 else if(res.status==='multiple')out.textContent='Ubicación en '+res.matches.length+' polígonos superpuestos: '+res.matches.map(x=>x.id).join(', ')+'. Requiere validación.';
 else if(res.status==='gap')out.textContent='Punto no cubierto por los polígonos SAP de los estados candidatos. No se asignó una ZT por cercanía.';
 else if(res.status==='outside')out.textContent='Punto fuera de la cobertura geográfica de esta delimitación SAP.';
 else out.textContent='Consulta incompleta: no se pudieron cargar '+res.failed.join(', ')+'. No se puede asegurar una ZT.';
 }catch(e){if(token===id)out.textContent='No fue posible consultar la base SAP: '+e.message}
 }
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function init(){if(!$('ztSapCheck'))return;
 $('ztSapCheck').onclick=check;
 $('ztSapToggle').onclick=async()=>{if(!last||last.status!=='match'){await check();if(!last||last.status!=='match')return}
 const z=last.zt;if(!window.map)return;
 if(!layer)layer=L.layerGroup().addTo(window.map);
 else layer.clearLayers();const shapes=z.rings.map(r=>r.map(p=>[p[1],p[0]]));
 for(const pts of shapes)L.polygon(pts,{color:'#1477b5',weight:2,fillOpacity:.09}).bindPopup('ZT SAP: '+esc(z.id)).addTo(layer);
 if(layer.getLayers().length)window.map.fitBounds(L.featureGroup(layer.getLayers()).getBounds().pad(.1));};
 $('destino')?.addEventListener('change',()=>setTimeout(check,60));
 $('destino')?.addEventListener('input',()=>{if($('ztSapResult'))$('ztSapResult').textContent='Destino modificado · consulta ZT para actualizar.'});
 // El evento click en el mapa ya determina el destino en app.js.
 window.map?.on('click',e=>{window.__geoCoastZtSelected={nombre:'Punto seleccionado',ll:[e.latlng.lat,e.latlng.lng]};setTimeout(check,75)});
 $('draw')?.addEventListener('click',()=>setTimeout(check,150));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
