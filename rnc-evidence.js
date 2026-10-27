/* RNC 2025: GeoJSON cargado en sesión, o teselas generadas con tools/convert_rnc.py.
   La ausencia de .shp/.dbf NO produce información simulada. */
import {routeAxis,pointAt} from './road-evidence.js';
const core=window.GCRNCCore;
const TILE=0.2;
let uploadedWays=null,version=0,manifestPromise=null;
const tileCache=new Map();
const tileName=(lon,lat)=>`${Math.floor(lon/TILE)}_${Math.floor(lat/TILE)}`;
async function getManifest(){
 if(!manifestPromise)manifestPromise=fetch('data/rnc/manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null);
 return manifestPromise;
}
async function getTile(id){
 if(!tileCache.has(id))tileCache.set(id,fetch(`data/rnc/tiles/${id}.ndjson`).then(r=>r.ok?r.text():'').then(t=>t.split('\n').filter(Boolean).map(l=>JSON.parse(l))).catch(()=>[]));
 return tileCache.get(id);
}
function samples(route){const coords=(route?.coords||[]).map(([lat,lon])=>[lon,lat]),axis=routeAxis(coords),num=Math.min(450,Math.max(15,Math.ceil(axis.total/380)));
 return Array.from({length:num},(_,i)=>pointAt(axis,axis.total*(i+.5)/num));}
function neededTiles(route,manifest){const ids=new Set(),available=new Set(manifest.tiles||[]);
 for(const [lon,lat] of samples(route)){
  const ox=Math.floor(lon/TILE),oy=Math.floor(lat/TILE);
  // Solo teselas vecinas cuando el punto se acerca a un borde (40–55 m de tolerancia).
  const left=(lon-ox*TILE)<.0012,right=((ox+1)*TILE-lon)<.0012;
  const bottom=(lat-oy*TILE)<.0012,top=((oy+1)*TILE-lat)<.0012;
  for(const dx of [0,...(left?[-1]:[]),...(right?[1]:[])])for(const dy of [0,...(bottom?[-1]:[]),...(top?[1]:[])]){
   const id=`${ox+dx}_${oy+dy}`;if(available.has(id))ids.add(id);
  }
 }return [...ids];}
function parseUploaded(obj){const fc=obj?.type==='FeatureCollection'?obj.features:obj?.type==='Feature'?[obj]:null;
 if(!Array.isArray(fc))throw Error('El archivo debe ser GeoJSON de líneas con sus atributos RNC.');
 if(fc.length>125000)throw Error('Archivo muy grande para navegador; utilice el conversor SHP → teselas incluido en el ZIP.');
 return fc.flatMap((f,i)=>core.toWay(f,i));
}
export async function loadLocalGeoJSON(file){
 if(!file)throw Error('No se seleccionó un archivo.');if(file.size>85*1024*1024)throw Error('GeoJSON >85 MB: conviértalo a teselas con el script del proyecto.');
 const data=JSON.parse(await file.text()),ways=parseUploaded(data);
 if(!ways.length)throw Error('GeoJSON sin segmentos lineales utilizables.');
 uploadedWays=ways;version++;document.dispatchEvent(new CustomEvent('geocoast:rnc-source-changed',{detail:{ways:ways.length}}));
 return {ways:ways.length,version};
}
export async function getRncEvidence(route){
 if(uploadedWays)return {ways:uploadedWays,source:'RNC GeoJSON importado en sesión',partialError:null,version};
 const manifest=await getManifest();
 if(!manifest||manifest.format!=='geocoast-rnc-tiles-v1'||manifest.tileDegrees!==TILE)return null;
 const ids=neededTiles(route,manifest),ways=[],errors=[];
 for(let i=0;i<ids.length;i+=8){
  const chunks=await Promise.allSettled(ids.slice(i,i+8).map(getTile));
  for(const r of chunks){if(r.status==='fulfilled')ways.push(...r.value);else errors.push(String(r.reason))}
 }
 return {ways,source:`Red Nacional de Caminos ${manifest.year||'2025'} · teselas locales`,partialError:errors.length?`${errors.length} teselas fallaron`:null,version};
}
export async function status(){const m=await getManifest();return uploadedWays?`RNC GeoJSON en memoria (${uploadedWays.length} elementos)`:(m?`RNC ${m.year||'2025'}: ${m.tiles?.length||0} teselas instaladas`:'RNC nacional sin instalar: faltan .shp y .dbf. Se usa OSM provisionalmente.');}
window.GCRNC={loadLocalGeoJSON,status};
