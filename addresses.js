/* Geocodificación explícita de direcciones fuera del catálogo. Las coincidencias deben seleccionarse. */
(function(){
 const ids={origen:'geoOrigenResults',destino:'geoDestinoResults'};
 document.querySelectorAll('[data-geocode]').forEach(btn=>btn.addEventListener('click',async()=>{
  const kind=btn.dataset.geocode,field=document.getElementById(kind),out=document.getElementById(ids[kind]);
  const q=field.value.trim(); if(q.length<5){out.textContent='Escribe una dirección con al menos cinco caracteres.';return}
  out.textContent='Buscando ubicaciones…';btn.disabled=true;
  try{
   const uri='https://nominatim.openstreetmap.org/search?format=json&countrycodes=mx&limit=5&addressdetails=1&q='+encodeURIComponent(q);
   const res=await fetch(uri,{headers:{'Accept':'application/json'}});if(!res.ok)throw new Error('Servicio de búsqueda temporalmente no disponible');
   const matches=await res.json();out.replaceChildren();
   if(!matches.length){out.textContent='No se encontraron coincidencias. Añade municipio y estado.';return}
   matches.forEach(m=>{const el=document.createElement('button');el.type='button';el.className='geo-hit';el.textContent=m.display_name;
    el.onclick=()=>{
     const point=[Number(m.lat),Number(m.lon)];field.value=m.display_name;
     if(kind==='origen'){selectedSite={idx:-1,name:m.display_name,ll:point,type:'Dirección seleccionada'};}
     else {selectedDest={nombre:m.display_name,cemex_id:'DIRECCION',ll:point};}
     out.replaceChildren();map.setView(point,Math.max(map.getZoom(),11));
     document.getElementById('mapStatus').textContent='Dirección verificada geográficamente. Pulsa Calcular ruta y cotizar.';
    };out.appendChild(el)});
  }catch(e){out.textContent=e.message||'No fue posible consultar direcciones';}finally{btn.disabled=false}
 }));
})();
