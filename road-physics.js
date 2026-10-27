/* GeoCoast GC-FIS-2.0. Clasifica el camino con geometría y etiquetas OSM, no consume
   el resultado 'esfuerzos GeoRisk', ni sus porcentajes manuales ni escala IRA. */
import {getRoadEvidence,routeAxis,pointAt,wayIndex,matchWay,roadBase} from './road-evidence.js';
import {getRncEvidence} from './rnc-evidence.js';
const cache=new Map(),pending=new Map(),sequence=new Map();
const core=window.GCRoadPhysicsCore;
function key(r){return (r.coords?.length||0)+'|'+r.coords?.[0]?.join(',')+'|'+r.coords?.at(-1)?.join(',')+'|'+Number(r.km).toFixed(2)}
function gradeAt(t,samples){if(!Array.isArray(samples)||samples.length<2)return {grade:null,deltaHeight:null};
 // Perfil existente en orden espacial de ida. Comparación por intervalo, NO altitud absoluta.
 const i=Math.min(samples.length-2,Math.floor(t*(samples.length-1)));const a=samples[i],b=samples[i+1];
 if(!Number.isFinite(a?.e)||!Number.isFinite(b?.e))return {grade:null,deltaHeight:null};
 const [lat1,lon1]=a.p||[],[lat2,lon2]=b.p||[];if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return {grade:null,deltaHeight:null};
 const dx=111195*Math.hypot(lat2-lat1,(lon2-lon1)*Math.cos(lat1*Math.PI/180));
 const dh=b.e-a.e;return {grade:dx>=80&&dx<=4000?100*dh/dx:null,deltaHeight:dx>=80&&dx<=4000?dh:0};
}
async function analyze(route,terrain){
 if(!route?.coords?.length||!(route.km>0))throw Error('Falta geometría vial');
 const axis=routeAxis(route.coords.map(([lat,lon])=>[lon,lat]));
 const n=Math.min(450,Math.max(12,Math.ceil(route.km*1000/380))),step=route.km/n;
 const points=Array.from({length:n},(_,i)=>{const t=(i+.5)/n;return {t,mid:pointAt(axis,axis.total*t)};});
 const rnc=await getRncEvidence(route);
 const rncIndex=rnc?.ways?.length?wayIndex(rnc.ways):null;
 const knownRnc=new Array(n).fill(null);let rncKm=0,osmKm=0,unspecifiedUrbanKm=0;
 if(rncIndex)for(let i=0;i<n;i++){
  const hit=matchWay(points[i].mid,rncIndex,undefined,45);
  if(hit&&!hit.ambiguous){const c=window.GCRNCCore.classify(hit.way.tags?.rncProps||{});
   if(c.base){knownRnc[i]=c.base;rncKm+=step;if(c.urbanSurfaceUnknown)unspecifiedUrbanKm+=step;}}
 }
 // Si la capa importada solo cubre un recorte o tiene atributos vacíos, los
 // demás tramos se buscan en OSM. La RNC válida siempre tiene prioridad.
 const needsOSM=rncKm < route.km*.985;
 let osm=null,osmIndex=null;
 if(needsOSM){osm=await getRoadEvidence(route);osmIndex=wayIndex(osm.ways||[]);}
 const segments=[];
 for(let i=0;i<n;i++){
  const {t,mid}=points[i];let base=knownRnc[i];
  if(!base&&osmIndex){const hit=matchWay(mid,osmIndex,undefined,40);
   if(hit&&!hit.ambiguous){base=roadBase(hit.way?.tags||{}).base;if(base)osmKm+=step;}}
  const grade=gradeAt(t,terrain);
  segments.push({grade:grade.grade,road:base,km:step});
 }
 const total=core.aggregate(segments,route.km);
 if(Array.isArray(terrain)&&terrain.length>1){for(let j=1;j<terrain.length;j++){
  const dh=Number(terrain[j]?.e)-Number(terrain[j-1]?.e);
  if(Number.isFinite(dh)&&Math.abs(dh)>=5){if(dh>0)total.ascent+=dh;else total.descent-=dh;}
 }}
 const partialError=rnc?.partialError||osm?.partialError||null;
 return {...total,coverage:total.classifiedKm/route.km,
  evidenceStatus:rncKm?`RNC ${Math.round(100*rncKm/route.km)}% · OSM complementario`:'OpenStreetMap provisional · RNC sin cobertura',
  dataSource:rncKm?`${rnc.source} + OSM para huecos`:'OpenStreetMap (sin RNC disponible)',
  partialError,waysCount:rnc?.ways?.length||osm?.ways?.length||0,
  rncKm,osmKm,unspecifiedUrbanKm,elevationAvailable:Array.isArray(terrain)&&terrain.length>1,
  model:'GC-FIS-2.2'};
}
function refresh(route,terrain,{force=false}={}){const k=key(route);if(!force&&cache.has(k)&&!terrain)return Promise.resolve(cache.get(k));
 const seq=(sequence.get(k)||0)+1;sequence.set(k,seq);
 const work=analyze(route,terrain).then(v=>{if(seq===sequence.get(k)){cache.set(k,v);route.roadPhysics=v;document.dispatchEvent(new CustomEvent('geocoast:road-physics-updated',{detail:{route,physics:v}}));}return v;});return work;
}
window.GCRoadPhysics={analyze:refresh,get:(route)=>route?.roadPhysics||cache.get(key(route))||null,version:'GC-FIS-2.2'};

// El reemplazo de la fuente oficial invalida perfiles RNC/OSM calculados previamente.
document.addEventListener('geocoast:rnc-source-changed',()=>cache.clear());
