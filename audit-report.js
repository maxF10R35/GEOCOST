/* GeoCost SC — memoria técnica de cálculo (uso interno, generación 100% local).
 * No confundir ocultar este control con autenticación: cualquier usuario con acceso
 * al sitio público y su código fuente podría reconstruir parámetros del motor.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const n=(x,d=3)=>Number.isFinite(Number(x))?Number(x).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:d}):'—';
 const mx=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 const row=(a,b)=>`<tr><td>${safe(a)}</td><td>${safe(b)}</td></tr>`;
 const table=(items,first='Componente',last='Valor')=>`<table><thead><tr><th>${safe(first)}</th><th>${safe(last)}</th></tr></thead><tbody>${items.map(x=>row(...x)).join('')}</tbody></table>`;
 const eq=(formula,actual)=>`<div class="gc-audit-equation"><div><b>${safe(formula)}</b></div><div>${safe(actual)}</div></div>`;
 function body(q){
  const audit=q.audit;
  if(!audit)throw Error('Los valores intermedios no están disponibles. Actualiza la cotización.');
  const data=window.geocostReportData?.()||{},name=data.selectedSite?.name||'Origen por confirmar',dest=data.selectedDest?.nombre||'Destino por confirmar';
  const carrier=$('tipoTransportista')?.selectedOptions?.[0]?.textContent||'Mediano';
  const model=String($('imtMakeModel')?.value||'No informado');
  const trips=Math.max(1,Math.round(Number($('numeroViajes')?.value)||1));
  const fixedUnits={asset:'Depreciación / arrendamiento (sin duplicar financiamiento)',operator:'Operador fijo y prestaciones',insurance:'Seguros',admin:'Administración y tráfico',permit:'Permisos y derechos',gps:'GPS',patio:'Patio e infraestructura'};
  const varUnits={diesel:'Diésel',maintenance:'Mantenimiento',tires:'Llantas',lubricants:'Lubricantes',def:'DEF / AdBlue',tolls:'Peajes de ambos sentidos',serviceMisc:'Viáticos / maniobras / servicios / operador por km',riskCost:'Costo de riesgo justificado'};
  const roadNames={urbano:'Urbano',autopista_sin:'Autopista sin sierra',autopista_con:'Autopista con sierra',pavimento_sin:'Pavimento sin sierra',pavimento_con:'Pavimento con sierra',terraceria_sin:'Terracería sin sierra',terraceria_con:'Terracería con sierra'};
  const roadRows=Object.entries(audit.roadKm).map(([id,km])=>[roadNames[id]||id,n(km,2)+' km ('+n(km/q.kmOneWay*100,1)+'%)']);
  const cfRows=Object.entries(fixedUnits).map(([k,label])=>[label,mx(q.monthly[k])]);
  cfRows.push(['TOTAL CF mensual',mx(q.monthlyTotal)]);
  const cvRows=Object.entries(varUnits).map(([k,label])=>[label,mx(q.variable[k])]);
  cvRows.push(['TOTAL CV del ciclo',mx(q.variableTotal)]);
  const inputs=window.GCIMT?.getParams?.(q.type)||{};
  const fieldDefs=window.GCIMT?.fieldDefs||[];
  const serialized=fieldDefs.map(([key,label,unit])=>[label,n(inputs[key],4)+' '+unit]);
  const warnings=q.warnings.map(x=>`<p>• ${safe(x)}</p>`).join('');
  const fraction=x=>n(x*100,2)+'%';
  return `
   <header><p class="gc-audit-subdued">GeoCost SC · Centro Sur · Documento de trabajo interno</p><h1>Memoria de cálculo de flete</h1><p><strong>Modelo único IMT–GeoRisk · ciclo completo · no es tarifa oficial CEMEX</strong></p>
   <p class="gc-audit-subdued">Generado: ${safe(new Date().toLocaleString('es-MX'))} · MXN sin IVA · No compartir con terceros sin autorización de la empresa.</p></header>
   <h2>01 · Identificación de la operación</h2>
   ${table([['Origen',name],['Destino',dest],['Tipo de transportista',carrier],['Vehículo',q.type],['Fabricante / modelo declarado',model],['Año modelo',String(q.year)],['Producto',q.cargoType==='sacos'?'Cemento en sacos':'Granel'],['Carga por viaje',n(q.loadTons)+' Tn'],['Viajes programados',String(trips)],['Distancia de ida',n(q.kmOneWay)+' km'],['Distancia ciclo',n(q.kmTotal)+' km'],['Perfil de regreso','Misma distancia vial, sentido inverso, sin carga']])}
   ${Object.keys(audit.manualApplied||{}).length?`<div class="gc-audit-warning"><b>Ajustes manuales por ruta:</b> ${Object.entries(audit.manualApplied).map(([k,v])=>safe(k)+' = '+mx(v)).join(' · ')}. Los cuadros de rendimiento y ecuaciones de desgaste describen el cálculo automático; para la tarifa prevalecen los importes reemplazados.</div>`:''}
   <h2>02 · Formulación general IMT</h2>
   ${eq('Costo del ciclo = CF asignado al viaje + CV del ciclo',mx(q.fixedAllocation)+' + '+mx(q.variableTotal)+' = '+mx(q.cost))}
   ${eq('Tarifa de referencia C = Costo del ciclo × (1 + utilidad)',mx(q.cost)+' × (1 + '+n(q.utility,4)+') = '+mx(q.tariff))}
   ${eq('Total de fletes programados = Referencia C × número de viajes',mx(q.tariff)+' × '+trips+' = '+mx(q.tariff*trips))}
   <p class="gc-audit-subdued">Base conceptual: Instituto Mexicano del Transporte, Publicación Técnica 630 (2021). Los valores numéricos y coeficientes de GeoCost son supuestos editables no certificados por el IMT.</p>
   <h2>03 · Distancia y esfuerzo geográfico</h2>
   ${table(roadRows,'Clase GeoRisk (ida)','Longitud reconocida')}
   ${table([['Ascenso muestreado en ida',n(q.ascent)+' m'],['Descenso muestreado en ida',n(q.descent)+' m'],['Altimetría disponible',audit.elevationGood?'Sí':'No: coeficiente por clase vial'],['Proporción urbana',fraction(q.urbanShare)],['Proporción sierra',fraction(q.mountainShare)],['Proporción terracería',fraction(q.dirtShare)],['Cobertura vial clasificada',n(q.classifiedKm,2)+' km'],['Sin clase vial confirmada',n(q.unclassifiedKm,2)+' km']])}
   <p>El modelo diferencia los tramos por superficie, pendiente y uso de la unidad; no asigna un recargo general de montaña a toda la ruta.</p>
   <h2>04 · Rendimiento y litros de diésel</h2>
   ${table([['Rendimiento cargado nominal',n(audit.loadedKmlBase)+' km/L'],['Rendimiento vacío nominal',n(audit.emptyKmlBase)+' km/L'],['Factor de edad en consumo',n(audit.ageFactors.consumption,4)],['Rendimiento cargado ajustado',n(audit.loadedKmlEffective)+' km/L'],['Rendimiento vacío ajustado',n(audit.emptyKmlEffective)+' km/L'],['Factor de carga',n(audit.loadFactor,4)],['Incremento por urbano/terracería',fraction(audit.fuelRoad)],['Factor de subida cargada',fraction(audit.uphillLoaded)],['Factor de regreso vacío',fraction(audit.uphillEmpty)],['Precio diésel aplicado',mx(audit.dieselPrice)+'/L']])}
   ${eq('Litros ida = km ida ÷ rendimiento cargado × factor carga × (1 + vialidad + pendiente)',n(q.kmOneWay)+' ÷ '+n(audit.loadedKmlEffective)+' × '+n(audit.loadFactor)+' × (1 + '+n(audit.fuelRoad,4)+' + '+n(audit.uphillLoaded,4)+') = '+n(q.loadedLitres,3)+' L')}
   ${eq('Litros regreso = km regreso ÷ rendimiento vacío × (1 + vialidad + pendiente)',n(q.kmOneWay)+' ÷ '+n(audit.emptyKmlEffective)+' × (1 + '+n(audit.fuelRoad,4)+' + '+n(audit.uphillEmpty,4)+') = '+n(q.emptyLitres,3)+' L')}
   ${eq('Litros ralentí = consumo ralentí × (demora adicional + espera)',n(audit.idleLph)+' L/h × ('+n(audit.extraDriveH)+' + '+n(audit.queue)+') h = '+n(q.idlingLitres)+' L')}
   ${eq('Costo diésel = (litros ida + regreso + ralentí) × precio por litro',n(q.loadedLitres)+' + '+n(q.emptyLitres)+' + '+n(q.idlingLitres)+' = '+n(q.dieselLitres)+' L × '+mx(audit.dieselPrice)+' = '+mx(q.variable.diesel))}
   <h2>05 · Mantenimiento y desgaste</h2>
   ${table([['Mantenimiento base',mx(audit.maintenanceRateBase)+'/km'],['Factor de edad mantenimiento',n(audit.ageFactors.maintenance,4)],['Mantenimiento base ajustado',mx(audit.maintenanceRateEffective)+'/km'],['Factor adicional superficie / relieve',fraction(audit.maintenanceRoad)],['Cantidad de llantas',n(audit.tyreCount,0)],['Precio por llanta',mx(audit.tyrePrice)],['Vida estimada por juego',n(audit.tyreLife)+' km'],['Factor de edad llantas',n(audit.ageFactors.tires,4)],['Factor desgaste por vialidad',fraction(audit.tyreRoad)]])}
   ${eq('Mantenimiento = 2 × km ida × $/km ajustado × (1 + factor vialidad)',n(q.kmTotal)+' × '+mx(audit.maintenanceRateEffective)+' × (1 + '+n(audit.maintenanceRoad,4)+') = '+mx(q.variable.maintenance))}
   ${eq('Llantas = km ciclo × (cantidad × precio ÷ vida) × factor edad × factor terreno',n(q.kmTotal)+' × ('+n(audit.tyreCount,0)+' × '+mx(audit.tyrePrice)+' ÷ '+n(audit.tyreLife)+') × '+n(audit.ageFactors.tires,4)+' × (1 + '+n(audit.tyreRoad,4)+') = '+mx(q.variable.tires))}
   ${eq('Lubricantes = km ciclo × $/km',n(q.kmTotal)+' × '+mx(audit.lubeRate)+' = '+mx(q.variable.lubricants))}
   ${eq('DEF = litros diésel × consumo relativo DEF × precio DEF',n(q.dieselLitres)+' × '+n(audit.defFraction,4)+' × '+mx(audit.defPrice)+' = '+mx(q.variable.def))}
   <h2>06 · Tiempo operativo y costos fijos</h2>
   ${table([['Horas base de circulación ida y vuelta',n(audit.baseDriveH)+' h'],['Demora vial modelada',n(audit.extraDriveH)+' h'],['Carga y descarga',n(audit.handling)+' h'],['Espera adicional',n(audit.queue)+' h'],['Horas del ciclo',n(q.journeyHours)+' h'],['Capacidad mensual usada',n(q.kmMonth)+' km/mes'],['Horas mensuales disponibles',n(q.monthlyAvailableHours)+' h/mes'],['Pago del operador',audit.operatorMode==='variable'?'Pago variable por km':'Salario fijo y prestaciones (mensual)']])}
   ${table(cfRows,'Costo fijo mensual por unidad','MXN/mes')}
   ${eq('Prorrateo CF por km = CF mensual × km ciclo ÷ km mensuales',mx(q.monthlyTotal)+' × '+n(q.kmTotal)+' ÷ '+n(q.kmMonth)+' = '+mx(q.fixedKm))}
   ${eq('Prorrateo CF por tiempo = CF mensual × horas ciclo ÷ horas disponibles',mx(q.monthlyTotal)+' × '+n(q.journeyHours)+' ÷ '+n(q.monthlyAvailableHours)+' = '+mx(q.fixedTime))}
   ${eq('CF asignado = máx(CF/km, CF/horas)', 'máx('+mx(q.fixedKm)+', '+mx(q.fixedTime)+') = '+mx(q.fixedAllocation)+' · Restricción: '+safe(q.fixedDriver))}
   <h2>07 · Costos variables del ciclo y tarifa</h2>
   ${table(cvRows,'Concepto variable','MXN por ciclo')}
   ${eq('Peajes ida + regreso = 2 × peajes de ida', '2 × '+mx(audit.tollsOneWay)+' = '+mx(q.variable.tolls))}
   ${table([['Costo fijo asignado',mx(q.fixedAllocation)],['Costo variable del ciclo',mx(q.variableTotal)],['Costo técnico del ciclo',mx(q.cost)],['Utilidad',mx(q.profit)+' ('+fraction(q.utility)+')'],['REFERENCIA C',mx(q.tariff)]])}
   <h2>08 · Escala comercial (escenarios, no precios CEMEX)</h2>
   ${table(q.refTiers.map(x=>[x.name+' · +'+n(x.pct)+'% sobre C',mx(x.amount)]),'Escenario','Tarifa ciclo')}
   <p>Fórmula de cada banda: Referencia C × (1 + porcentaje definido). B SPOT sustituye al nombre A. Los incrementos deben calibrarse con tarifas contractuales o cotizaciones verificadas.</p>
   <h2>09 · Inventario completo de parámetros configurables</h2>
   ${table(serialized,'Entrada editable','Valor usado como escenario')}
   <h2>10 · Alertas, fuentes y limitaciones</h2>
   <div class="gc-audit-warning">${warnings}<p>Los costos y coeficientes por tipo/año vehicular requieren comprobación con órdenes de mantenimiento, compras de llantas, litros reales y bitácoras de viaje.</p><p>Esto no sustituye verificación NOM-012, rutas aptas para autotransporte, peajes por sentido ni el comportamiento dinámico de tráfico.</p></div>
   <p><b>Fundamento metodológico:</b> IMT Publicación Técnica 630 (2021), análisis de estructura CF + CV y asignación del fijo; IMT Publicaciones Técnicas 653 y 881 para la relación de costos operativos, geometría y superficie vial. Los porcentajes de GeoRisk y curvas por antigüedad son supuestos particulares del prototipo GeoCoast, no tablas oficiales del IMT.</p>
   <p class="gc-audit-subdued">Generado localmente en el navegador. El código fuente y los parámetros siguen disponibles para cualquier persona con acceso a los archivos de esta aplicación: este botón no es un control de autenticación.</p>`;
 }
 function open(){
  const q=window.geocostIMTQuote;
  if(!q){alert('Traza una ruta y cotízala antes de generar la memoria.');return;}
  try{$('gcAuditBody').innerHTML=body(q);$('gcAuditModal').hidden=false;document.body.classList.add('gc-audit-open');$('gcAuditModal').scrollTop=0;}
  catch(err){alert('No se pudo generar la memoria: '+err.message);}
 }
 function close(){document.body.classList.remove('gc-audit-open','gc-audit-print');$('gcAuditModal').hidden=true;}
 document.addEventListener('DOMContentLoaded',()=>{
  $('gcOpenAudit')?.addEventListener('click',open);
  $('gcAuditClose')?.addEventListener('click',close);
  $('gcAuditPrint')?.addEventListener('click',()=>{document.body.classList.add('gc-audit-print');window.print()});
  window.addEventListener('afterprint',()=>document.body.classList.remove('gc-audit-print'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('gcAuditModal').hidden)close()});
 });
 window.geoCostAudit={open,render:body};
})();
