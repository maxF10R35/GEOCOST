/* GeoCoast SC - informe de dirección con soporte para impresión/PDF.
   Todas las tablas provienen del MISMO motor GCIMT; no hay fórmulas paralelas. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),money=n=>Number.isFinite(n)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n):'Pendiente';
 const n=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let reportMap=null;
 function getQuote(r,u,load,main=false){
  if(load>u.cap+.001)return null;
  try{
   const phys=main?(window.GCPhysicsEditor?.get?.(r)||r.roadPhysics):r.roadPhysics;
   return window.GCIMT.fromApp(r,main?window.geocostReportData()?.terrainSamples:(r.terrainCache||null),phys?.rows||[],{
    type:u.name,loadTons:load,includeManualCosts:main,dieselPrice:main?window.GCFuel?.getPrice?.():r.dieselPrice,
    ascent:phys?.ascent,descent:phys?.descent,roadRows:phys?.rows||[]
   });
  }catch(e){console.warn('No se puede cotizar '+u.name,e.message);return null;}
 }
 function drawMap(origins,dest){if(!window.L||!$('gcExecutiveMap'))return;
  if(reportMap){reportMap.remove();reportMap=null;}
  reportMap=L.map('gcExecutiveMap',{zoomControl:false,scrollWheelZoom:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(reportMap);
  const lines=[];
  for(let i=0;i<origins.length;i++){const o=origins[i],coords=o.route.coords;if(!coords?.length)continue;
   const line=L.polyline(coords,{color:i===0?'#063e83':'#899fb5',weight:i===0?5:2,opacity:i===0?.95:.65}).addTo(reportMap);lines.push(line);
   L.circleMarker(coords[0],{radius:5,color:'#fff',weight:1,fillColor:i===0?'#064aab':'#7189a3',fillOpacity:1}).addTo(reportMap).bindTooltip(o.name);
  }
  if(dest?.ll)L.circleMarker(dest.ll,{radius:6,color:'#fff',weight:1,fillColor:'#e2231a',fillOpacity:1}).addTo(reportMap).bindTooltip(dest.nombre||'Destino');
  if(lines.length)reportMap.fitBounds(L.featureGroup(lines).getBounds().pad(.18));
  setTimeout(()=>reportMap?.invalidateSize(),100);
 }
 function show(){const ctx=window.geocostReportData?.();if(!ctx?.route)return alert('Selecciona y calcula primero una ruta');
  const {route,selectedSite,selectedDest,originQuotes,units,presentation}=ctx;
  const unit=units.find(u=>u.name===$('vehiculo')?.value)||units[0],load=Number($('ton')?.value)||0;
  // En sensibilidad por unidades, respetar casetas del origen principal (entrada manual).
  route.tollsOneWay=Math.max(0,Number($('tolls')?.value)||0);
  const main=getQuote(route,unit,load,true);if(!main)return alert('La cotización principal aún no tiene precio estatal de diésel y/o carga válida. Revisa Configurar costos.');
  const origins=[{name:selectedSite?.name||'Origen principal',route,main:true},...(originQuotes||[]).filter(v=>v.ok&&v.route&&Number.isFinite(v.route.dieselPrice)).map(v=>({name:v.site.name,route:v.route,main:false}))];
  const validUnits=units.filter(u=>presentation==='Granel'?['Tráiler','Full'].includes(u.name):u.name!=='Full');
  const comparison=origins.flatMap(o=>validUnits.map(u=>({origin:o.name,main:o.main,unit:u,load:u.cap,price:o.main?window.GCFuel?.getPrice?.():o.route.dieselPrice,route:o.route,q:getQuote(o.route,u,u.cap,false)})));
  const qselected=main,dieselInfo=window.GCFuel?.getInfo?.(),tollInfo=window.GCRegional?.getInfo?.(),fmtTime=()=>new Date().toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const road=window.GCPhysicsEditor?.get?.(route)||route.roadPhysics;
  const goodKms=road?.classifiedKm||0;
  const cmpRows=comparison.map(x=>{const baseline=comparison.find(z=>z.origin===x.origin&&z.unit.name===unit.name)?.q;
   return `<tr${x.main?' class="gc-primary-row"':''}><td>${esc(x.origin)}</td><td>${esc(x.unit.name)}</td><td>${n(x.unit.cap,0)} Tn</td><td>${n(x.load,1)} Tn</td><td>${x.q?n(100*x.load/x.unit.cap,0)+'%':'No admite lote'}</td><td>${n(x.route.km,1)} km</td><td>${money(x.price)} /L</td><td><strong>${x.q?money(x.q.tariff):'No viable'}</strong></td><td>${x.q?money(x.q.tariff/x.load):'—'}</td><td>${x.q&&baseline?money(x.q.tariff-baseline.tariff):'—'}</td></tr>`}).join('');
  const originalRows=origins.map(o=>{const q=getQuote(o.route,unit,load,false);const phys=o.main?road:o.route.roadPhysics;
   return `<tr><td>${esc(o.name)}</td><td>${n(o.route.km,1)}</td><td>${n(o.route.h,1)}</td><td>${n(phys?.classifiedKm/o.route.km*100,0)}%</td><td>${q?n(q.audit.dieselPrice,2):'—'}</td><td><strong>${q?money(q.tariff):'Pendiente'}</strong></td><td>${q?money(q.tariff/load):'—'}</td></tr>`}).join('');
  const budget=window.GCIMT.detailedBreakdown(main);
  const budgetItem=x=>`<li class="gc-cost-line"><span class="gc-cost-label">${esc(x.label)}</span><strong class="gc-cost-money">${money(x.amount)}</strong><b class="gc-cost-percent">${n(x.participation*100,2)}%</b></li>`;
  const budgetList=(type,entries,total,participation)=>`<section class="gc-report-cost-group"><h4>${type}</h4><div class="gc-cost-list-head"><span>Componente</span><span>MXN</span><span>% costo</span></div><ul class="gc-cost-list">${entries.map(budgetItem).join('')}</ul><div class="gc-cost-list-total"><strong>Total ${type.toLowerCase()}</strong><strong>${money(total)}</strong><b>${n(participation*100,2)}%</b></div></section>`;
  const names={urbano:'Urbano',autopista_sin:'Autopista sin sierra',autopista_con:'Autopista con pendiente',pavimento_sin:'Pavimento sin sierra',pavimento_con:'Pavimento con pendiente',terraceria_sin:'Terracería sin sierra',terraceria_con:'Terracería con pendiente'};
  const physicsTable=(road?.rows||[]).filter(v=>v.km>0).map(v=>`<tr><td>${esc(names[v.id]||v.id)}</td><td>${n(v.km,1)} km</td><td>${n(v.km/route.km*100,1)}%</td></tr>`).join('');
  const fuelRows=Object.entries(dieselInfo?.states||{}).map(([state,km])=>`<span>${esc(state)}: ${n(km,1)} km</span>`).join(' · ');
  const sourceDate=esc(dieselInfo?.date||'sin fecha');
  $('execBody').innerHTML=`
  <div class="exec-head"><img src="assets/logo-cemex.svg" alt="CEMEX"><div><h1>GeoCoast SC | Análisis de flete</h1><h2>Autotransporte Centro Sur · Informe ejecutivo para evaluación interna</h2></div></div>
  <div class="exec-meta"><span><b>Corte:</b> ${fmtTime()}</span><span><b>Origen:</b> ${esc(selectedSite?.name||'—')}</span><span><b>Destino:</b> ${esc(selectedDest?.nombre||'—')}</span><span><b>Conexión:</b> ${esc(unit.name)}</span><span><b>Transportista:</b> ${esc($('tipoTransportista')?.value||'mediano')}</span></div>
  <div class="exec-summary"><div><span>Tarifa estimada por viaje</span><b>${money(main.tariff)}</b></div><div><span>Costo técnico</span><b>${money(main.cost)}</b></div><div><span>Diésel aplicado sin IVA</span><b>${n(main.audit.dieselPrice,2)} $/L</b></div><div><span>Distancia del ciclo</span><b>${n(main.kmTotal,1)} km</b></div></div>
  <h3>1. Ruta seleccionada y cobertura vial</h3><div class="gc-report-map" id="gcExecutiveMap"></div><div class="gc-report-map-caption">Mapa base OpenStreetMap; geometría de la ruta: <b>${esc(route.routingSource||"fuente por verificar")}</b>. Principal en azul y orígenes comparados en gris. El trazo OSRM/OSM es una referencia vial, NO certifica restricciones de carga, horarios, peso, dimensiones ni NOM-012.</div>
  <p><b>Ruta principal:</b> ${n(route.km,1)} km de ida · <b>Ascenso muestreado:</b> +${n(road?.ascent,0)} m · <b>Descenso:</b> −${n(road?.descent,0)} m · <b>Clasificación:</b> ${n(100*goodKms/route.km,0)}% (${esc(road?.dataSource||'sin fuente')}) · RNC ${n(road?.rncKm,1)} km · OSM ${n(road?.osmKm,1)} km · <b>Sin clasificar:</b> ${n(road?.unknownKm,1)} km. ${road?.unspecifiedUrbanKm>0.1?`<b>Nota:</b> ${n(road.unspecifiedUrbanKm,1)} km urbanos sin superficie de rodamiento especificada.`:''}</p>
  <div class="exec-table-scroll"><table><thead><tr><th>Superficie / geometría</th><th>Km ida</th><th>% ruta</th></tr></thead><tbody>${physicsTable||'<tr><td colspan="3">Pendiente de evidencia RNC / OSM</td></tr>'}</tbody></table></div>
  <h3>2. Comparativo de bodegas para la MISMA unidad y carga</h3><div class="exec-table-scroll"><table><thead><tr><th>Origen</th><th>Km de ida</th><th>Tiempo vial ida (h)</th><th>Cobertura tipo vía</th><th>Diésel sin IVA $/L</th><th>Tarifa estimada</th><th>$/Tn</th></tr></thead><tbody>${originalRows}</tbody></table></div>
  <h3>3. Sensibilidad por unidad: lote óptimo de cada vehículo</h3><p>Se usa el lote óptimo de cada unidad, manteniendo las características viales del origen. Cambian la capacidad cargada, el rendimiento, mantenimiento, llantas y costos fijos. La diferencia de tarifa es respecto a la unidad ${esc(unit.name)} en el mismo origen, sin ajustes monetarios manuales.</p>
  <div class="exec-table-scroll"><table><thead><tr><th>Origen</th><th>Unidad</th><th>Capacidad</th><th>Lote</th><th>Ocupación</th><th>Km ida</th><th>Diésel</th><th>Tarifa estimada</th><th>$/Tn</th><th>Δ vs actual</th></tr></thead><tbody>${cmpRows}</tbody></table></div>
  <h3>4. Composición del flete principal</h3><p><b>${esc(unit.name)}</b> · ${n(load,1)} Tn · ${n(main.dieselLitres,1)} L diésel estimados × <b>${n(main.audit.dieselPrice,2)} MXN/L</b> precio neto aplicado (referencia ${n(main.audit.dieselPriceInput,2)} MXN/L ${main.audit.dieselIncludesIVA?'con IVA':'declarada sin IVA'}) = <b>${money(main.variable.diesel)}</b> combustible. Casetas incorporadas al costeo (automáticas verificables o ajustes explícitos), sin IVA: <b>${money(main.variable.tolls)}</b> · estado: ${esc(tollInfo?.status||"pendiente")}. Si faltan plazas, el total puede estar subestimado.</p>
  <div class="exec-split">${budgetList('Costos variables',budget.variable,budget.variableTotal,budget.variablePercent)}${budgetList('Costos fijos',budget.fixed,budget.fixedTotal,budget.fixedPercent)}</div>
  <div class="gc-cost-grand-total"><span>Costo técnico del ciclo</span><strong>${money(main.cost)}</strong><b>100%</b></div>
  <p>La participación es el porcentaje de cada importe sobre el <b>costo técnico sin utilidad</b>. Se presenta el mismo desglose en MXN y porcentaje que en la cotización, sin duplicar rubros. Margen adicional: ${money(main.profit)} · Tarifa estimada: ${money(main.tariff)} sin IVA.</p>
  <h3>5. Cierre de la tarifa</h3><div class="exec-table-scroll"><table><thead><tr><th>Concepto</th><th>Importe</th><th>Unidad</th></tr></thead><tbody><tr><td>Costo técnico</td><td>${money(main.cost)}</td><td>MXN por ciclo</td></tr><tr><td>Margen (${n(main.utility*100,1)}% del costo)</td><td>${money(main.profit)}</td><td>MXN</td></tr><tr><th>Tarifa estimada sin IVA</th><th>${money(main.tariff)}</th><th>MXN por viaje</th></tr><tr><td>Tarifa por tonelada</td><td>${money(main.tariff/main.loadTons)}</td><td>MXN/Tn</td></tr><tr><td>Tarifa por Tn-km</td><td>${money(main.tariff/(main.loadTons*main.kmTotal))}</td><td>MXN/(Tn·km ciclo)</td></tr></tbody></table></div>
  <h3>6. Referencias tarifarias comerciales (escenarios)</h3>
  <div class="exec-table-scroll"><table class="gc-exec-refs"><thead><tr><th>Referencia</th><th>Ajuste sobre C</th><th>MXN por ciclo</th><th>MXN por km ciclo</th></tr></thead><tbody>${main.refTiers.map((t,i)=>`<tr${i===0?' class="gc-primary-row"':''}><td><b>${esc(t.name)}</b></td><td>${i===0?'Base':'+'+n(t.pct,1)+'%'}</td><td><b>${money(t.amount)}</b></td><td>${money(t.amount/main.kmTotal)}</td></tr>`).join('')}</tbody></table></div>
  <p><b>C</b> es la tarifa base sin IVA que suma costo técnico y margen. C’, B, B+ y B SPOT son referencias de escenario configurables, no niveles tarifarios CEMEX certificados ni precios negociados.</p>
  <h3>7. Metodología, confiabilidad y validación</h3><div class="gc-report-method"><b>Modelo GC-FIS 2.1 + GeoCoast–IMT:</b> costo fijo asignado al ciclo + costos variables + utilidad editable. La geometría y atributos RNC (Cond_Pav, Recubri) identifican superficie vial cuando están instalados; OSM es la alternativa provisional, mientras que el perfil altimétrico ajusta combustible, mantenimiento, suspensión y llantas por ascensos y descensos. El desglose de participación representa los rubros fijos y variables calculados para la ruta, como porcentaje del costo técnico sin utilidad; no utiliza porcentajes preestablecidos del presupuesto de referencia. No se usan índices de esfuerzos logísticos GeoRisk como factores tarifarios. El precio diésel de cada ruta es el promedio estatal ponderado por kilómetros recorridos, con referencia de la fuente y fecha.</div>
  <p><b>Desglose de estados de la ruta principal:</b> ${fuelRows||'Sin desagregación disponible'} · <b>Precios al corte:</b> ${sourceDate}. Los tramos sin estado identificado quedan fuera del promedio; si la cobertura es nula, no se calcula tarifa automática. No se usa el $26.99/L nacional como valor fijo.</p>
  <p><b>Alcance:</b> tarifas modeladas para negociación, no tarifas CEMEX ni ofertas confirmadas del mercado. Supuestos por antigüedad de unidad, consumo, desgaste y tamaño de flotilla requieren calibración con datos reales. El transportista grande puede tener más gasto en administración/patio, pero el efecto neto depende también de la utilización real. Las casetas se buscan en OSM y se cotejan contra tarifas CAPUFE por categoría; puede haber plazas no incluidas o diferentes tarifas según acceso, sentido o concesión. El costo automático es preliminar, no un total garantizado. Regreso estimado por el mismo trayecto y costo, requiere validación.</p>
  <p><b>Referencias:</b> IMT PT630 (2021) — estructura y productividad de costos fijos; IMT PT881 (2025) — condiciones geométricas y superficie; RNC INEGI/SICT — condición y recubrimiento (cuando se carga); OSM/OSRM — geometría vial referencial SIN validación de circulación de carga; CAPUFE/FONADIN — tarifas de casetas cuando su identificación es confiable; fuentes estatales de diésel registradas en la herramienta. <b>Recomendación:</b> validar con facturas, consumo por unidad y tarifas comparables por ruta antes de adoptar como referencia contractual.</p>
  <p class="gc-report-map-caption">Generado automáticamente por GeoCoast SC · Uso interno · Valores de simulación · MXN sin IVA</p>`;
  $('executiveModal').hidden=false;requestAnimationFrame(()=>drawMap(origins,selectedDest));
 }
 window.openExecutiveReport=show;
 document.addEventListener('DOMContentLoaded',()=>{$('execClose')?.addEventListener('click',()=>{$('executiveModal').hidden=true;reportMap?.remove();reportMap=null});$('execPrint')?.addEventListener('click',()=>{reportMap?.invalidateSize();window.print()})});
})();
