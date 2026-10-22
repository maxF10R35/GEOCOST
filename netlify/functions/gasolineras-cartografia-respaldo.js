/* GeoCoast: nationwide geolocated fuel stations, source SEMARNAT ArcGIS public MapServer layer 5.
   Coordinates represent real stations. The published layer does NOT provide verified current pump prices.
   No fabricated station-level prices; display only official verifiable prices if independent permit join exists.
   Queries use geographic bounding boxes (no search radius), then load ArcGIS object ID batches.
*/
'use strict';
const ENDPOINT='https://geomatica.semarnat.gob.mx/arcgis/rest/services/APLICACIONES/EstacionesServicio/MapServer/5/query';
const MX=[-118.7,14.0,-86.3,33.5];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const inside=(lon,lat)=>lon>=-118.7&&lon<=-86.3&&lat>=14&&lat<=33.5;
function bboxFromQuery(q){const vals=String(q?.bbox||MX.join(',')).split(',').map(Number);if(vals.length!==4||!vals.every(Number.isFinite))throw Error('bbox inválido');const b=[Math.max(MX[0],vals[0]),Math.max(MX[1],vals[1]),Math.min(MX[2],vals[2]),Math.min(MX[3],vals[3])];if(b[0]>=b[2]||b[1]>=b[3])throw Error('Área fuera de México');return b;}
async function fromGIS(args){const url=ENDPOINT+'?'+new URLSearchParams({...args,f:'json'});const r=await fetch(url,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('SEMARNAT HTTP '+r.status);const j=await r.json();if(j.error)throw Error('SEMARNAT: '+(j.error.message||'consulta rechazada'));return j;}
function normalize(feature){const props=feature.attributes||{},geometry=feature.geometry||{};const lat=Number(geometry.y),lon=Number(geometry.x);if(!inside(lon,lat))return null;const id=String(props.ID||props.OBJECTID||'').slice(0,90);const dieselAvailable=/^(si|sí|yes|true|1|disponible)$/i.test(String(props.DIESEL||'').trim());return {id,lat,lon,dieselAvailable,name:'Estación de servicio '+id,brand:'',address:'',diesel:null,price:null,priceDate:null,origin:'SEMARNAT',permit:/^PL\/[\d]+\/EXP\/ES\/\d{4}$/i.test(id)?id:null};}
async function loadStations(bbox){const envelope=JSON.stringify({xmin:bbox[0],ymin:bbox[1],xmax:bbox[2],ymax:bbox[3],spatialReference:{wkid:4326}});
 const opts={where:'1=1',geometry:envelope,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'};
 const ids=await fromGIS({...opts,returnIdsOnly:'true',returnGeometry:'false'});
 const unique=[...new Set(ids.objectIds||[])];if(unique.length>24000)throw Error('Demasiados registros para esta vista');
 const batches=[];for(let i=0;i<unique.length;i+=450)batches.push(unique.slice(i,i+450));
 const stations=[];for(let offset=0;offset<batches.length;offset+=5){const block=batches.slice(offset,offset+5);
  const results=await Promise.allSettled(block.map(chunk=>fromGIS({objectIds:chunk.join(','),outFields:'OBJECTID,ID,DIESEL,MAGNA,PREMIUM',outSR:'4326',returnGeometry:'true'})));
  for(const r of results)if(r.status==='fulfilled')for(const feature of r.value.features||[]){const s=normalize(feature);if(s)stations.push(s)}
 }
 return {count:stations.length,matchedIds:unique.length,partial:stations.length<unique.length,stations};
}
async function fallbackOSM(bbox){
 const [w,s,e,n]=bbox;
 const q=`[out:json][timeout:20];(node["amenity"="fuel"](${s},${w},${n},${e});way["amenity"="fuel"](${s},${w},${n},${e}););out center 5000;`;
 const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];let error='';
 for(const ep of endpoints){try{const r=await fetch(ep+'?data='+encodeURIComponent(q),{signal:AbortSignal.timeout(23000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const stations=[];const seen=new Set();for(const x of j.elements||[]){const lat=Number(x.lat??x.center?.lat),lon=Number(x.lon??x.center?.lon);if(!inside(lon,lat))continue;const id=x.type+':'+x.id;if(seen.has(id))continue;seen.add(id);stations.push({id,lat,lon,name:String(x.tags?.name||x.tags?.brand||'Estación de servicio').slice(0,150),brand:String(x.tags?.brand||''),permit:null,diesel:null,price:null,priceDate:null,origin:'OpenStreetMap',dieselAvailable:/^(yes|designated|only|true|1)$/i.test(String(x.tags?.['fuel:diesel']||x.tags?.diesel||''))})}return{count:stations.length,matchedIds:stations.length,partial:(j.elements||[]).length>=5000,stations,source:'OpenStreetMap (respaldo; área visible)',priceStatus:'OSM no reporta precios de bomba'};}catch(ex){error=ex.message}}throw Error('Fuentes nacionales no disponibles: '+error)
}
exports.handler=async(event)=>{try{const bbox=bboxFromQuery(event.queryStringParameters||{});let data,source='SEMARNAT (ArcGIS estaciones nacionales)';try{data=await loadStations(bbox)}catch(ex){data=await fallbackOSM(bbox);source=data.source;}
return{statusCode:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=900,s-maxage=43200','access-control-allow-origin':'*'},body:JSON.stringify({source,sourceUrl:'https://geomatica.semarnat.gob.mx/arcgis/rest/services/APLICACIONES/EstacionesServicio/MapServer/layers',bbox,...data,priceStatus:'La cartografía de coordenadas no dispone de precios diarios individuales verificables'})};}catch(error){return{statusCode:502,headers:{'content-type':'application/json'},body:JSON.stringify({error:String(error.message||error),source:'SEMARNAT / OSM'})}}};
exports._normalize=normalize;exports._bboxFromQuery=bboxFromQuery;
