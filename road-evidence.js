/* GeoCoast: geometrias viales OSM. Independiente de cualquier indice de esfuerzo GeoRisk.
   La informacion incompleta es marcada como desconocida; no se asignan tramos ficticios. */
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

// Consultas OSM por ventanas del corredor, no por bounding box completo de un viaje largo.
const cache = new Map();
const routeEvidenceCache=new Map();
const pendingRoadEvidence=new Map();
export async function getRoadEvidence(route){
 const coords=(route?.coords||[]).map(([lat,lon])=>[lon,lat]);
 if(coords.length<2)throw Error("Ruta sin geometría");
 const key=coords.length+":"+coords[0].join(",")+":"+coords.at(-1).join(",")+":"+route.km.toFixed(3);
 if(routeEvidenceCache.has(key))return routeEvidenceCache.get(key);
 if(!pendingRoadEvidence.has(key))pendingRoadEvidence.set(key,osmCorridor(coords).then(result=>{routeEvidenceCache.set(key,result);return result}).finally(()=>pendingRoadEvidence.delete(key)));
 return pendingRoadEvidence.get(key);
}

const overpassServers = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
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
  const queries=group.map(([lon,lat])=>`way(around:160,${lat.toFixed(6)},${lon.toFixed(6)})[highway];`).join('');
  const query=`[out:json][timeout:25];(${queries});out geom;`;
  let lastError;
  for(const server of overpassServers){
   try{
    const response=await fetch(server,{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(11000)});
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
 return {ways:[...seen.values()].filter(e=>e.tags?.highway),partialError:errors.length?`${errors.length} bloque(s) OSM sin respuesta`:null};
}
