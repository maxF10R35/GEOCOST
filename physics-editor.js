/* Correcciones FÍSICAS por ruta; no utiliza GCEffortEditor ni el índice IRA. */
(()=>{
 const ids=window.GCRoadPhysicsCore.classes;
 const labels={urbano:'Urbano',autopista_sin:'Autopista sin sierra',autopista_con:'Autopista con pendiente',pavimento_sin:'Pavimento sin sierra',pavimento_con:'Pavimento con pendiente',terraceria_sin:'Terracería sin sierra',terraceria_con:'Terracería con pendiente'};
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let current=null,edited=new Map();const STORE='geocoast-tramos-fisicos-v2';
 function persist(){try{localStorage.setItem(STORE,JSON.stringify(Object.fromEntries([...edited.entries()].slice(-120))))}catch(e){console.warn('No pudo guardar correcciones viales',e)}}
 function restore(){try{const data=JSON.parse(localStorage.getItem(STORE)||'{}');if(data&&typeof data==='object')edited=new Map(Object.entries(data).filter(([k,v])=>v&&typeof v==='object'));}catch(e){edited=new Map()}}
 function key(r){return r?(r.coords?.[0]?.join(',')+'|'+r.coords?.at(-1)?.join(',')+'|'+Number(r.km).toFixed(2)):null}
 function get(r){const base=r?.roadPhysics;if(!base)return null;const custom=edited.get(key(r));if(!custom)return base;
  const classes=ids.map(id=>({id,km:Math.max(0,Number(custom[id])||0)}));const known=classes.reduce((s,x)=>s+x.km,0);
  return {...base,rows:classes,classifiedKm:known,unknownKm:Math.max(0,r.km-known),manual:true};
 }
 function draw(r){const out=$('gcPhysicsEditor'),status=$('gcPhysicsStatus');if(!out||!status)return;
  const p=get(r);if(!p){out.innerHTML='';status.textContent='Detectando tipo de vía y pendiente con RNC / OSM…';return;}
  const custom=edited.get(key(r));const known=p.rows.reduce((s,x)=>s+x.km,0),bad=known>r.km+.10;
  status.textContent=`${p.model} · ${p.evidenceStatus||'Análisis'} · ${Math.round(100*p.classifiedKm/r.km)}% de km identificados · ${p.unknownKm.toFixed(1)} km sin clasificar · subida +${Math.round(p.ascent)} m, bajada −${Math.round(p.descent)} m${custom?' · Corrección manual':''}${bad?' · ERROR: más kilómetros que la ruta':''}`;
  status.style.color=bad?'#b91c1c':'';
  out.innerHTML='<div class="gc-physical-rows">'+p.rows.map(v=>`<label><span>${esc(labels[v.id])}</span><input data-gc-physical="${v.id}" type="number" min="0" max="${r.km}" step="0.01" value="${v.km.toFixed(2)}" aria-label="${esc(labels[v.id])} kilómetros"></label>`).join('')+'</div>';
 }
 function edit(ev){const node=ev.target?.closest?.('[data-gc-physical]');if(!node||!current)return;const k=key(current);
  if(!edited.has(k))edited.set(k,Object.fromEntries((get(current)?.rows||[]).map(v=>[v.id,v.km])));
  edited.get(k)[node.dataset.gcPhysical]=Math.max(0,Number(node.value)||0);persist();
  const p=get(current),bad=p.classifiedKm>current.km+.10;
  $('gcPhysicsStatus').textContent=bad?'Corrige los km: la suma excede la ruta.':`Corregido: ${p.classifiedKm.toFixed(2)} km clasificados / ${current.km.toFixed(2)} km; resto en condición base.`;
  $('gcPhysicsStatus').style.color=bad?'#b91c1c':'';
  document.dispatchEvent(new Event('geocoast:physics-edit'));
 }
 function init(){restore();current=window.geocostReportData?.()?.route||null;$('gcPhysicsEditor')?.addEventListener('change',edit);
  $('gcPhysicsReset')?.addEventListener('click',()=>{if(current)edited.delete(key(current));persist();draw(current);document.dispatchEvent(new Event('geocoast:physics-edit'))});
  document.addEventListener('geocoast:route-selected',()=>{current=window.geocostReportData?.()?.route||null;draw(current)});
  document.addEventListener('geocoast:road-physics-updated',e=>{if(e.detail?.route===current){draw(current);document.dispatchEvent(new Event('geocoast:physics-edit'))}});
  const source=$('gcRncSourceStatus');
  window.GCRNC?.status?.().then(v=>{if(source)source.textContent=v});
  $('gcRncGeojson')?.addEventListener('change',async e=>{
   const file=e.target.files?.[0];if(!file)return;
   if(source)source.textContent='Validando GeoJSON…';
   try{
    const result=await window.GCRNC.loadLocalGeoJSON(file);
    if(source)source.textContent=`Capa RNC de sesión: ${result.ways.toLocaleString('es-MX')} tramos. Recalculando clasificación…`;
    if(current){await window.GCRoadPhysics?.analyze?.(current,current.terrainCache||null,{force:true});}
    // Cada origen alternativo necesita su propio diagnóstico físico y tarifa;
    // recalcular progresivamente y sin saturar el navegador.
    const origins=window.geocostReportData?.()?.originQuotes||[];
    const others=origins.filter(x=>x.route).map(x=>x.route);
    for(let i=0;i<others.length;i+=2){
      await Promise.allSettled(others.slice(i,i+2).map(async r=>{
        await window.GCRoadPhysics?.analyze?.(r,r.terrainCache||null,{force:true});
        document.dispatchEvent(new Event('geocoast:physics-edit'));
      }));
    }
    if(source)source.textContent=`RNC cargada (${result.ways.toLocaleString('es-MX')} elementos). Se usa solo en este navegador y mientras permanezca abierta la página.`;
   }catch(err){if(source)source.textContent='Error RNC: '+(err.message||err);}
  });
 }
 window.GCPhysicsEditor={get,draw};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
