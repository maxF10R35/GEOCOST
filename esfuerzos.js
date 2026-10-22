/** Deterministic GeoRisk effort model. Distances are estimates on routed geometry. */
import {urbanIndex,urbanAt,urbanStreetAt,urbanBoundaryCuts,pointInUrbanArea} from './zonas.js';
export const METHOD_VERSION='GR-EL-1.3';
export const EFFORT_CLASSES=[
 {id:'urbano',label:'Urbano (Ciudad)',color:'#64748b'},
 {id:'autopista_sin',label:'Autopista sin sierra',color:'#1474e8'},
 {id:'autopista_con',label:'Autopista con sierra',color:'#753bbd'},
 {id:'pavimento_sin',label:'Pavimento sin sierra',color:'#189653'},
 {id:'pavimento_con',label:'Pavimento con sierra',color:'#e68b14'},
 {id:'terraceria_sin',label:'Terracería sin sierra',color:'#ad8457'},
 {id:'terraceria_con',label:'Terracería con sierra',color:'#bd3434'}
];
export const DEFAULT_RULES=Object.freeze({segmentMeters:100,windowMeters:1000,minWindowMeters:500,maxElevationGap:700,netGradePct:5,meanAbsGradePct:3.5,strongGradePct:3,strongShare:.4,minReliefMeters:30,matchMeters:30});
const rad=Math.PI/180;
export function distance(a,b){
 const p=(b[1]-a[1])*rad,q=(b[0]-a[0])*rad;
 const h=Math.sin(p/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(q/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function routeAxis(coords){
 const cum=[0]; for(let i=1;i<coords.length;i++)cum.push(cum.at(-1)+distance(coords[i-1],coords[i]));
 return {coords,cum,total:cum.at(-1)||0};
}
export function pointAt(axis,m){
 const {coords,cum,total}=axis; if(!coords.length)return null;
 m=Math.max(0,Math.min(total,m));let lo=0,hi=cum.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<m)lo=mid+1;else hi=mid;}
 const i=Math.max(1,lo),a=coords[i-1]||coords[0],b=coords[i]||a;
 const t=(m-(cum[i-1]||0))/Math.max(1e-9,(cum[i]||0)-(cum[i-1]||0));
 return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
export function sliceRoute(axis,start,end){
 const out=[pointAt(axis,start)];for(let i=1;i<axis.cum.length-1;i++)if(axis.cum[i]>start&&axis.cum[i]<end)out.push(axis.coords[i]);
 out.push(pointAt(axis,end));return out;
}
export function projection(p,a,b){
 const kx=Math.cos(p[1]*rad)*111195,ky=111195;
 const dx=(b[0]-a[0])*kx,dy=(b[1]-a[1])*ky;
 const px=(p[0]-a[0])*kx,py=(p[1]-a[1])*ky;
 const rawT=(px*dx+py*dy)/(dx*dx+dy*dy||1),t=Math.max(0,Math.min(1,rawT));
 return {distance:Math.hypot(px-t*dx,py-t*dy),t,rawT};
}
export function projectOnRoute(p,axis){
 let best={distance:Infinity,meters:0};for(let i=1;i<axis.coords.length;i++){
  const hit=projection(p,axis.coords[i-1],axis.coords[i]);
  if(hit.distance<best.distance)best={distance:hit.distance,meters:axis.cum[i-1]+hit.t*(axis.cum[i]-axis.cum[i-1])};
 }return best;
}
function bearing(a,b){return Math.atan2((b[0]-a[0])*Math.cos(a[1]*rad),b[1]-a[1])*180/Math.PI;}
function angle(a,b){let d=Math.abs(a-b)%180;return Math.min(d,180-d);}
export function wayIndex(ways){
 const grid=new Map(),cell=.005;
 for(const way of ways){const g=way.geometry||[];for(let i=1;i<g.length;i++){
  const a=[g[i-1].lon,g[i-1].lat],b=[g[i].lon,g[i].lat];
  for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++){
   const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push({way,a,b});
  }
 }}return {grid,cell};
}
export function matchWay(p,index,heading,max=40){
 const x=Math.floor(p[0]/index.cell),y=Math.floor(p[1]/index.cell),byWay=new Map();
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const s of index.grid.get((x+dx)+','+(y+dy))||[]){
  if(Number.isFinite(heading)&&angle(heading,bearing(s.a,s.b))>40)continue;
  const projected=projection(p,s.a,s.b);if(projected.rawT < -1e-8||projected.rawT > 1+1e-8)continue;
  const d=projected.distance;
  if(d<=max&&(!byWay.has(s.way.id)||byWay.get(s.way.id).distance>d))byWay.set(s.way.id,{way:s.way,distance:d});
 }
 const hits=[...byWay.values()].sort((a,b)=>a.distance-b.distance),best=hits[0];
 if(!best)return null;
 const other=hits[1];
 if(other&&other.distance-best.distance<5&&roadBase(other.way.tags).base!==roadBase(best.way.tags).base)return {ambiguous:true};
 return best;
}
const unpaved=new Set(['unpaved','gravel','fine_gravel','compacted','dirt','earth','ground','mud','sand','grass','pebblestone']);
const paved=new Set(['paved','asphalt','concrete','concrete:plates','concrete:lanes','paving_stones','sett','cobblestone']);
export function roadBase(tags={}){
 const h=tags.highway||'',s=String(tags.surface||'').toLowerCase();
 if(['footway','path','cycleway','steps','pedestrian','construction','proposed'].includes(h))return {base:null,reason:'Vía no disponible para ruteo vehicular de referencia'};
 // Explicit unpaved surface takes precedence; track alone does not prove dirt.
 if(unpaved.has(s))return {base:'terraceria',reason:'Superficie no pavimentada: '+s};
 if(['motorway','motorway_link'].includes(h))return {base:'autopista',reason:'Autopista identificada por tipo motorway en OSM'};
 // Toll describes payment, not controlled access or motorway construction.
 if(tags['zone:traffic']==='urban'||tags.urban==='yes')return {base:'urbano',reason:'Entorno urbano explícito en la vialidad OSM'};
 if(['residential','living_street','service'].includes(h)&&!unpaved.has(s))return {base:'urbano',reason:'Calle local / de servicio según OSM (entorno urbano estimado)'};
 if(paved.has(s))return {base:'pavimento',reason:'Superficie pavimentada: '+s};
 return {base:null,reason:'Falta superficie o evidencia de entorno urbano; jerarquía vial insuficiente'};
}
export function elevationProfile(analysis){
 // Keep missing intervals explicit. Never interpolate across a gap.
 const spans=(analysis?.effortProfile||analysis?.segments||[]).filter(s=>Number.isFinite(s.e1)&&Number.isFinite(s.e2)&&Number.isFinite(s.startMeters)&&Number.isFinite(s.endMeters)&&s.endMeters>s.startMeters).sort((a,b)=>a.startMeters-b.startMeters||a.endMeters-b.endMeters);
 const clean=[];let end=-Infinity;
 for(const s of spans){
  const start=Math.max(end,s.startMeters);if(s.endMeters<=start)continue;
  clean.push({...s,startMeters:start,e1:s.e1+(s.e2-s.e1)*(start-s.startMeters)/(s.endMeters-s.startMeters),sampleMeters:s.sampleMeters||s.endMeters-s.startMeters});end=s.endMeters;
 }
 return clean;
}
export function reliefAt(start,end,spans,total,rules=DEFAULT_RULES){
 const mid=(start+end)/2,lo=Math.max(0,mid-rules.windowMeters/2),hi=Math.min(total,mid+rules.windowMeters/2),len=hi-lo;
 let covered=0,change=0,strong=0,low=Infinity,high=-Infinity,first=null,last=null,maxGrade=0;
 for(const s of spans){const a=Math.max(lo,s.startMeters),b=Math.min(hi,s.endMeters);if(b<=a)continue;
  const originalGap=s.sampleMeters||s.endMeters-s.startMeters;
  if(originalGap>rules.maxElevationGap)continue;
  const e1=s.e1+(s.e2-s.e1)*(a-s.startMeters)/(s.endMeters-s.startMeters),e2=s.e1+(s.e2-s.e1)*(b-s.startMeters)/(s.endMeters-s.startMeters);
  const grade=Math.abs(e2-e1)/(b-a)*100;
  covered+=b-a;change+=Math.abs(e2-e1);if(grade>=rules.strongGradePct)strong+=b-a;
  low=Math.min(low,e1,e2);high=Math.max(high,e1,e2);maxGrade=Math.max(maxGrade,grade);
  if(first===null)first=e1;last=e2;
 }
 if(len<rules.minWindowMeters||covered<len*.98)return {sierra:null,reason:'Perfil incompleto o resolución insuficiente para relieve sostenido',coverage:len?covered/len:0};
 const netGrade=Math.abs(last-first)/len*100,meanAbsGrade=change/len*100,strongShare=strong/len,range=high-low;
 const sierra=range>=rules.minReliefMeters&&(netGrade>=rules.netGradePct||meanAbsGrade>=rules.meanAbsGradePct&&strongShare>=rules.strongShare);
 return {sierra,netGrade,meanAbsGrade,maxGrade,strongShare,range,coverage:covered/len,windowMeters:len,low,high,reason:sierra?'Relieve sostenido supera criterio GR-EL-1.3':'Relieve medido por debajo del criterio GR-EL-1.3'};
}
export function pointInPolygon(p,way){
 return pointInUrbanArea(p,way);
}
function rncSurface(tags,row){
 // RNC has no geographic geometry; only complement a strongly matched OSM road.
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 if(tags.surface||!row?.rnc||row.rncMatch?.level!=='alta'||row.rncMatch.margin<18||!tags.name||norm(tags.name)!==norm(row.name))return tags;
 const val=row.rnc.p==='Con pavimento'?'paved':row.rnc.p==='Sin pavimento'?'unpaved':null;
 return val?{...tags,surface:val,_rncEvidence:row.rnc.p}:tags;
}
// Step names belong to the computed corridor. This is a labelled estimate,
// never a spatial confirmation from the RNC name-only index.
export function stepRoadEstimate(row={}){
 const name=String(row.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const ref=String(row.ref||'').toUpperCase();
 if(/\b(autopista|cuota)\b/.test(name)||/\bMEX\s*[- ]?\d+D\b/.test(ref))return {base:'autopista',estimated:true,reason:'Estimación por nombre/código del paso OSRM de autopista o cuota; validar cartografía'};
 // Calle/Avenida/Paseo are names, not a spatial urban boundary.
 // A global name match can refer to another municipality. Do not use it to
 // infer dirt on an unlocated road, even when its name score is high.
 if(row.rnc?.p==='Con pavimento'&&row.rncMatch?.level==='alta'&&row.rncMatch.margin>=18&&/\b(carretera|federal)\b/.test(name))return {base:'pavimento',estimated:true,reason:'Estimación de pavimento: paso OSRM con respaldo nominal RNC de alta confianza; sin confirmación espacial'};
 return {base:null,reason:'Sin evidencia suficiente de tipo vial; requiere consulta cartográfica o validación'};
}
/** Nearest source segment in route distance. Sources never include inferred results. */
function nearestAnchor(anchors,mid,maxDistance){
 let lo=0,hi=anchors.length;
 while(lo<hi){const m=(lo+hi)>>1;if(anchors[m].mid<mid)lo=m+1;else hi=m;}
 const candidates=[anchors[lo-1],anchors[lo]].filter(Boolean).sort((a,b)=>Math.abs(a.mid-mid)-Math.abs(b.mid-mid));
 return candidates.find(a=>Math.abs(a.mid-mid)<=maxDistance)?.segment||null;
}
function roadNameKey(segment){
 const name=segment.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return name&&name!=='tramo sin nombre'?'name:'+name:null;
}
function roadKey(segment){return segment.osmId?'osm:'+segment.osmId:roadNameKey(segment);}
function fallbackRoad(segment,near){
 if(near&&near.road.base!=='urbano')return {base:near.road.base,estimated:true,reason:'Continuidad aproximada de un mismo corredor OSM'};
 const h=segment.tags.highway||'';
 // Carácter urbano sólo como estimación: una calle residencial no basta para confirmar perímetro urbano.
 if(['residential','living_street'].includes(h))return {base:'urbano',estimated:true,reason:'Calle residencial según OSM; perímetro urbano no confirmado'};
 if(h==='track')return {base:'terraceria',estimated:true,reason:'Camino tipo track en OSM; superficie no confirmada'};
 return {base:null,estimated:false,reason:'Vialidad sin evidencia suficiente de pavimento o terracería'};
}
function fallbackRelief(segment,spans,total,rules){
 // Never propagate a neighbouring mountain/flat label over a missing interval.
 const mid=(segment.geometryStart+segment.geometryEnd)/2,lo=Math.max(0,mid-rules.windowMeters/2),hi=Math.min(total,mid+rules.windowMeters/2);
 let covered=0,change=0,strong=0,low=Infinity,high=-Infinity,first=null,last=null;
 for(const s of spans){
  const a=Math.max(lo,s.startMeters),b=Math.min(hi,s.endMeters);if(b<=a)continue;
  const e1=s.e1+(s.e2-s.e1)*(a-s.startMeters)/(s.endMeters-s.startMeters),e2=s.e1+(s.e2-s.e1)*(b-s.startMeters)/(s.endMeters-s.startMeters);
  const grade=Math.abs(e2-e1)/(b-a)*100;covered+=b-a;change+=Math.abs(e2-e1);if(grade>=rules.strongGradePct)strong+=b-a;
  low=Math.min(low,e1,e2);high=Math.max(high,e1,e2);if(first===null)first=e1;last=e2;
 }
 if(covered>0&&covered>=(hi-lo)*.8){
  const netGrade=Math.abs(last-first)/covered*100,meanAbsGrade=change/covered*100,strongShare=strong/covered;
  return {sierra:high-low>=rules.minReliefMeters&&(netGrade>=rules.netGradePct||meanAbsGrade>=rules.meanAbsGradePct&&strongShare>=rules.strongShare),estimated:true,netGrade,meanAbsGrade,strongShare,coverage:covered/(hi-lo),low,high,range:high-low,windowMeters:hi-lo,reason:'Relieve estimado sólo con el perfil de esta ventana; resolución limitada o recorrido corto'};
 }
 return {sierra:true,estimated:true,assumed:true,reason:'Sin perfil suficiente: supuesto conservador con sierra para planeación; relieve sin confirmar'};
}
function completeCategories(segments,spans,total,rules){
 const roads=new Map();
 for(const segment of segments){
  const anchor={mid:(segment.geometryStart+segment.geometryEnd)/2,segment};
  if(segment.road.base&&segment.road.base!=='urbano'){for(const key of new Set([roadKey(segment),roadNameKey(segment)])){if(key){if(!roads.has(key))roads.set(key,[]);roads.get(key).push(anchor);}}}
 }
 for(const segment of segments){
  const mid=(segment.geometryStart+segment.geometryEnd)/2;
  if(!segment.road.base){
   const key=roadKey(segment),candidate=key?nearestAnchor(roads.get(key)||[],mid,500):null;
   // A confirmed different OSM way must not inherit the adjacent road's surface.
   const near=candidate&&(!segment.osmId||segment.osmId===candidate.osmId)&&(!segment.tags.highway||segment.tags.highway===candidate.tags.highway)?candidate:null;
   segment.road=fallbackRoad(segment,near);
  }
  if(segment.road.base!=='urbano'&&segment.relief.sierra===null)segment.relief=fallbackRelief(segment,spans,total,rules);
  segment.id=!segment.road.base||segment.road.base!=='urbano'&&segment.relief.sierra===null?null:segment.road.base==='urbano'?'urbano':segment.road.base+(segment.relief.sierra?'_con':'_sin');
  segment.estimated=Boolean(segment.road.estimated||segment.road.base!=='urbano'&&segment.relief.estimated);
  segment.assumed=Boolean(segment.road.assumed||segment.road.base!=='urbano'&&segment.relief.assumed);
  segment.reason=segment.road.reason+(segment.road.base==='urbano'?'':' · '+segment.relief.reason);
 }
}
// Evidence from nearby OSM streets: estimates built-up corridors nationally,
// without forcing whole municipalities or controlled-access roads to urban.
function urbanStreetDensity(p, index){
 const cx=Math.floor(p[0]/index.cell),cy=Math.floor(p[1]/index.cell);
 const ids=new Set(),local=new Set();
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const item of index.grid.get((cx+dx)+','+(cy+dy))||[]){
  const h=item.way.tags?.highway||'';
  if(!['residential','living_street','tertiary','secondary','unclassified','service','primary'].includes(h))continue;
  if(projection(p,item.a,item.b).distance>220)continue;
  ids.add(item.way.id);
  if(['residential','living_street','service','unclassified'].includes(h))local.add(item.way.id);
 }
 return {roads:ids.size,local:local.size};
}
export function calculateEfforts(route,analysis,ways,rules=DEFAULT_RULES){
 const axis=routeAxis(route.coords||[]),total=Number(route.distance)||axis.total;
 if(!axis.total)return {version:METHOD_VERSION,total:0,rows:EFFORT_CLASSES.map(c=>({...c,meters:0,share:0,estimatedMeters:0})),segments:[],runs:[],pendingMeters:0,coverage:0,estimatedMeters:0,evidenceCoverage:0,rules,axis};
 const scale=total/axis.total,spans=elevationProfile(analysis),idx=wayIndex(ways||[]),urban=urbanIndex(route.openRoads?.urbanAreas||[]);
 const bounds=new Set([0,axis.total]);for(let m=rules.segmentMeters;m<axis.total;m+=rules.segmentMeters)bounds.add(m);
 // Route-engine step boundaries are used in addition to regular sampling.
 let stepM=0;for(const s of route.raw?.legs?.flatMap(l=>l.steps||[])||[]){stepM+=Number(s.distance)||0;if(stepM/scale<axis.total)bounds.add(stepM/scale);}
 for(const s of spans){if(s.startMeters>0&&s.startMeters<axis.total)bounds.add(s.startMeters);if(s.endMeters<axis.total)bounds.add(s.endMeters);}
 for(const m of urbanBoundaryCuts(axis,urban))bounds.add(m);
 // Split at matched road endpoints to locate pavement/road-type transitions.
 for(const way of ways||[]){const g=way.geometry||[];for(const end of [g[0],g.at(-1)])if(end){const hit=projectOnRoute([end.lon,end.lat],axis);if(hit.distance<=rules.matchMeters&&hit.meters>0&&hit.meters<axis.total)bounds.add(hit.meters);}}
 const cuts=[...bounds].sort((a,b)=>a-b),segments=[];
 let rncM=0;const rncSteps=(route.rncEffortRows||route.raw?.legs?.flatMap(l=>l.steps||[])||[]).map(r=>{const start=rncM;rncM+=Number(r.distance)||0;return {...r,start,end:rncM};});
 for(let i=1;i<cuts.length;i++){
  const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;
  const a=pointAt(axis,start),b=pointAt(axis,end),p=pointAt(axis,(start+end)/2),hit=matchWay(p,idx,bearing(a,b),rules.matchMeters);
  const step=rncSteps.find(r=>r.start<=(start+end)/2*scale&&r.end>(start+end)/2*scale);
  let tags=hit?.way?.tags||{};
  if(hit?.way)tags=rncSurface(tags,step);
  let road=hit?.way?roadBase(tags):hit?.ambiguous?{base:null,reason:'Coincidencia ambigua entre vialidades'}:stepRoadEstimate(step);
  const urbanArea=urbanAt(p,urban)||urbanStreetAt(p,a,b,urban),excluded=['construction','proposed','footway','path','cycleway','steps','pedestrian'].includes(tags.highway);
  if(urbanArea&&!excluded&&!['autopista','terraceria'].includes(road.base))road={base:'urbano',estimated:Boolean(urbanArea.estimated),reason:urbanArea.estimated?'Entorno urbano estimado: calle entre dos polígonos urbanizados a ≤35 m por lado; termina al salir de la evidencia bilateral':'Dentro del polígono urbano OSM '+(urbanArea.tags?.name||urbanArea.tags?.landuse||urbanArea.tags?.place||urbanArea.id||'cartografiado')+'; límite por intersección de la ruta'};
  const streetEvidence=urbanStreetDensity(p,idx);
  const accessControlled=['motorway','motorway_link','trunk','trunk_link'].includes(tags.highway)||road.base==='autopista';
  if(!urbanArea&&!excluded&&!accessControlled&&road.base!=='terraceria'&&streetEvidence.roads>=7&&streetEvidence.local>=4)road={base:'urbano',estimated:true,reason:`Tramo urbano estimado por red vial cercana: ${streetEvidence.roads} vías, ${streetEvidence.local} locales en 220 m; verificar con mancha urbana`};
  if(tags._rncEvidence)road.reason+=' · respaldo RNC: '+tags._rncEvidence;
  const relief=reliefAt(start,end,spans,axis.total,rules);
  const id=null;
  segments.push({id,startMeters:start*scale,endMeters:end*scale,meters:(end-start)*scale,geometryStart:start,geometryEnd:end,point:p,road,relief,step,urbanAreaId:urbanArea?.id??null,urbanAreaName:urbanArea?.tags?.name||urbanArea?.tags?.landuse||urbanArea?.tags?.place||'',name:hit?.way?.tags?.name||hit?.way?.tags?.ref||step?.name||step?.ref||'Tramo sin nombre',osmId:hit?.way?.id||null,tags,reason:road.reason});
 }
 completeCategories(segments,spans,axis.total,rules);
 const rows=EFFORT_CLASSES.map(c=>({...c,meters:segments.filter(s=>s.id===c.id).reduce((a,s)=>a+s.meters,0),estimatedMeters:segments.filter(s=>s.id===c.id&&s.estimated).reduce((a,s)=>a+s.meters,0)}));
 const pendingMeters=Math.max(0,total-rows.reduce((n,r)=>n+r.meters,0));
 for(const r of rows)r.estimatedMeters=Math.min(r.meters,r.estimatedMeters);
 for(const r of rows)r.share=total?r.meters/total*100:0;
 const runs=[];for(const s of segments){let prev=runs.at(-1);if(prev&&prev.id===s.id&&prev.osmId===s.osmId&&prev.name===s.name&&prev.reason===s.reason){prev.endMeters=s.endMeters;prev.geometryEnd=s.geometryEnd;prev.meters+=s.meters;}else runs.push({...s});}
 const estimatedMeters=segments.every(s=>s.estimated)?total:Math.min(total,segments.filter(s=>s.estimated).reduce((a,s)=>a+s.meters,0));
 return {version:METHOD_VERSION,analysisSource:analysis,sourceAt:route.openRoads?.at,total,rows,segments,runs,pendingMeters,coverage:total?(total-pendingMeters)/total*100:0,estimatedMeters,evidenceCoverage:Math.max(0,100-estimatedMeters/total*100),assumedMeters:segments.filter(s=>s.assumed).reduce((a,s)=>a+s.meters,0),rules,axis,generatedAt:new Date().toISOString()};
}
export function routeOverlap(a,b,tolerance=70){
 const axisA=routeAxis(a.coords||[]),axisB=routeAxis(b.coords||[]);if(!axisA.total||!axisB.total)return 1;
 const fraction=(x,y)=>{const count=Math.max(25,Math.min(240,Math.ceil(x.total/300)));let common=0;for(let i=0;i<count;i++)if(projectOnRoute(pointAt(x,x.total*(i+.5)/count),y).distance<=tolerance)common++;return common/count;};
 return Math.max(fraction(axisA,axisB),fraction(axisB,axisA));
}
export function diverseRoutes(routes,max=3){
 const out=[];for(const r of routes){if(!r.coords?.length||!Number.isFinite(r.distance))continue;if(out.every(x=>routeOverlap(r,x)<.90))out.push(r);if(out.length===max)break;}return out;
}
export function hasRouteBacktrack(route){
 // Repeated spatial cells separated by >1 km indicate loops or a retraced spur.
 const axis=routeAxis(route.coords||[]),seen=new Map();
 for(let m=0;m<axis.total;m+=200){const p=pointAt(axis,m),key=p.map(x=>Math.round(x*2500)).join(',');if(seen.has(key)&&m-seen.get(key)>1000)return true;if(!seen.has(key))seen.set(key,m);}
 return (route.raw?.legs||[]).some(l=>(l.steps||[]).some(s=>s.maneuver?.modifier==='uturn'));
}
export function incidentImpacts(incident,route){
 const axis=routeAxis(route.coords||[]),points=incident.geometry?.coordinates||[[incident.lng,incident.lat]];
 let best={distance:Infinity,meters:0};
 // Densify event lines so an intersection in the middle is not missed.
 const eventAxis=routeAxis(points);const count=Math.min(500,Math.max(2,Math.ceil(eventAxis.total/35)+1));const samples=points.length>1?Array.from({length:count},(_,i)=>pointAt(eventAxis,eventAxis.total*i/(count-1))):points;
 for(const p of samples){if(!p||!p.every(Number.isFinite))continue;const hit=projectOnRoute(p,axis);if(hit.distance<best.distance)best=hit;}
 const radius=Number.isFinite(incident.radius)?incident.radius:40;
 return {...best,affects:best.distance<=radius,routeKm:axis.total?best.meters/axis.total*route.distance/1000:0};
}
export function validateIncident(obj){
 const types=['cierre','bloqueo','accidente','obra','clima','inundacion','congestion'];
 if(!types.includes(obj.type))throw new Error('Tipo de incidencia inválido');
 const lat=Number(obj.lat),lng=Number(obj.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)throw new Error('Coordenadas inválidas');
 if(!obj.expiresAt||!Number.isFinite(Date.parse(obj.expiresAt)))throw new Error('La incidencia necesita vencimiento válido');
 let geometry=null;if(obj.geometry){if(obj.geometry.type!=='LineString'||!Array.isArray(obj.geometry.coordinates)||obj.geometry.coordinates.length<2||obj.geometry.coordinates.length>5000||!obj.geometry.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90))throw new Error('Geometría de incidencia inválida');geometry=obj.geometry;}
 return {id:String(obj.id||'inc-'+Date.now()+'-'+Math.random().toString(36).slice(2)),type:obj.type,lat,lng,title:String(obj.title||obj.type).slice(0,160),description:String(obj.description||'').slice(0,1500),source:String(obj.source||'Reporte de operación').slice(0,150),reportedAt:obj.reportedAt&&Number.isFinite(Date.parse(obj.reportedAt))?obj.reportedAt:new Date().toISOString(),expiresAt:new Date(obj.expiresAt).toISOString(),radius:Math.max(10,Math.min(500,Number(obj.radius)||40)),geometry,manual:obj.manual!==false};
}
export function activeIncidents(items,now=Date.now()){return items.filter(x=>Date.parse(x.expiresAt)>now);}
