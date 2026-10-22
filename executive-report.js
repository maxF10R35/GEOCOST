(function(){
const $=id=>document.getElementById(id);
const M=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);
const F=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('es-MX',{maximumFractionDigits:d}):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=id=>Math.max(0,Number($(id)?.value)||0);
function quote(r,u,load,eff,connection,extra={}){
 try{
  if(!window.GCIMT)throw Error('Motor GeoCoast–IMT no disponible');
  const q=window.GCIMT.fromApp(r,extra.elevation||null,extra.rows||[],{type:u.name,loadTons:load,includeManualCosts:extra.main===true});
  return {components:{},cost:q.cost,tariff:q.tariff,profit:q.profit,km:q.kmTotal,working:q.journeyHours,vdu:0,load,eff,imt:q};
 }catch(error){return {components:{},cost:NaN,tariff:NaN,profit:0,km:r.km*2,working:0,vdu:0,load,eff,error:error.message};}
}
function show(){
 const data=window.geocostReportData?.();if(!data?.route){alert('Primero selecciona el frente destino y calcula la ruta para generar el reporte.');return;}
 const {route,selectedSite,selectedDest,originQuotes,units,effort,presentation,connection,terrainSamples}=data;
 const origins=[{name:selectedSite?.name||'Origen principal',route,effort,main:true},...(originQuotes||[]).filter(x=>x.ok&&x.route).map(x=>({name:x.site.name,route:x.route,effort:x.quote?.eff,main:false}))];
 // Full is granel only; all other vehicles correspond to sacks and are quoted at their operational full-load capacity.
 const validUnits=units.filter(u=>presentation==='Granel'?u.name==='Full':u.name!=='Full');
 const selected=units.find(u=>u.name===$('vehiculo').value)||validUnits[0];
 const selectedLoad=N('ton');
 const matrix=origins.flatMap(o=>validUnits.map(u=>({...o,unit:u,quote:quote(o.route,u,u.cap,o.effort,connection,{main:false,elevation:o.main?terrainSamples:(o.route.terrainCache||null),rows:o.main?(window.GCEffortEditor?.rows?.()||[]):(o.route.geoRiskEfforts?.rows||[]).map(v=>({id:v.id,km:v.meters/1000}))})})));
 const current=quote(route,selected,selectedLoad,effort,connection,{main:true,elevation:terrainSamples,rows:window.GCEffortEditor?.rows?.()||[]});
 const primary=matrix.find(x=>x.main&&x.unit.name===selected.name)||matrix[0];
 if(matrix.some(x=>!Number.isFinite(x.quote.tariff))||!Number.isFinite(current.tariff)){alert('No se pudo calcular el reporte con el modelo IMT–GeoRisk. Revisa carga máxima, kilómetros de los esfuerzos y parámetros.');return;}
 const rows=matrix.map(x=>`<tr><td>${esc(x.name)}${x.main?' <b>(Principal)</b>':''}</td><td>${esc(x.unit.name)}</td><td>${F(x.unit.cap)} Tn</td><td>${F(x.quote.km)} km</td><td>${F(Math.max(x.route.h,x.route.km/80)*2)} h</td><td>${esc(x.effort?.effortLevel||'Sin dato')}</td><td>${M(x.quote.tariff)}</td><td>${M(x.quote.tariff/x.unit.cap)}</td><td>${F(x.quote.vdu,2)}</td></tr>`).join('');
 const references=current.imt?.refTiers||[];
 const commercialReport=references.length?`<h3>Referencias comerciales propuestas · NO oficiales CEMEX</h3><p><b>C</b> es la tarifa base del ciclo completo para el lote y la unidad seleccionados, con utilidad editable; las siguientes bandas son incrementos internos configurables sobre C y no se presentan como tarifas Staff.</p><div class="exec-table-scroll"><table><thead><tr><th>Referencia</th><th>% sobre C</th><th>Tarifa ciclo</th><th>Tarifa / km total</th></tr></thead><tbody>${references.map(t=>`<tr><td>${esc(t.name)}</td><td>${F(t.pct)}%</td><td>${M(t.amount)}</td><td>${M(t.amount/current.imt.kmTotal)}</td></tr>`).join('')}</tbody></table></div>`:'';
 const roadEffort=route.geoRiskEfforts;
 const editor=window.GCEffortEditor;
 const automatic=editor?.original?.()||[];
 const effective=editor?.rows?.()||[];
 const isManual=editor?.modified?.()||false;
 const byId=Object.fromEntries(automatic.map(x=>[x.id,x]));
 const effortRows=effective.map(r=>`<tr><td>${esc(r.name)}</td><td>${F(byId[r.id]?.km||0,2)} km</td><td>${F(r.km,2)} km</td><td>${F(route.km>0?100*r.km/route.km:0,1)}%</td></tr>`).join('');
 const classified=effective.reduce((sum,x)=>sum+x.km,0);
 const effortReport=`<h3>Esfuerzos logísticos · ruta seleccionada (${isManual?'corregidos manualmente':'detección GeoRisk'})</h3><div class="exec-table-scroll"><table><thead><tr><th>Tipo de camino</th><th>GeoRisk auto</th><th>Km aplicados al costo</th><th>% de ida</th></tr></thead><tbody>${effortRows}</tbody></table></div><p><b>Clasificado:</b> ${F(classified,2)} / ${F(route.km,2)} km · <b>Sin clasificar:</b> ${F(Math.max(0,route.km-classified),2)} km · <b>Fuente:</b> ${esc(roadEffort?.version||'sin evidencia completa')}. ${isManual?'Hay correcciones manuales locales y se aplicaron al costo y a este reporte.':'Sin correcciones manuales.'} No certifica transitabilidad de autotransporte pesado.</p>`;
 const q=current.imt;
 const share=amount=>q.tariff>0?F(100*amount/q.tariff,1)+'%':'—';
 const costLine=(label,amount,note='')=>`<tr><td>${esc(label)}${note?' · '+esc(note):''}</td><td>${M(amount)}</td><td>${share(amount)}</td></tr>`;
 const fixedLabels={asset:'Depreciación / arrendamiento',operator:'Operador fijo y prestaciones',insurance:'Seguros',admin:'Administración / tráfico',permit:'Permisos y derechos',gps:'GPS y monitoreo',patio:'Patio / infraestructura'};
 const varLabels={diesel:'Diésel',maintenance:'Mantenimiento',tires:'Llantas',lubricants:'Lubricantes',def:'DEF / AdBlue',tolls:'Peajes ida y vuelta',serviceMisc:'Servicios y viáticos',riskCost:'Custodia / riesgo justificado'};
 const fixedRows=Object.entries(fixedLabels).map(([k,name])=>costLine(name,q.monthlyTotal?q.fixedAllocation*(q.monthly[k]||0)/q.monthlyTotal:0)).join('');
 const variableRows=Object.entries(varLabels).map(([k,name])=>costLine(name,q.variable[k]||0,Object.hasOwn(q.audit?.manualApplied||{},k)?'ajuste manual':'' )).join('');
 const costReport=`<h3>Desglose de costos · unidad y lote seleccionados</h3><p><b>${esc(selected.name)}</b> · ${F(selectedLoad,2)} Tn por viaje · ${F(q.kmOneWay,2)} km ida · ${F(q.kmTotal,2)} km ciclo · <b>utilidad:</b> ${F(q.utility*100,2)}% del costo (markup). Tarifa estimada ${M(q.tariff)} sin IVA; no es tarifa vinculante.</p><div class="exec-table-scroll"><table><thead><tr><th>Rubro del ciclo</th><th>MXN</th><th>% tarifa</th></tr></thead><tbody><tr><th colspan="3">Costos fijos asignados · ${M(q.fixedAllocation)} (${share(q.fixedAllocation)})${Object.hasOwn(q.audit?.manualApplied||{},'fixed')?' · ajuste manual':''}</th></tr>${fixedRows}<tr><th colspan="3">Costos variables · ${M(q.variableTotal)} (${share(q.variableTotal)})</th></tr>${variableRows}${costLine('Costo técnico',q.cost)}${costLine('Utilidad',q.profit)}<tr><th>Tarifa C (sin IVA)</th><th>${M(q.tariff)}</th><th>100%</th></tr></tbody></table></div><p>Los costos fijos se prorratean según su estructura mensual. Si el costo fijo total fue sustituido manualmente, su reparto por subrubro es referencial. Cada porcentaje se calcula sobre la tarifa del viaje, sin duplicar subtotales.</p>`;
 const destination=esc(selectedDest?.nombre||'Frente seleccionado');
 $('execBody').innerHTML=`<div class="exec-head"><img src="assets/logo-cemex.svg" alt="CEMEX"><div><h1>GeoCost SC · Centro Sur</h1><h2>Reporte ejecutivo de cotización y orígenes alternos</h2></div></div>
 <div class="exec-meta"><b>Frente destino:</b> ${destination} <b>Origen principal:</b> ${esc(selectedSite?.name||'—')} <b>Alcance:</b> Ida y vuelta · <b>Transportista:</b> ${esc(document.getElementById('tipoTransportista')?.value||'mediano')} <b>Presentación:</b> ${esc(presentation)} <b>Fecha:</b> ${new Date().toLocaleString('es-MX')}</div>
 <div class="exec-summary"><div><span>Ruta principal ida y vuelta</span><b>${F(route.km*2)} km</b></div><div><span>Unidad seleccionada</span><b>${esc(selected.name)}</b></div><div><span>Lote cotizado</span><b>${F(selectedLoad)} Tn</b></div><div><span>Tarifa principal estimada</span><b>${M(current.tariff||0)}</b></div></div>
 <h3>1. Comparativo por origen y tipo de unidad, a capacidad máxima y sin ajustes manuales de la ruta principal</h3><div class="exec-table-scroll"><table><thead><tr><th>Origen</th><th>Unidad / conexión vehicular</th><th>Carga</th><th>Distancia</th><th>Conducción</th><th>Esfuerzo</th><th>Tarifa MXN</th><th>Tarifa/Tn</th><th>ICO*</th></tr></thead><tbody>${rows}</tbody></table></div>
 ${effortReport}
 ${costReport}
 ${commercialReport}
 <h3>2. Criterios generales</h3><p>Modelo único GeoCoast–IMT: ida cargada y regreso vacío, con utilidad editable y parámetros de tramo. La memoria de cálculo interna se genera por separado desde Configurar costos.</p>
 ${window.GCFuel?.reportHtml?.()||''}${window.GCMarket?.reportHtml?.()||''}<h3>3. Criterios de análisis</h3><p>Se utiliza la fórmula CF(viaje) + CV(ciclo completo), multiplicado por (1 + utilidad editable, 8% inicial), mediante GeoCoast–IMT. El perfil de montaña interviene en consumo cargado/vacío y desgaste, con supuestos editables. Los orígenes cercanos se identifican mediante radio geográfico progresivo desde el frente destino. La distancia, el tiempo y la geometría de cada alternativa proceden de consultas viales. El ascenso y la pendiente muestreados intervienen en los factores de diésel, mantenimiento y tiempo cuando hay elevaciones disponibles.</p>
 <p><b>Limitaciones:</b> costos y rendimientos son supuestos editables; las bandas C/C Prima/B/B+/B SPOT son propuestas no oficiales sin validación de las tablas vigentes CEMEX; los peajes son manuales y se replican en escenarios; el cálculo NOM-012 por tramo está pendiente y el motor de rutas usa un perfil automóvil. El ICO es un índice teórico de capacidad operativa; no valida bitácora NOM-087, descanso, inventario ni disponibilidad, y no sustituye el VDU operativo de CEMEX. El desglose usa la unidad, el lote y las correcciones vigentes para la ruta principal; las alternativas se calculan sin heredar los gastos manuales del origen principal. Incluye la conexión operativa seleccionada y los tipos de unidad compatibles con la presentación; no supone que una ruta está autorizada.</p>`;
 $('executiveModal').hidden=false;
}
window.openExecutiveReport=show;
document.addEventListener('DOMContentLoaded',()=>{$('execClose').onclick=()=>$('executiveModal').hidden=true;$('execPrint').onclick=()=>window.print();});
})();
