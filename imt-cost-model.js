/* GeoCost SC — Modelo IMT 630, variante operativa de calibración V1 (2026-10).
 * IMT: CF asignado al viaje + CV(distancia) + utilidad. Los coeficientes por tipo
 * de vehículo, año y pendientes de esta implementación son HIPÓTESIS EDITABLES,
 * NO cifras oficiales IMT ni tarifas reales del mercado.
 * Cálculo puro accesible en Node/browser mediante module.exports y window.GCIMT.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GCIMT=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const defs={
  'Camioneta':{cap:5,kml:7.5,empty:9.0,kmMonth:6000,fixed:{asset:13000,operator:9500,insurance:1800,admin:2300,permit:300,gps:400,patio:700},tires:{count:6,price:3800,life:45000},maintenance:1.0,lubes:.20,def:0,idle:1.2},
  'Rabón':{cap:9,kml:3.6,empty:4.8,kmMonth:7000,fixed:{asset:26000,operator:16500,insurance:3500,admin:3800,permit:600,gps:700,patio:1800},tires:{count:6,price:9000,life:65000},maintenance:1.9,lubes:.35,def:.025,idle:1.7},
  'Torton':{cap:18,kml:3.0,empty:4.1,kmMonth:7500,fixed:{asset:36000,operator:19500,insurance:5700,admin:5100,permit:900,gps:900,patio:2400},tires:{count:10,price:9500,life:70000},maintenance:2.6,lubes:.46,def:.03,idle:1.9},
  'Tráiler':{cap:28,kml:2.5,empty:3.4,kmMonth:9000,fixed:{asset:50000,operator:22500,insurance:11000,admin:6000,permit:1250,gps:1000,patio:3800},tires:{count:18,price:11000,life:80000},maintenance:3.15,lubes:.55,def:.035,idle:2.3},
  'Full':{cap:50,kml:1.65,empty:2.2,kmMonth:10000,fixed:{asset:71000,operator:26000,insurance:14000,admin:7500,permit:1800,gps:1200,patio:5500},tires:{count:26,price:11500,life:80000},maintenance:4.2,lubes:.7,def:.04,idle:2.8}
 };
 const carrierProfiles={
   chico:{fleet:'1–5',exampleUnits:3,admin:.70,patio:.65,utilization:.88},
   mediano:{fleet:'6–15',exampleUnits:10,admin:1,patio:1,utilization:1},
   grande:{fleet:'16+',exampleUnits:25,admin:1.28,patio:1.35,utilization:1.08}
 };
 const tierDefaults=[{id:'C',name:'C',pct:0},{id:'CP',name:'C Prima',pct:4},{id:'B',name:'B',pct:9},{id:'BP',name:'B+',pct:14},{id:'SPOT',name:'B SPOT',pct:20}];
 function references(tariff,premiums){return tierDefaults.map(t=>({id:t.id,name:t.name,pct:Math.max(0,Math.min(100,Number(premiums?.[t.id]??t.pct))),amount:tariff*(1+Math.max(0,Math.min(100,Number(premiums?.[t.id]??t.pct)))/100)}));}
 const classes=['urbano','autopista_sin','autopista_con','pavimento_sin','pavimento_con','terraceria_sin','terraceria_con'];
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
 const val=(obj,k,def=0)=>Number.isFinite(Number(obj?.[k]))&&obj?.[k]!==''&&obj?.[k]!=null?Number(obj[k]):def;
 const sum=xs=>xs.reduce((a,b)=>a+b,0);
 const round=v=>Math.round(v*100)/100;
 // Hipótesis de calibración, NO curva certificada por fabricante o IMT.
 // Su interpolación evita que 2010 y 2019 tengan la misma respuesta por pertenecer a una década.
 const ages=year=>{
   const y=clamp(year,2000,2026),oldness=2026-y;
   return {period:y+' (edad '+oldness+' años)',consumption:Math.max(.76,1-.009*oldness),maintenance:1+.019*oldness,tires:1+.0045*oldness};
 };
 const preset=(kind)=>JSON.parse(JSON.stringify(defs[kind]||defs['Rabón']));
 // Retorna clúster vial ÚNICAMENTE si GeoRisk tiene evidencia; desconocido es explícito.
 function classification(km,items){const ledger=Object.fromEntries(classes.map(k=>[k,0]));for(const item of items||[]){if(classes.includes(item.id))ledger[item.id]+=Math.max(0,Number(item.km)||0)}const known=sum(Object.values(ledger));const valid=known<=km+.1;const unclassified=Math.max(0,km-known);return {ledger,known,unknownKm:unclassified,valid};}
 function quote(input={}){
  const type=input.type||'Rabón',basis=preset(type),one=val(input,'km',0),ton=val(input,'loadTons',basis.cap),year=Math.round(val(input,'year',2022)),cargoType=input.cargoType==='granel'?'granel':'sacos';
  if(!(one>0))throw Error('Distancia de ida inválida');
  if(ton<=0||ton>basis.cap+.001)throw Error('Carga fuera de capacidad de referencia para '+type);
  if(year<2000||year>2026)throw Error('Año de modelo fuera de 2000–2026');
  const age=ages(year),flat=classification(one,input.rows||[]);
  if(!flat.valid)throw Error('Los esfuerzos editados superan la distancia de la ruta; ajusta los kilómetros.');
  const share=id=>flat.ledger[id]/one;
  const mountain=share('autopista_con')+share('pavimento_con')+share('terraceria_con');
  const dirt=share('terraceria_sin')+share('terraceria_con');
  const urban=share('urbano');
  // Muestreo de relieve: ascenso y descenso no equivalen a altitud absoluta.
  // Si faltan muestras, aproximación moderada por clases GeoRisk evidenciadas.
  const elevationGood=input.elevationAvailable===true&&Number.isFinite(Number(input.ascent))&&Number.isFinite(Number(input.descent));
  const ascent=elevationGood?Math.max(0,Number(input.ascent)):0,descent=elevationGood?Math.max(0,Number(input.descent)):0;
  const uphillLoaded=elevationGood?Math.min(.40,ascent/(one*1000)*val(input,'hillSensitivity',12)):mountain*val(input,'hillClassFuel',.23);
  const uphillEmpty=elevationGood?Math.min(.40,descent/(one*1000)*val(input,'hillSensitivity',12)):mountain*val(input,'hillClassFuel',.23);
  const fuelRoad=urban*val(input,'urbanFuelInc',.12)+dirt*val(input,'dirtFuelInc',.15);
  const maintenanceRoad=mountain*val(input,'mountMaintInc',.18)+urban*val(input,'urbanMaintInc',.05)+dirt*val(input,'dirtMaintInc',.27);
  const tyreRoad=mountain*val(input,'mountTireInc',.12)+dirt*val(input,'dirtTireInc',.20);
  const loadFactor=.72+.28*clamp(ton/basis.cap,0,1);
  const kmlLoaded=val(input,'loadedKml',basis.kml)*age.consumption;
  const kmlEmpty=val(input,'emptyKml',basis.empty)*age.consumption;
  const ladenLegLitres=one/Math.max(.1,kmlLoaded)*loadFactor*(1+fuelRoad+uphillLoaded);
  const emptyLegLitres=one/Math.max(.1,kmlEmpty)*(1+fuelRoad+uphillEmpty);
  const baseDriveH=Math.max(.2,val(input,'travelHours',one/55))*2;
  const extraDriveH=baseDriveH*(urban*val(input,'urbanDelay',.18)+mountain*val(input,'mountDelay',.20)+dirt*val(input,'dirtDelay',.23));
  const handling=val(input,'handlingHours',2),queue=val(input,'extraWaitHours',0),journeyHours=baseDriveH+extraDriveH+handling+queue;
  const idlingLitres=val(input,'idleLph',basis.idle)*Math.max(0,extraDriveH+queue)*val(input,'idleEnabled',1);
  const dieselLitres=ladenLegLitres+emptyLegLitres+idlingLitres;
  const dieselPrice=val(input,'dieselPrice',26.99);
  const fuel=dieselLitres*dieselPrice;
  const distance=one*2;
  const maintenanceRate=val(input,'maintenanceRate',basis.maintenance)*age.maintenance;
  const maintenance=distance*maintenanceRate*(1+maintenanceRoad);
  const tyreCount=val(input,'tyreCount',basis.tires.count),tyrePrice=val(input,'tyrePrice',basis.tires.price),tyreLife=val(input,'tyreLife',basis.tires.life);
  const tyres=distance*(tyreCount*tyrePrice/Math.max(1,tyreLife))*age.tires*(1+tyreRoad);
  const lubricants=distance*val(input,'lubricantsRate',basis.lubes);
  const defLitres=dieselLitres*val(input,'defFraction',basis.def);
  const defCost=defLitres*val(input,'defPrice',14);
  const peajes=val(input,'tollsOneWay',0)*2;
  const misc=val(input,'maniobras',0)+val(input,'viaticos',0)+val(input,'custodia',0)+val(input,'lavado',0)+(input.operatorMode==='variable'?distance*val(input,'operatorPerKm',0):0);
  const extraVariable=val(input,'riskExpense',0);
  const fixed=basis.fixed;
  const monthly={asset:val(input,'fixedAsset',fixed.asset),operator:(input.operatorMode==='variable'?0:val(input,'fixedOperator',fixed.operator)),insurance:val(input,'fixedInsurance',fixed.insurance),admin:val(input,'fixedAdmin',fixed.admin)*val(input,'carrierAdminFactor',val(input,'carrierFactor',1)),permit:val(input,'fixedPermit',fixed.permit),gps:val(input,'fixedGps',fixed.gps),patio:val(input,'fixedPatio',fixed.patio)*val(input,'carrierPatioFactor',1)};
  const monthlyTotal=sum(Object.values(monthly));
  const kmMonth=Math.max(1,val(input,'kmMonth',basis.kmMonth)*Math.max(.1,val(input,'carrierUtilizationFactor',1)));
  const monthlyAvailableHours=Math.max(1,val(input,'daysMonth',22)*val(input,'hoursPerDay',10)*Math.max(.1,val(input,'carrierUtilizationFactor',1)));
  // CF/viaje = CFmensual / viajes potenciales. La restricción es la MENOR
  // capacidad entre km mensuales y horas operativas disponibles.
  const fixedKm=monthlyTotal*distance/kmMonth;
  const fixedTime=monthlyTotal*journeyHours/monthlyAvailableHours;
  let fixedAllocation=Math.max(fixedKm,fixedTime);
  const fixedAllocationAutomatic=fixedAllocation;
  const fixedDriver=fixedTime>fixedKm?'Horas operativas':'Kilómetros mensuales';
  const variable={diesel:fuel,maintenance,tires:tyres,lubricants,def:defCost,tolls:peajes,serviceMisc:misc,riskCost:extraVariable};
  const automaticVariable={...variable};
  const manualApplied={};
  for(const [key,amount] of Object.entries(input.manualCosts||{})){
   if(amount===null||amount===undefined||amount==='')continue;
   const override=Number(amount);
   if(!Number.isFinite(override)||override<0)throw Error('Costo manual inválido: '+key);
   if(key==='fixed'){fixedAllocation=override;manualApplied.fixed=override;}
   else if(Object.prototype.hasOwnProperty.call(variable,key)){variable[key]=override;manualApplied[key]=override;}
  }
  const variableTotal=sum(Object.values(variable));
  const cost=fixedAllocation+variableTotal;
  const utility=clamp(val(input,'utility',.08),0,.50);
  const profit=cost*utility;
  const tariff=cost+profit;const refTiers=references(tariff,input.tierPremiums);
  const fees={fixed:fixedAllocation,...variable,utility:profit};
  const audit={manualApplied,automaticVariable,fixedAllocationAutomatic,oneKm:one,roundKm:distance,loadedKmlBase:val(input,'loadedKml',basis.kml),emptyKmlBase:val(input,'emptyKml',basis.empty),loadedKmlEffective:kmlLoaded,emptyKmlEffective:kmlEmpty,
   ageFactors:{...age},loadFactor,fuelRoad,uphillLoaded,uphillEmpty,maintenanceRoad,tyreRoad,
   baseDriveH,extraDriveH,handling,queue,journeyHours,urban,mountain,dirt,ascent,descent,elevationGood,
   dieselPrice,loadedLitres:ladenLegLitres,emptyLitres:emptyLegLitres,idlingLitres,idleLph:val(input,'idleLph',basis.idle),dieselLitres,
   maintenanceRateBase:val(input,'maintenanceRate',basis.maintenance),maintenanceRateEffective:maintenanceRate,
   tyreCount,tyrePrice,tyreLife,lubeRate:val(input,'lubricantsRate',basis.lubes),defFraction:val(input,'defFraction',basis.def),defPrice:val(input,'defPrice',14),
   tollsOneWay:val(input,'tollsOneWay',0),kmMonth,monthlyAvailableHours,operatorMode:input.operatorMode||'fijo',
   utility,year,loadTons:ton,cargoType,roadKm:{...flat.ledger},params:Object.fromEntries(Object.keys(input).filter(k=>typeof input[k]==='number'||typeof input[k]==='string').map(k=>[k,input[k]]))};
  const warnings=[];
  if(flat.unknownKm>0.1)warnings.push(`${round(flat.unknownKm)} km de la ida no tienen clase vial confirmada; se calcularon con condiciones base.`);
  if(!elevationGood)warnings.push('Sin perfil de elevación confiable: ascensos aproximados solo con clases GeoRisk disponibles, sin inventar altitudes.');
  warnings.push('El regreso se aproxima con los mismos km, en sentido inverso y unidad vacía; no existe ruteo independiente de retorno ni casetas asimétricas.');
  if(input.operatorMode==='variable'&&val(input,'operatorPerKm',0)<=0)warnings.push('Pago por km seleccionado: falta asignar remuneración variable al operador.');
  if(Object.keys(manualApplied).length)warnings.push('La tarifa incluye rubros ajustados manualmente ('+Object.keys(manualApplied).join(', ')+'). Los litros y factores técnicos muestran el valor automático; las cifras manuales prevalecen para cotizar.');
  warnings.push('Rendimientos y ajustes por año, carga y terreno son supuestos preliminares; fabricante/modelo no asigna una ficha técnica sin medición y deben calibrarse con litros y kilometraje reales de la flotilla.');
  return {type,year,age:age.period,cargoType,kmOneWay:one,kmTotal:distance,loadTons:ton,journeyHours,monthlyTotal,monthly,fixedAllocation,fixedKm,fixedTime,fixedDriver,variable,variableTotal,cost,utility,profit,tariff,refTiers,carrierAdminFactor:val(input,'carrierAdminFactor',val(input,'carrierFactor',1)),carrierPatioFactor:val(input,'carrierPatioFactor',1),carrierUtilizationFactor:val(input,'carrierUtilizationFactor',1),fees,dieselLitres,loadedLitres:ladenLegLitres,emptyLitres:emptyLegLitres,idlingLitres,defLitres,ascent,descent,uphillLoaded,uphillEmpty,mountainShare:mountain,urbanShare:urban,dirtShare:dirt,classifiedKm:flat.known,unclassifiedKm:flat.unknownKm,monthlyAvailableHours,kmMonth,warnings,audit};
 }
 const $=id=>typeof document==='undefined'?null:document.getElementById(id);
 const v=(id,def)=>{const el=$(id);return el&&!Number.isNaN(Number(el.value))&&el.value!==''?Number(el.value):def};
 const fmt=x=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(x);
 const num=x=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(x);
 const fieldDefs=[
  ['kmMonth','Kilómetros al mes','km/mes'],['daysMonth','Días operativos mensuales','días'],['hoursPerDay','Horas útiles al día','h'],
  ['loadedKml','Rendimiento cargado','km/L'],['emptyKml','Rendimiento vacío','km/L'],
  ['fixedAsset','Depreciación / arrendamiento o costo financiero sin duplicar','MXN/mes'],['fixedOperator','Operador fijo + prestaciones','MXN/mes'],['fixedInsurance','Seguro vehicular y carga (prorrateado)','MXN/mes'],['fixedAdmin','Administración / tráfico','MXN/mes'],['fixedPermit','Permisos / derechos','MXN/mes'],['fixedGps','GPS','MXN/mes'],['fixedPatio','Patio / base','MXN/mes'],
  ['maintenanceRate','Mantenimiento preventivo y correctivo','MXN/km'],['tyreCount','Número de llantas','pzas'],['tyrePrice','Precio por llanta','MXN'],['tyreLife','Vida por juego','km'],['lubricantsRate','Aceites / lubricantes','MXN/km'],['defFraction','DEF (litros/litro diésel)','L/L'],['defPrice','Precio DEF','MXN/L'],['idleLph','Consumo en ralentí','L/h'],
  ['urbanFuelInc','Recargo urbano de diésel (sobre tramo)','fracción'],['dirtFuelInc','Recargo terracería diésel','fracción'],['hillClassFuel','Recargo provisional de diésel en sierra sin elevación','fracción'],['hillSensitivity','Sensibilidad a ascenso','coeficiente'],['mountMaintInc','Recargo mantenimiento en sierra','fracción'],['mountTireInc','Recargo llantas en sierra','fracción'],['dirtMaintInc','Recargo mantenimiento terracería','fracción'],['urbanMaintInc','Recargo mantenimiento urbano','fracción'],['dirtTireInc','Recargo llantas terracería','fracción'],['urbanDelay','Demora adicional urbana','fracción'],['mountDelay','Demora adicional montaña','fracción'],['dirtDelay','Demora adicional terracería','fracción'],
  ['extraWaitHours','Espera adicional','h'],['maniobras','Maniobras del ciclo','MXN'],['viaticos','Viáticos del ciclo','MXN'],['custodia','Custodia','MXN'],['lavado','Lavado / otros','MXN'],['operatorPerKm','Pago operador por km (0 si sueldo fijo)','MXN/km'],['riskExpense','Riesgo/custodia extraordinaria justificada','MXN']
 ];
 const overrides=new Map();let syncedType='';
 function getParams(type=$('vehiculo')?.value||'Rabón'){const basis=preset(type);const custom=overrides.get(type)||{};const p={...custom};for(const [id] of fieldDefs){const el=$('imt_'+id);if(type===syncedType&&el)p[id]=v('imt_'+id,p[id]??defaultVal(id,basis));else p[id]=p[id]??defaultVal(id,basis);}return p;}
 function defaultVal(id,b){return ({loadedKml:b.kml,emptyKml:b.empty,kmMonth:b.kmMonth,daysMonth:22,hoursPerDay:10,
    fixedAsset:b.fixed.asset,fixedOperator:b.fixed.operator,fixedInsurance:b.fixed.insurance,fixedAdmin:b.fixed.admin,fixedPermit:b.fixed.permit,fixedGps:b.fixed.gps,fixedPatio:b.fixed.patio,
    maintenanceRate:b.maintenance,tyreCount:b.tires.count,tyrePrice:b.tires.price,tyreLife:b.tires.life,lubricantsRate:b.lubes,defFraction:b.def,defPrice:14,idleLph:b.idle,
    urbanFuelInc:.12,dirtFuelInc:.15,hillClassFuel:.23,hillSensitivity:12,mountMaintInc:.18,mountTireInc:.12,dirtMaintInc:.27,urbanMaintInc:.05,dirtTireInc:.20,urbanDelay:.18,mountDelay:.20,dirtDelay:.23,
    extraWaitHours:0,maniobras:0,viaticos:0,custodia:0,lavado:0,operatorPerKm:0,riskExpense:0})[id]??0;}
 function syncUI(type){if(!$('imtParameters'))return;const p=overrides.get(type)||{},b=preset(type);syncedType=type;for(const [id] of fieldDefs){const el=$('imt_'+id);if(el)el.value=p[id]??defaultVal(id,b)};const label=$('imtUnitsLabel');if(label)label.textContent=`Parámetros: ${type} · supuestos configurables (2000–2026)`;}
 function prepare(){const pane=$('imtParameters');if(!pane)return;
  pane.innerHTML=fieldDefs.map(([id,label,unit])=>`<label class="imt-field"><span>${label} <small>${unit}</small></span><input type="number" id="imt_${id}" data-imtfield="${id}" min="0" step="any"/></label>`).join('');
  syncUI($('vehiculo')?.value||'Rabón');
  pane.addEventListener('input',e=>{const id=e.target?.dataset.imtfield;if(!id)return;const entry=overrides.get(syncedType)||{};entry[id]=Math.max(0,Number(e.target.value)||0);overrides.set(syncedType,entry);document.dispatchEvent(new Event('geocoast:imt-edit'));});
  $('imtReset')?.addEventListener('click',()=>{overrides.delete($('vehiculo')?.value||'Rabón');syncUI($('vehiculo')?.value||'Rabón');document.dispatchEvent(new Event('geocoast:imt-edit'));});
  $('vehiculo')?.addEventListener('change',()=>{syncUI($('vehiculo').value);document.dispatchEvent(new Event('geocoast:imt-edit'));});
  for(const id of ['imtModelYear','imtUtility','imtEnabled','imtOperatorMode'])$(id)?.addEventListener('change',()=>document.dispatchEvent(new Event('geocoast:imt-edit')));
 }
 function active(){return Boolean($('imtEnabled')?.checked!==false);}
 function fromApp(r,elevation,rows,opts={}){
  const type=opts.type||$('vehiculo')?.value||'Rabón',basis=preset(type),e=elevation?.length>1?elevation:null;
  const asc=e?e.slice(1).reduce((sum,p,i)=>sum+Math.max(0,(Number(p.e)||0)-(Number(e[i].e)||0)),0):0;
  const desc=e?e.slice(1).reduce((sum,p,i)=>sum+Math.max(0,(Number(e[i].e)||0)-(Number(p.e)||0)),0):0;
  return quote({type,cargoType:$('granel')?.classList.contains('selected')?'granel':'sacos',km:r.km,loadTons:opts.loadTons??v('ton',basis.cap),year:v('imtModelYear',2022),rows:rows||[],ascent:asc,descent:desc,elevationAvailable:!!e,travelHours:r.h,dieselPrice:window.GCFuel?.getPrice?.()||v('diesel',26.99),tollsOneWay:v('tolls',0),handlingHours:v('handling',2),utility:v('imtUtility',8)/100,operatorMode:$('imtOperatorMode')?.value||'fijo',carrierFactor:1,
   carrierAdminFactor:v('gcCarrierAdmin_'+($('tipoTransportista')?.value||'mediano'), carrierProfiles[$('tipoTransportista')?.value||'mediano'].admin),
   carrierPatioFactor:v('gcCarrierPatio_'+($('tipoTransportista')?.value||'mediano'),carrierProfiles[$('tipoTransportista')?.value||'mediano'].patio),
   carrierUtilizationFactor:v('gcCarrierUtil_'+($('tipoTransportista')?.value||'mediano'),carrierProfiles[$('tipoTransportista')?.value||'mediano'].utilization),
   tierPremiums:Object.fromEntries(tierDefaults.map(t=>[t.id,v('gcTier_'+t.id,t.pct)])),manualCosts:opts.includeManualCosts===false?{}:Object.fromEntries(['fixed','diesel','maintenance','tires','lubricants','def','tolls','serviceMisc','riskCost'].map(id=>[id,$('gcManual_'+id)?.value??'']).filter(([id,value])=>value!=='')),...getParams(type)});
 }
 function render(q){
  const trips=Math.max(1,Math.round(v('numeroViajes',1)));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refRows=q.refTiers.map((t,i)=>`<tr ${i===0?'class="gc-reference-base"':''}><td><strong>${esc(t.name)}</strong></td><td>${i===0?'Base':'+'+num(t.pct)+'%'}</td><td><b>${fmt(t.amount)}</b></td><td>${fmt(t.amount/q.kmTotal)}/km</td></tr>`).join('');
  const mlo=v('gcMarketMin',0),mhi=v('gcMarketMax',0),ms=$('gcMarketSource')?.value?.trim()||'';
  const market=mlo>0&&mhi>=mlo?`<p class="gc-market-note">Ofertas comparables capturadas: ${fmt(mlo)}–${fmt(mhi)}${ms?' · '+esc(ms):''}. Referencia C: ${q.tariff<mlo?'inferior al mínimo':q.tariff>mhi?'superior al máximo':'dentro del intervalo'}.</p>`:'<p class="hint">Mercado: sin ofertas documentadas de esta ruta y configuración.</p>';
  return `<section class="gc-client-quote"><div class="costhero"><small>Modelo único IMT–GeoRisk · ciclo integral A → B → A · ${esc(q.type)} modelo ${q.year} · ${esc(q.cargoType)}</small><strong>${fmt(q.tariff)}</strong><small>Referencia C · utilidad parametrizada ${num(q.utility*100)}% · sin IVA</small></div>
  <div class="metricgrid"><div class="metric"><small>Distancia total del ciclo</small><b>${num(q.kmTotal)} km</b></div><div class="metric"><small>Carga</small><b>${num(q.loadTons)} Tn</b></div><div class="metric"><small>Viajes programados</small><b>${trips}</b></div><div class="metric"><small>Total C por todos los viajes</small><b>${fmt(q.tariff*trips)}</b></div><div class="metric"><small>Tarifa por Tn</small><b>${fmt(q.tariff/q.loadTons)}</b></div><div class="metric"><small>Tarifa por km del ciclo</small><b>${fmt(q.tariff/q.kmTotal)}</b></div></div>
  <details class="imt-expander" open><summary>Referencias comerciales propuestas</summary><table class="priceTable gc-ref-table"><thead><tr><td>Referencia</td><td>Sobre C</td><td>MXN/ciclo</td><td>MXN/km</td></tr></thead><tbody>${refRows}</tbody></table><p class="hint">C, C Prima, B, B+ y B SPOT son escenarios internos editables, no categorías tarifarias oficiales de CEMEX.</p>${market}</details>
  ${(()=>{const fixedNames={asset:'Depreciación / arrendamiento',operator:'Operador fijo y prestaciones',insurance:'Seguros',admin:'Administración y tráfico',permit:'Permisos y derechos',gps:'GPS y monitoreo',patio:'Patio / infraestructura'};
      const variableNames={diesel:'Diésel (ida cargada + vuelta vacía)',maintenance:'Mantenimiento',tires:'Llantas',lubricants:'Lubricantes',def:'DEF / AdBlue',tolls:'Peajes ida y vuelta',serviceMisc:'Maniobras, viáticos y servicios',riskCost:'Custodia / riesgo extraordinario'};
      const pct=x=>q.tariff>0?num(100*x/q.tariff)+'%':'—';
      const tr=(name,amount,detail='')=>`<tr><td>${esc(name)}${detail?'<small class="gc-rubro-note">'+esc(detail)+'</small>':''}</td><td>${fmt(amount)}</td><td>${pct(amount)}</td></tr>`;
      const cf=q.monthlyTotal?Object.entries(fixedNames).map(([k,name])=>tr(name,q.fixedAllocation*(q.monthly[k]||0)/q.monthlyTotal)):[];
      const cv=Object.entries(variableNames).map(([k,name])=>tr(name,q.variable[k]||0,q.audit?.manualApplied&&Object.hasOwn(q.audit.manualApplied,k)?'Ajuste manual':'Cálculo automático'));
      return `<details class="imt-expander gc-cost-breakdown" open><summary>Desglose de costos · MXN y participación</summary><div class="gc-cost-kpis"><b>Distancia total: ${num(q.kmTotal)} km</b><b>Utilidad: ${num(q.utility*100)}% sobre costo</b></div><p class="hint">Los porcentajes indican la participación en la <b>tarifa C antes de IVA</b>. Varían con vehículo, distancia, pendiente y los ajustes manuales. Los fijos se prorratean a este ciclo.</p><table class="gc-cost-table"><thead><tr><th>Concepto</th><th>MXN</th><th>% tarifa</th></tr></thead><tbody><tr class="gc-cost-group"><td>Costos fijos del ciclo</td><td>${fmt(q.fixedAllocation)}</td><td>${pct(q.fixedAllocation)}</td></tr>${cf.join('')}<tr class="gc-cost-group"><td>Costos variables del ciclo</td><td>${fmt(q.variableTotal)}</td><td>${pct(q.variableTotal)}</td></tr>${cv.join('')}<tr class="gc-cost-group"><td>Costo técnico (sin utilidad)</td><td>${fmt(q.cost)}</td><td>${pct(q.cost)}</td></tr>${tr('Utilidad ('+num(q.utility*100)+'% del costo)',q.profit)}<tr class="gc-cost-total"><td>Tarifa C total (sin IVA)</td><td>${fmt(q.tariff)}</td><td>100%</td></tr></tbody></table><p class="hint">Puedes editar cada gasto en <b>Configurar costos → Ajustes por ruta</b>; deja vacío para usar su cálculo automático.</p></details>`;
   })()}
  <p class="hint">La memoria detallada de costos, fórmulas y factores se genera desde Configurar costos → Memoria técnica (uso interno).</p></section>`;
 }
 return {defs,carrierProfiles,tierDefaults,references,preset,classification,quote,prepare,getParams,fieldDefs,syncUI,fromApp,render,active};
});
