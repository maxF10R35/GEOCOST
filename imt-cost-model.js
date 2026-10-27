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
   chico:{fleet:'1–5',exampleUnits:3,admin:.70,patio:.65,utilization:1},
   mediano:{fleet:'6–15',exampleUnits:10,admin:1,patio:1,utilization:1},
   grande:{fleet:'16+',exampleUnits:25,admin:1.28,patio:1.35,utilization:1}
 };
 const tierDefaults=[{id:'C',name:'C',pct:0},{id:'CP',name:'C´',pct:4},{id:'B',name:'B',pct:9},{id:'BP',name:'B+',pct:14},{id:'SPOT',name:'B SPOT',pct:20}];
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
 // Categorización propia de GeoCoast GC-FIS (fuente OSM). Los kilómetros desconocidos son explícitos.
 function classification(km,items){const ledger=Object.fromEntries(classes.map(k=>[k,0]));for(const item of items||[]){if(classes.includes(item.id))ledger[item.id]+=Math.max(0,Number(item.km)||0)}const known=sum(Object.values(ledger));const valid=known<=km+.1;const unclassified=Math.max(0,km-known);return {ledger,known,unknownKm:unclassified,valid};}
 function quote(input={}){
  const type=input.type||'Rabón',basis=preset(type),one=val(input,'km',0),ton=val(input,'loadTons',basis.cap),year=Math.round(val(input,'year',2022)),cargoType=input.cargoType==='granel'?'granel':'sacos';
  if(!(one>0))throw Error('Distancia de ida inválida');
  if(ton<=0||ton>basis.cap+.001)throw Error('Carga fuera de capacidad de referencia para '+type);
  if(year<2000||year>2026)throw Error('Año de modelo fuera de 2000–2026');
  const age=ages(year),flat=classification(one,input.rows||[]);
  if(!flat.valid)throw Error('Las clases viales introducidas superan la distancia de la ruta; ajusta los kilómetros.');
  const share=id=>flat.ledger[id]/one;
  const mountain=share('autopista_con')+share('pavimento_con')+share('terraceria_con');
  const dirt=share('terraceria_sin')+share('terraceria_con');
  const urban=share('urbano');
  const pavement=share('pavimento_sin')+share('pavimento_con');
  const roughSurface=urban+0.45*pavement+dirt; // indicador explicativo, NO un multiplicador de tarifa
  // Muestreo de relieve: ascenso y descenso no equivalen a altitud absoluta.
  // Sin perfil altimétrico no se inventa un ascenso, sólo se usan clases superficiales conocidas.
  const elevationGood=input.elevationAvailable===true&&Number.isFinite(Number(input.ascent))&&Number.isFinite(Number(input.descent));
  const ascent=elevationGood?Math.max(0,Number(input.ascent)):0,descent=elevationGood?Math.max(0,Number(input.descent)):0;
  const uphillLoaded=elevationGood?Math.min(.40,ascent/(one*1000)*val(input,'hillSensitivity',12)):0;
  const uphillEmpty=elevationGood?Math.min(.40,descent/(one*1000)*val(input,'hillSensitivity',12)):0;
  // Participación kilométrica: cada ruta y su mezcla vial tiene ajustes propios.
  // No se aplica un % fijo al flete; los incrementos afectan litros y desgaste.
  const fuelRoad=urban*val(input,'urbanFuelInc',.12)+pavement*val(input,'pavedFuelInc',.035)+dirt*val(input,'dirtFuelInc',.15);
  const measuredWear=elevationGood?Math.min(.45,(ascent+descent)/(one*1000)*val(input,'gradeWearSensitivity',10)):0;
  const maintenanceRoad=measuredWear+urban*val(input,'urbanMaintInc',.05)+pavement*val(input,'pavedMaintInc',.06)+dirt*val(input,'dirtMaintInc',.27);
  const tyreRoad=measuredWear*.5+urban*val(input,'urbanTireInc',.025)+pavement*val(input,'pavedTireInc',.045)+dirt*val(input,'dirtTireInc',.20);
  const suspensionRoad=measuredWear*val(input,'suspGradeFactor',1.2)+urban*val(input,'suspUrbanInc',.10)+pavement*val(input,'suspPavedInc',.12)+dirt*val(input,'suspDirtInc',.48);
  const loadFactor=.72+.28*clamp(ton/basis.cap,0,1);
  const kmlLoaded=val(input,'loadedKml',basis.kml)*age.consumption;
  const kmlEmpty=val(input,'emptyKml',basis.empty)*age.consumption;
  const ladenLegLitres=one/Math.max(.1,kmlLoaded)*loadFactor*(1+fuelRoad+uphillLoaded);
  const emptyLegLitres=one/Math.max(.1,kmlEmpty)*(1+fuelRoad+uphillEmpty);
  const baseDriveH=Math.max(.2,val(input,'travelHours',one/55))*2;
  const mountainDelay=elevationGood?Math.min(.25,(ascent+descent)/(one*1000)*val(input,'gradeTimeSensitivity',6)):0;
  const extraDriveH=baseDriveH*(urban*val(input,'urbanDelay',.18)+mountainDelay+dirt*val(input,'dirtDelay',.23));
  const handling=val(input,'handlingHours',2),queue=val(input,'extraWaitHours',0),journeyHours=baseDriveH+extraDriveH+handling+queue;
  const idlingLitres=val(input,'idleLph',basis.idle)*Math.max(0,extraDriveH+queue)*val(input,'idleEnabled',1);
  const dieselLitres=ladenLegLitres+emptyLegLitres+idlingLitres;
  // La fuente estatal suele presentar precios al público (con IVA). El cálculo
  // comercial excluye IVA cuando se indica que el precio de entrada lo incluye.
  // Entrada directa quote(): sin descuento salvo que dieselPriceIncludesIVA=true.
  // fromApp(): marcador de IVA activado por defecto para precios estatales/manuales.
  const dieselPriceInput=val(input,'dieselPrice',NaN);
  if(!Number.isFinite(dieselPriceInput)||dieselPriceInput<10||dieselPriceInput>60)throw Error('Precio estatal de diésel pendiente o inválido; espera el cálculo por estados o habilita el precio manual.');
  const dieselIncludesIVA=input.dieselPriceIncludesIVA===true;
  const dieselIVA=0.16;
  const dieselPrice=dieselIncludesIVA?dieselPriceInput/(1+dieselIVA):dieselPriceInput;
  const fuel=dieselLitres*dieselPrice;
  const distance=one*2;
  const maintenanceRate=val(input,'maintenanceRate',basis.maintenance)*age.maintenance;
  // La suspensión proviene del MISMO presupuesto/km de mantenimiento base.
  // Dividirlo evita duplicar costos de refacciones/taller; sólo cambia el desgaste por ruta.
  const suspensionShare=clamp(val(input,'suspensionShare',.18),0,.60);
  const maintenance=distance*maintenanceRate*(1-suspensionShare)*(1+maintenanceRoad);
  const suspension=distance*maintenanceRate*suspensionShare*(1+suspensionRoad);
  const tyreCount=val(input,'tyreCount',basis.tires.count),tyrePrice=val(input,'tyrePrice',basis.tires.price),tyreLife=val(input,'tyreLife',basis.tires.life);
  const tyres=distance*(tyreCount*tyrePrice/Math.max(1,tyreLife))*age.tires*(1+tyreRoad);
  const lubricants=distance*val(input,'lubricantsRate',basis.lubes);
  const defLitres=dieselLitres*val(input,'defFraction',basis.def);
  const defCost=defLitres*val(input,'defPrice',14);
  // El tarifario CAPUFE/FONADIN publica cuotas con IVA. Para costeo se elimina
  // el IVA del importe de un sentido ANTES de aproximar el regreso.
  const tollsOneWayInput=val(input,'tollsOneWay',0);
  const tollsIncludesIVA=input.tollsPriceIncludesIVA===true;
  const tollsIVA=0.16;
  const tollsOneWayNet=tollsIncludesIVA?tollsOneWayInput/(1+tollsIVA):tollsOneWayInput;
  const peajes=tollsOneWayNet*2;
  const perDiem=journeyHours>val(input,'viaticoUmbralHrs',8)?val(input,'viaticoDia',350)*Math.max(1,Math.ceil((journeyHours-val(input,'viaticoUmbralHrs',8))/24)):0;
  const misc=val(input,'maniobras',0)+perDiem+val(input,'viaticos',0)+val(input,'custodia',0)+val(input,'lavado',0)+(input.operatorMode==='variable'?distance*val(input,'operatorPerKm',0):0);
  const extraVariable=val(input,'riskExpense',0);
  const fixed=basis.fixed;
  const monthly={asset:val(input,'fixedAsset',fixed.asset),operator:(input.operatorMode==='variable'?0:val(input,'fixedOperator',fixed.operator)),insurance:val(input,'fixedInsurance',fixed.insurance),admin:val(input,'fixedAdmin',fixed.admin)*val(input,'carrierAdminFactor',val(input,'carrierFactor',1)),permit:val(input,'fixedPermit',fixed.permit),gps:val(input,'fixedGps',fixed.gps),patio:val(input,'fixedPatio',fixed.patio)*val(input,'carrierPatioFactor',1),workshopLabor:val(input,'fixedWorkshopLabor',0)};
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
  const variable={diesel:fuel,maintenance,suspension,tires:tyres,lubricants,def:defCost,tolls:peajes,serviceMisc:misc,riskCost:extraVariable};
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
   ageFactors:{...age},loadFactor,fuelRoad,uphillLoaded,uphillEmpty,maintenanceRoad,tyreRoad,suspensionRoad,suspensionShare,measuredWear,mountainDelay,perDiem,roughSurface,pavement,urban,dirt,
   baseDriveH,extraDriveH,handling,queue,journeyHours,mountain,ascent,descent,elevationGood,
   dieselPrice,dieselPriceInput,dieselIncludesIVA,dieselIVA,loadedLitres:ladenLegLitres,emptyLitres:emptyLegLitres,idlingLitres,idleLph:val(input,'idleLph',basis.idle),dieselLitres,
   maintenanceRateBase:val(input,'maintenanceRate',basis.maintenance),maintenanceRateEffective:maintenanceRate,
   tyreCount,tyrePrice,tyreLife,lubeRate:val(input,'lubricantsRate',basis.lubes),defFraction:val(input,'defFraction',basis.def),defPrice:val(input,'defPrice',14),
   tollsOneWay:tollsOneWayInput,tollsOneWayNet,tollsIncludesIVA,tollsIVA,tollStatus:input.tollStatus||'no-registrado',kmMonth,monthlyAvailableHours,operatorMode:input.operatorMode||'fijo',
   utility,year,loadTons:ton,cargoType,roadKm:{...flat.ledger},params:Object.fromEntries(Object.keys(input).filter(k=>typeof input[k]==='number'||typeof input[k]==='string').map(k=>[k,input[k]]))};
  const warnings=[];
  if(flat.unknownKm>0.1)warnings.push(`${round(flat.unknownKm)} km de la ida no tienen clase vial confirmada; se calcularon con condiciones base.`);
  if(!elevationGood)warnings.push('Sin perfil de elevación confiable: sin recargo de pendiente; no se inventa altimetría.');
  warnings.push('El regreso se aproxima con los mismos km, en sentido inverso y unidad vacía; no existe ruteo independiente de retorno ni casetas asimétricas.');
  if(['pending','partial','unavailable','no-registrado'].includes(input.tollStatus))warnings.push('Casetas: detección geográfica parcial o pendiente; el monto automático no representa el total garantizado de todos los tramos/concesiones.');
  if(input.operatorMode==='variable'&&val(input,'operatorPerKm',0)<=0)warnings.push('Pago por km seleccionado: falta asignar remuneración variable al operador.');
  if(Object.keys(manualApplied).length)warnings.push('La tarifa incluye rubros ajustados manualmente ('+Object.keys(manualApplied).join(', ')+'). Los litros y factores técnicos muestran el valor automático; las cifras manuales prevalecen para cotizar.');
  warnings.push('Modelo GC-FIS independiente de índices GeoRisk; las clases sin evidencia OSM se costean como base y reducen la confianza del cálculo.');
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
  ['fixedAsset','Depreciación / arrendamiento o costo financiero sin duplicar','MXN/mes'],['fixedOperator','Operador fijo + prestaciones','MXN/mes'],['fixedInsurance','Seguro vehicular y carga (prorrateado)','MXN/mes'],['fixedAdmin','Administración / tráfico','MXN/mes'],['fixedWorkshopLabor','Mano de obra fija de mantenimiento (si aplica)','MXN/mes'],['fixedPermit','Permisos / derechos','MXN/mes'],['fixedGps','GPS','MXN/mes'],['fixedPatio','Patio / base','MXN/mes'],
  ['maintenanceRate','Mantenimiento total base (incluye suspensión)','MXN/km'],['suspensionShare','Proporción base dedicada a suspensión','0–1'],['tyreCount','Número de llantas','pzas'],['tyrePrice','Precio por llanta','MXN'],['tyreLife','Vida por juego','km'],['lubricantsRate','Aceites / lubricantes','MXN/km'],['defFraction','DEF (litros/litro diésel)','L/L'],['defPrice','Precio DEF','MXN/L'],['idleLph','Consumo en ralentí','L/h'],
  ['urbanFuelInc','Consumo adicional urbano','fracción'],['pavedFuelInc','Consumo adicional pavimento','fracción'],['dirtFuelInc','Consumo adicional terracería','fracción'],['hillSensitivity','Sensibilidad a ascenso','coeficiente'],['dirtMaintInc','Mantenimiento adicional terracería','fracción'],['urbanMaintInc','Mantenimiento adicional urbano','fracción'],['pavedMaintInc','Mantenimiento adicional pavimento','fracción'],['urbanTireInc','Desgaste llantas urbano','fracción'],['pavedTireInc','Desgaste llantas pavimento','fracción'],['dirtTireInc','Desgaste llantas terracería','fracción'],
  ['suspUrbanInc','Desgaste suspensión urbano','fracción'],['suspPavedInc','Desgaste suspensión pavimento','fracción'],['suspDirtInc','Desgaste suspensión terracería','fracción'],['suspGradeFactor','Sensibilidad suspensión a pendiente','factor'],['urbanDelay','Demora adicional urbana','fracción'],['gradeTimeSensitivity','Demora por pendiente medida','factor'],['dirtDelay','Demora adicional terracería','fracción'],
  ['gradeWearSensitivity','Sensibilidad mantenimiento a ascensos/descensos','factor'],['viaticoDia','Viático por jornada prolongada','MXN/jornada'],['viaticoUmbralHrs','Inicio de viáticos después de','h'],['extraWaitHours','Espera adicional','h'],['maniobras','Maniobras del ciclo','MXN'],['viaticos','Viáticos adicionales del ciclo','MXN'],['custodia','Custodia','MXN'],['lavado','Lavado / otros','MXN'],['operatorPerKm','Pago operador por km (0 si sueldo fijo)','MXN/km'],['riskExpense','Riesgo/custodia extraordinaria justificada','MXN']
 ];
 const overrides=new Map();let syncedType='';
 function getParams(type=$('vehiculo')?.value||'Rabón'){const basis=preset(type);const custom=overrides.get(type)||{};const p={...custom};for(const [id] of fieldDefs){const el=$('imt_'+id);if(type===syncedType&&el)p[id]=v('imt_'+id,p[id]??defaultVal(id,basis));else p[id]=p[id]??defaultVal(id,basis);}return p;}
 function defaultVal(id,b){return ({loadedKml:b.kml,emptyKml:b.empty,kmMonth:b.kmMonth,daysMonth:22,hoursPerDay:10,
    fixedAsset:b.fixed.asset,fixedOperator:b.fixed.operator,fixedInsurance:b.fixed.insurance,fixedAdmin:b.fixed.admin,fixedWorkshopLabor:0,fixedPermit:b.fixed.permit,fixedGps:b.fixed.gps,fixedPatio:b.fixed.patio,
    maintenanceRate:b.maintenance,suspensionShare:.18,tyreCount:b.tires.count,tyrePrice:b.tires.price,tyreLife:b.tires.life,lubricantsRate:b.lubes,defFraction:b.def,defPrice:14,idleLph:b.idle,
    urbanFuelInc:.12,pavedFuelInc:.035,dirtFuelInc:.15,hillSensitivity:12,dirtMaintInc:.27,urbanMaintInc:.05,pavedMaintInc:.06,dirtTireInc:.20,urbanTireInc:.025,pavedTireInc:.045,suspUrbanInc:.10,suspPavedInc:.12,suspDirtInc:.48,suspGradeFactor:1.2,urbanDelay:.18,gradeTimeSensitivity:6,dirtDelay:.23,
    gradeWearSensitivity:10,viaticoDia:350,viaticoUmbralHrs:8,extraWaitHours:0,maniobras:180,viaticos:0,custodia:0,lavado:60,operatorPerKm:0,riskExpense:0})[id]??0;}
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
  return quote({type,cargoType:$('granel')?.classList.contains('selected')?'granel':'sacos',km:r.km,loadTons:opts.loadTons??v('ton',basis.cap),year:v('imtModelYear',2022),rows:opts.roadRows??rows??[],ascent:opts.ascent??asc,descent:opts.descent??desc,elevationAvailable:opts.elevationAvailable??!!e,travelHours:r.h,dieselPrice:opts.dieselPrice??window.GCFuel?.getPrice?.(),dieselPriceIncludesIVA:opts.dieselPriceIncludesIVA??true,tollsPriceIncludesIVA:opts.tollsPriceIncludesIVA??true,tollStatus:r.tollStatus||'pending',tollsOneWay:opts.includeManualCosts===false?Math.max(0,Number(r.tollsOneWay)||0):v('tolls',0),handlingHours:v('handling',2),utility:v('imtUtility',8)/100,operatorMode:$('imtOperatorMode')?.value||'fijo',carrierFactor:1,
   carrierAdminFactor:v('gcCarrierAdmin_'+($('tipoTransportista')?.value||'mediano'), carrierProfiles[$('tipoTransportista')?.value||'mediano'].admin),
   carrierPatioFactor:v('gcCarrierPatio_'+($('tipoTransportista')?.value||'mediano'),carrierProfiles[$('tipoTransportista')?.value||'mediano'].patio),
   carrierUtilizationFactor:v('gcCarrierUtil_'+($('tipoTransportista')?.value||'mediano'),carrierProfiles[$('tipoTransportista')?.value||'mediano'].utilization),
   tierPremiums:Object.fromEntries(tierDefaults.map(t=>[t.id,v('gcTier_'+t.id,t.pct)])),manualCosts:opts.includeManualCosts===false?{}:Object.fromEntries(['fixed','diesel','maintenance','suspension','tires','lubricants','def','tolls','serviceMisc','riskCost'].map(id=>[id,$('gcManual_'+id)?.value??'']).filter(([id,value])=>value!=='')),...getParams(type)});
 }
 function executiveBreakdown(q){
  // Única fuente de las participaciones: costos efectivamente calculados para ESTA cotización.
  // La captura visual de presupuesto 2027 define nombres y presentación, no porcentajes fijos.
  const positive=n=>Math.max(0,Number(n)||0);
  const cost=positive(q?.cost),variable=q?.variable||{},monthly=q?.monthly||{};
  const monthlyTotal=positive(q?.monthlyTotal),fixedAllocation=positive(q?.fixedAllocation);
  const fixedPart=id=>monthlyTotal>0?fixedAllocation*positive(monthly[id])/monthlyTotal:0;
  // Si el operador cobra por km, su costo está incluido originalmente en serviceMisc.
  // Se separa solo para mostrarlo; no se vuelve a sumar al costo del viaje.
  const operatorVariable=q?.audit?.operatorMode==='variable'
   ?Math.min(positive(variable.serviceMisc),positive(q.kmTotal)*positive(q?.audit?.params?.operatorPerKm))
   :0;
  const rows=[
   {key:'diesel',type:'Variable',label:'Diésel',amount:positive(variable.diesel)},
   {key:'maintenance',type:'Variable',label:'Mantenimiento',amount:positive(variable.maintenance)+positive(variable.suspension)+positive(variable.lubricants)+positive(variable.def)},
   {key:'tires',type:'Variable',label:'Llantas',amount:positive(variable.tires)},
   {key:'tolls',type:'Variable',label:'Casetas',amount:positive(variable.tolls)},
   {key:'services',type:'Variable',label:'Servicios y maniobras',amount:positive(variable.serviceMisc)-operatorVariable+positive(variable.riskCost)},
   {key:'depreciation',type:'Fijo',label:'Depreciación / arrendamiento',amount:fixedPart('asset')},
   {key:'insurance',type:'Fijo',label:'Seguro',amount:fixedPart('insurance')},
   {key:'admin',type:'Fijo',label:'Gastos administrativos',amount:fixedPart('admin')+fixedPart('permit')+fixedPart('gps')+fixedPart('patio')},
   {key:'operator',type:q?.audit?.operatorMode==='variable'?'Variable':'Fijo',label:'Operador',amount:operatorVariable+fixedPart('operator')}
  ].map(r=>({...r,participation:cost>0?r.amount/cost:0}));
  const total=(type,key)=>rows.filter(r=>r.type===type).reduce((a,b)=>a+b[key],0);
  return {basis:'Costo técnico del ciclo sin utilidad',rows,totals:{
   fixed:total('Fijo','amount'),variable:total('Variable','amount'),
   participationFixed:total('Fijo','participation'),participationVariable:total('Variable','participation')
  },cost};
 }

 function detailedBreakdown(q){
  // Estructura tarifaria presupuestal, SIN porcentaje fijo predefinido.
  // El valor de mantenimiento/combustible depende del recorrido, equipo y datos actuales.
  const v=q.variable||{},m=q.monthly||{},cost=Math.max(0,Number(q.cost)||0);
  const fixedTotal=Math.max(0,Number(q.fixedAllocation)||0),monthlyTotal=Math.max(0,Number(q.monthlyTotal)||0);
  const part=id=>monthlyTotal>0?fixedTotal*Math.max(0,Number(m[id])||0)/monthlyTotal:0;
  const misc=Math.max(0,Number(v.serviceMisc)||0);
  const opVar=q.audit?.operatorMode==='variable'?Math.min(misc,Math.max(0,Number(q.kmTotal)||0)*Math.max(0,Number(q.audit?.params?.operatorPerKm)||0)):0;
  const amounts={
   diesel:Number(v.diesel)||0,
   maintenance:(Number(v.maintenance)||0)+(Number(v.suspension)||0)+(Number(v.lubricants)||0)+(Number(v.def)||0),
   tires:Number(v.tires)||0,
   operatorVariable:opVar,
   tolls:Number(v.tolls)||0,
   service:misc-opVar+(Number(v.riskCost)||0),
   vehicle:part('asset'),insurance:part('insurance'),admin:part('admin'),
   laborMaintenance:part('workshopLabor'),operatorFixed:part('operator'),
   fixedOther:part('permit')+part('gps')+part('patio')
  };
  const variableLabels=[['Diésel',amounts.diesel],['Mantenimiento',amounts.maintenance],['Llantas',amounts.tires],['Operador variable',amounts.operatorVariable],['Casetas',amounts.tolls],['Servicios / maniobras',amounts.service]];
  const fixedLabels=[['Vehículo / depreciación',amounts.vehicle],['Seguros',amounts.insurance],['Gastos administrativos',amounts.admin],['Mano de obra de mantenimiento',amounts.laborMaintenance],['Operador – sueldo fijo',amounts.operatorFixed],['Otros fijos (GPS, permisos y patio)',amounts.fixedOther]];
  const map=entries=>entries.map(([label,amount])=>({label,amount,participation:cost>0?amount/cost:0}));
  const fixed=map(fixedLabels),variable=map(variableLabels);
  // Sólo hay residual si el usuario reemplazó a mano el fijo total.
  if(fixedTotal>0&&monthlyTotal<=0)fixed.push({label:'Ajuste fijo del ciclo',amount:fixedTotal,participation:cost>0?fixedTotal/cost:0});
  return {fixed,variable,fixedTotal,variableTotal:Number(q.variableTotal)||0,cost,
   fixedPercent:cost>0?fixedTotal/cost:0,variablePercent:cost>0?(Number(q.variableTotal)||0)/cost:0,
   profit:Number(q.profit)||0,tariff:Number(q.tariff)||0,utility:Number(q.utility)||0};
 }

 function render(q){
  const trips=Math.max(1,Math.round(v('numeroViajes',1)));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const detail=detailedBreakdown(q);
  const refRows=(q.refTiers||[]).map((t,i)=>`<tr${i===0?' class="gc-reference-base"':''}><td><strong>${esc(t.name)}</strong></td><td>${i===0?'Base':'+'+num(t.pct)+'%'}</td><td><b>${fmt(t.amount)}</b></td><td>${fmt(t.amount/q.kmTotal)}/km</td></tr>`).join('');
  const item=r=>`<li class="gc-cost-line"><span class="gc-cost-label">${esc(r.label)}</span><strong class="gc-cost-money">${fmt(r.amount)}</strong><b class="gc-cost-percent">${num(r.participation*100)}%</b></li>`;
  const list=(title,key,rows,total,part)=>`<details class="imt-expander gc-cost-list-section" open><summary>${title}</summary><div class="gc-cost-list-head"><span>Componente</span><span>MXN</span><span>% costo</span></div><ul class="gc-cost-list">${rows.map(item).join('')}</ul><div class="gc-cost-list-total"><strong>Total ${key}</strong><strong>${fmt(total)}</strong><b>${num(part*100)}%</b></div></details>`;
  return `<section class="gc-client-quote"><div class="costhero"><small>Modelo tarifario · costos reales estimados por componente · ciclo A → B → A · ${esc(q.type)} modelo ${q.year} · ${esc(q.cargoType)}</small><strong>${fmt(q.tariff)}</strong><small>Tarifa estimada por viaje · incluye margen ${num(q.utility*100)}% · sin IVA</small></div>
  <div class="metricgrid"><div class="metric"><small>Distancia total del ciclo</small><b>${num(q.kmTotal)} km</b></div><div class="metric"><small>Lote óptimo</small><b>${num(q.loadTons)} Tn</b></div><div class="metric"><small>Tarifa por Tn</small><b>${fmt(q.tariff/q.loadTons)}</b></div><div class="metric"><small>Tarifa por km del ciclo</small><b>${fmt(q.tariff/q.kmTotal)}</b></div></div>
  ${['pending','partial','unavailable','no-registrado'].includes(q.audit?.tollStatus)?`<p class="gc-toll-cost-warning"><b>Casetas: ${esc(q.audit?.tollStatus==='pending'?'consultando plazas del recorrido':q.audit?.tollStatus==='unavailable'?'consulta no disponible':'identificación parcial')}</b>. El gasto de peajes incluido puede ser incompleto. <b>Importe calculado sin IVA:</b> ${fmt(q.variable.tolls)}; valida casetas no identificadas antes de cerrar la tarifa.</p>`:''}
  <div class="gc-cost-list-intro"><b>Desglose del costo del ciclo</b><small>Importes en MXN y participación sobre el costo técnico sin utilidad. Los porcentajes cambian según unidad, ruta y parámetros; no se copian del presupuesto de referencia.</small></div>
  ${list('Costos variables','variables',detail.variable,detail.variableTotal,detail.variablePercent)}
  ${list('Costos fijos','fijos',detail.fixed,detail.fixedTotal,detail.fixedPercent)}
  <div class="gc-cost-grand-total"><span>Costo técnico</span><strong>${fmt(detail.cost)}</strong><b>100%</b></div><div class="gc-cost-grand-total gc-budget-margin"><span>Margen (${num(q.utility*100)}% sobre costo)</span><strong>${fmt(q.profit)}</strong><b>${num(q.tariff>0?100*q.profit/q.tariff:0)}% de tarifa</b></div><div class="gc-cost-grand-total gc-budget-price"><span>Tarifa estimada sin IVA</span><strong>${fmt(q.tariff)}</strong><b>${fmt(q.tariff/q.loadTons)}/Tn</b></div>
  <details class="imt-expander gc-tariff-references" open><summary>Referencias tarifarias · C, C’, B, B+ y B SPOT</summary><div class="gc-ref-scroll"><table class="priceTable gc-ref-table"><thead><tr><th>Referencia</th><th>Ajuste vs C</th><th>MXN/viaje</th><th>MXN/km ciclo</th></tr></thead><tbody>${refRows}</tbody></table></div><p class="hint">C equivale a la tarifa base sin IVA (costo técnico + margen). Las referencias restantes son escenarios de simulación configurables en <b>Configurar costos → Referencias tarifarias</b>. No son bandas tarifarias oficiales de CEMEX.</p></details>
  <p class="hint">Los importes de variables y fijos suman 100% del costo técnico. El margen se añade después. Las participaciones son dinámicas: ninguna se impone para coincidir con la referencia visual. Operador contabilizado una sola vez.</p>
  <p class="hint">Las fórmulas y factores se consultan en Configurar costos → Memoria técnica (uso interno).</p></section>`;
 }
 return {defs,carrierProfiles,tierDefaults,references,preset,classification,quote,prepare,getParams,fieldDefs,syncUI,fromApp,render,executiveBreakdown,detailedBreakdown,active};
});
