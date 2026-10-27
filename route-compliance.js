/* GeoCost SC — prevalidación conservadora de rutas de carga (NO certificación NOM-012).
 * Sin datos viales oficiales por segmento no se declara una ruta 'permitida'.
 * Las reglas documentadas permiten bloquear incompatibilidades comprobadas.
 */
(function(root,make){const api=make();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GCRouteCompliance=api;})(typeof window==='undefined'?null:window,()=>{
 'use strict';
 const AXLE_HINT={Camioneta:2,'Rabón':2,Torton:3,'Tráiler':5,Full:9};
 const VEHICLE_PROFILES=Object.freeze({
  Camioneta:Object.freeze({axles:2,configuration:'Vehículo ligero de reparto',planningSpeedKmh:75,optimalTons:5}),
  'Rabón':Object.freeze({axles:2,configuration:'Camión rígido de 2 ejes',planningSpeedKmh:70,optimalTons:9}),
  Torton:Object.freeze({axles:3,configuration:'Camión rígido de 3 ejes',planningSpeedKmh:65,optimalTons:18}),
  'Tráiler':Object.freeze({axles:5,configuration:'Tractocamión articulado de 5 ejes (configuración referencial)',planningSpeedKmh:65,optimalTons:28}),
  Full:Object.freeze({axles:9,configuration:'Doblemente articulado de 9 ejes (configuración referencial)',planningSpeedKmh:60,optimalTons:50})
 });
 function profileForUnit(vehicle,now=new Date()){
  const base=VEHICLE_PROFILES[vehicle];if(!base)throw Error('Unidad logística no registrada: '+vehicle);
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  return {vehicle,axles:base.axles,configuration:base.configuration,loadTons:base.optimalTons,
   grossTons:null,heightM:null,widthM:null,lengthM:null,
   departure:local,departureBasis:'Hora local de consulta, estimada; hora efectiva de viaje desconocida',
   policySpeedKmh:base.planningSpeedKmh,planningSpeedIsLegalLimit:false};
 }
 const finite=x=>x!==''&&x!=null&&Number.isFinite(Number(x));
 const vehicleCode=axles=>Number.isInteger(Number(axles))&&Number(axles)>=2&&Number(axles)<=9?Number(axles)+3:null;
 function parseClock(v){const m=/^(\d\d):(\d\d)$/.exec(String(v||''));if(!m)return null;const minutes=Number(m[1])*60+Number(m[2]);return minutes<1440?minutes:null;}
 function inWindow(clock,start,end){const t=parseClock(clock),a=parseClock(start),b=parseClock(end);if(t===null||a===null||b===null)return null;return a<=b?t>=a&&t<b:t>=a||t<b;}
 function evaluate(profile={},segments=[],data={}){
  const blocked=[],pending=[],cautions=[];
  const v=profile.vehicle,axles=Number(profile.axles),gross=Number(profile.grossTons),height=Number(profile.heightM),width=Number(profile.widthM),length=Number(profile.lengthM);
  if(!AXLE_HINT[v])pending.push('Vehículo sin ficha de configuración');
  if(!vehicleCode(axles))pending.push('Confirma el número real de ejes (2–9)');
  if(!(gross>0&&gross<150))pending.push('Falta peso bruto vehicular real (unidad + carga)');
  if(!(height>0&&height<7))pending.push('Falta altura total de unidad cargada');
  if(!(width>0&&width<5))pending.push('Falta ancho total de la unidad');
  if(!(length>0&&length<50))pending.push('Falta longitud total de la combinación');
  if(!profile.departure||profile.departureBasis)pending.push('Hora de salida real no confirmada: los horarios locales solo pueden evaluarse de forma preliminar');
  const roads=Array.isArray(segments)?segments:[];
  if(!roads.length)pending.push('No hay tramos con clasificación oficial ET/A/B/C/D y señalamiento verificados');
  const rules=Array.isArray(data.restrictions)?data.restrictions:[];
  if(!rules.length)pending.push('Sin catálogo territorial completo y vigente de restricciones horarias/locales; requiere verificación externa');
  const ids=new Set(roads.map(s=>String(s.id||'')).filter(Boolean));
  const departure=/T(\d\d:\d\d)/.exec(String(profile.departure||''))?.[1];
  for(const seg of roads){
   if(seg.verified!==true){pending.push(`Tramo ${String(seg.name||seg.id||'sin identificar')}: clasificación/restricciones sin verificar`);continue;}
   const name=String(seg.name||seg.id||'tramo');
   if(v==='Full'&&seg.classification&& !['ET','A'].includes(String(seg.classification).toUpperCase()) && !seg.specialConnectivityPermit)blocked.push(`${name}: Full en camino de menor clasificación sin autorización especial acreditada`);
   if(finite(seg.maxGrossTons)&&gross>Number(seg.maxGrossTons))blocked.push(`${name}: PBV superior al máximo documentado`);
   if(finite(seg.maxHeightM)&&height>Number(seg.maxHeightM))blocked.push(`${name}: altura excede la restricción documentada`);
   if(finite(seg.maxWidthM)&&width>Number(seg.maxWidthM))blocked.push(`${name}: ancho excede la restricción documentada`);
   if(finite(seg.maxLengthM)&&length>Number(seg.maxLengthM))blocked.push(`${name}: longitud excede la restricción documentada`);
   if(seg.heavyGoodsForbidden===true)blocked.push(`${name}: autotransporte de carga prohibido`);
   if(!seg.classification)pending.push(`${name}: falta clase oficial de carretera`);
  }
  for(const rule of rules){
   if(rule.verified!==true||!rule.source||!rule.segmentId||!ids.has(String(rule.segmentId)))continue;
   if(rule.vehicleTypes?.length&&!rule.vehicleTypes.includes(v))continue;
   if(rule.kind==='forbidden')blocked.push(`${rule.segmentId}: restricción registrada (${rule.source})`);
   if(rule.kind==='hours'){
    const applies=departure&&!profile.departureBasis?inWindow(departure,rule.start,rule.end):null;
    if(applies===true)blocked.push(`${rule.segmentId}: horario restringido ${rule.start}–${rule.end} (${rule.source})`);
    if(applies===null)pending.push(`${rule.segmentId}: falta horario aplicable`);
   }
  }
  const maxSpeed=Math.max(20,Math.min(90,Number(profile.policySpeedKmh)||70));
  const speedLimits=roads.filter(s=>s.verified===true&&finite(s.maxSpeedKmh)).map(s=>Number(s.maxSpeedKmh));
  const maximumIdentified=speedLimits.length?Math.min(...speedLimits):null;
  if(!speedLimits.length)pending.push('Límites señalizados de velocidad no verificados por tramo');
  cautions.push('Ejes y lote óptimo se asignan desde la unidad; peso bruto y dimensiones reales deben validarse contra la unidad específica.');
  cautions.push('La velocidad usada para estimar tiempo no es un límite oficial: respetar señalamiento por tramo.');
  return {status:blocked.length?'BLOCKED':pending.length?'PENDING':'PRECHECK',blocked:[...new Set(blocked)],pending:[...new Set(pending)],cautions,policySpeedKmh:maxSpeed,mostRestrictiveKnownKmh:maximumIdentified,roadDataComplete:roads.length>0&&roads.every(s=>s.verified===true)};
 }
 return {AXLE_HINT,VEHICLE_PROFILES,profileForUnit,vehicleCode,parseClock,inWindow,evaluate};
});
