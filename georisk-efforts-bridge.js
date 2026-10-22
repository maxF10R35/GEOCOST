import {calculateEfforts, EFFORT_CLASSES, METHOD_VERSION, routeAxis, pointAt} from './esfuerzos.js';
import {urbanAreaFromOSM} from './zonas.js';

// Consultas OSM por ventanas del corredor, no por bounding box completo de un viaje largo.
const cache = new Map();
const routeEvidenceCache=new Map();
const overpassServers = ['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
function sampleCorridor(coords, spacing=1400) {
  const axis=routeAxis(coords), count=Math.min(180,Math.max(2,Math.ceil(axis.total/spacing)+1));
  return Array.from({length:count},(_,i)=>pointAt(axis,axis.total*i/(count-1)));
}
async function osmCorridor(coords){
 const points=sampleCorridor(coords,650),seen=new Map();
 const groups=[];for(let i=0;i<points.length;i+=10)groups.push(points.slice(i,i+10));
 // No truncar rutas largas: consultar todos los bloques en lotes acotados.
 // Consultas de corredor acotadas y concurrentes, con caché por bloque.
 async function loadGroup(group){
  const key=group.map(p=>p.map(v=>v.toFixed(3)).join(',')).join('|');
  if(cache.has(key))return cache.get(key);
  const queries=group.map(([lon,lat])=>`way(around:160,${lat.toFixed(6)},${lon.toFixed(6)})[highway];way(around:170,${lat.toFixed(6)},${lon.toFixed(6)})[landuse~"^(residential|commercial|retail|industrial)$"];`).join('');
  const query=`[out:json][timeout:25];(${queries});out geom;`;
  let lastError;
  for(const server of overpassServers){
   try{
    const response=await fetch(server,{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw Error('OSM HTTP '+response.status);
    const result=await response.json();const els=result.elements||[];cache.set(key,els);return els;
   }catch(e){lastError=e;}
  }
  throw lastError||Error('OSM no disponible');
 }
 const successes=[],errors=[];
 // Limit concurrency to 3 remote requests per corridor.
 for(let i=0;i<groups.length;i+=2){
  const settled=await Promise.allSettled(groups.slice(i,i+2).map(loadGroup));
  for(const r of settled)r.status==='fulfilled'?successes.push(r.value):errors.push(r.reason?.message||'Error OSM');
 }
 for(const els of successes)for(const el of els)if(el.type==='way'&&el.geometry?.length>1)seen.set(el.type+el.id,el);
 return {ways:[...seen.values()].filter(e=>e.tags?.highway),urbanAreas:[...seen.values()].map(urbanAreaFromOSM).filter(Boolean),partialError:errors.length?`${errors.length} bloque(s) OSM sin respuesta`:null};
}
window.GeoRiskEfforts={
 async analyze(route,samples,options={}){
  if(!route?.coords?.length)return null;
  const coords=route.coords.map(([lat,lon])=>[lon,lat]);
  let pos=0;
  const segments=(samples||[]).slice(1).map((s,i)=>{
   const prev=samples[i], meters=distanceKm(prev.p,s.p)*1000;
   const item={startMeters:pos,endMeters:pos+meters,e1:prev.e,e2:s.e,sampleMeters:meters};pos+=meters;return item;
  });
  const scale=pos>0?(route.km*1000)/pos:1;
  for(const s of segments){s.startMeters*=scale;s.endMeters*=scale;s.sampleMeters*=scale;}
  const geo={coords,distance:route.km*1000,raw:route.raw||{},openRoads:{urbanAreas:[]}};
  let evidenceError=null,osm;
  const evidenceKey=coords.length+':'+coords[0].join(',')+':'+coords.at(-1).join(',')+':'+route.km.toFixed(3);
  try{
   if(options.skipOSM)throw Error('Pendiente de validación OpenStreetMap; clasificación preliminar');
   osm=routeEvidenceCache.get(evidenceKey);
   if(!osm){if(options.reuseEvidence)throw Error('Sin caché OSM');osm=await osmCorridor(coords);routeEvidenceCache.set(evidenceKey,osm);}
   geo.openRoads.urbanAreas=osm.urbanAreas;evidenceError=osm.partialError||null;
  }catch(e){evidenceError=e.message;osm={ways:[],urbanAreas:[]};}
  const result=calculateEfforts(geo,{effortProfile:segments},osm.ways);
  result.evidenceError=evidenceError;
  result.evidenceStatus=evidenceError?'parcial/no disponible':'consulta completada';
  result.waysCount=osm.ways.length;
  result.urbanAreasCount=osm.urbanAreas.length;
  return result;
 },classes:EFFORT_CLASSES,version:METHOD_VERSION
};
function distanceKm(a,b){const rad=Math.PI/180,lat=(b[0]-a[0])*rad,lon=(b[1]-a[1])*rad;const h=Math.sin(lat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(lon/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));}
