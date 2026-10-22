/* GeoCost SC: Stations by actual coordinates and reported prices.
 * Join public station register /places and price register /prices by place_id.
 * Keep observation dates; never replace missing individual prices with state averages.
 * Cached on demand for six hours per warm Netlify instance; no API key.
 * Geographic fallback, when feed fails, is SEMARNAT/OSM with no individual prices.
 */
'use strict';
const ROOT='https://publicacionexterna.azurewebsites.net/publicaciones';
const MAX_BBOX=[-118.8,14,-86,33.6];
const expires=6*60*60*1000;
let cache=null,cacheTime=0,pending=null;
const value=(s)=>String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
const tag=(xml,name)=>value((xml.match(new RegExp('<(?:\\w+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?'+name+'>','i'))||[])[1]);
const attr=(text,name)=>value((text.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*["\\\']([^"\\\']+)["\\\']','i'))||[])[1]);
function boundsOf(query){const v=String(query?.bbox||MAX_BBOX.join(',')).split(',').map(Number);if(v.length!==4||!v.every(Number.isFinite))throw Error('bbox inválido');const a=[Math.max(v[0],MAX_BBOX[0]),Math.max(v[1],MAX_BBOX[1]),Math.min(v[2],MAX_BBOX[2]),Math.min(v[3],MAX_BBOX[3])];if(a[0]>=a[2]||a[1]>=a[3])throw Error('Área fuera de México');return a;}
const inBounds=(s,b)=>s.lon>=b[0]&&s.lon<=b[2]&&s.lat>=b[1]&&s.lat<=b[3];
function parsePlaces(xml){const rows=[];for(const m of xml.matchAll(/<place\b([^>]*)>([\s\S]*?)<\/place>/gi)){
 const id=attr(m[1],'place_id');if(!id)continue;const part=m[2];const loc=tag(part,'location')||part;
 const lon=Number(tag(loc,'x')),lat=Number(tag(loc,'y'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lon<-119||lon>-86||lat<14||lat>34)continue;
 rows.push({id,lon,lat,name:tag(part,'name').slice(0,120)||'Estación de servicio',brand:tag(part,'brand').slice(0,80)||tag(part,'brad').slice(0,80),address:tag(loc,'address_street').slice(0,160),origin:'Registro de estaciones / CNE'});
 }return rows;}
function parsePrices(xml){const prices=new Map();for(const m of xml.matchAll(/<place\b([^>]*)>([\s\S]*?)<\/place>/gi)){
 const id=attr(m[1],'place_id');if(!id)continue;let row=prices.get(id)||{};
 for(const match of m[2].matchAll(/<gas_price\b([^>]*)>([^<]*)<\/gas_price>/gi)){
 const ty=attr(match[1],'type').toLowerCase().replace(/[^a-z]/g,'');const k=ty==='diesel'||ty==='dieselautomotriz'?'diesel':ty==='regular'||ty==='magna'?'regular':ty==='premium'?'premium':null;if(!k)continue;
 const price=Number(match[2]);if(!(price>=5&&price<=70))continue;
 const date=attr(match[1],'update_time');const validDate=/^\d{4}-\d{2}-\d{2}/.test(date)?date.slice(0,10):null;
 if(!row[k]||(!row[k].date&&validDate)||(validDate&&row[k].date&&validDate>=row[k].date))row[k]={price,date:validDate};
 }
 if(Object.keys(row).length)prices.set(id,row);
 }return prices;}
function combine(places,prices){return places.map(p=>{const r=prices.get(p.id)||{};return {...p,prices:r};});}
async function getFeed(url){const resp=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/xml,text/xml,*/*'}});if(!resp.ok)throw Error('Fuente pública HTTP '+resp.status);const txt=await resp.text();if(!txt.includes('<place'))throw Error('Registro XML sin estaciones');return txt;}
async function pull(){const [placesText,pricesText]=await Promise.all([getFeed(ROOT+'/places'),getFeed(ROOT+'/prices')]);const places=parsePlaces(placesText);if(places.length<1000)throw Error('El registro público de estaciones está incompleto');const prices=parsePrices(pricesText);if(prices.size<1000)throw Error('El archivo de precios está incompleto');return {stations:combine(places,prices),places:places.length,prices:prices.size,updatedAt:new Date().toISOString()};}
async function getCached(){if(cache&&Date.now()-cacheTime<expires)return cache;if(!pending)pending=pull().then(out=>{cache=out;cacheTime=Date.now();return out;}).finally(()=>{pending=null});return pending;}
exports.handler=async(event)=>{
 const b=boundsOf(event.queryStringParameters||{});
 try{
  const all=await getCached();const stations=all.stations.filter(s=>inBounds(s,b));
  const countWithPrice=stations.filter(s=>Object.keys(s.prices).length).length;
  return {statusCode:200,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'public,max-age=900,s-maxage=14400'},body:JSON.stringify({source:'Registro público de estaciones y precios CNE/CRE',sourceUrl:ROOT,updatedAt:all.updatedAt,stations,number:stations.length,fullTotal:all.places,withPrice:countWithPrice,bbox:b,partial:false})};
 }catch(error){
  // The fallback contains real coordinates but must never be presented as station-specific prices.
  try{const fallback=require('./gasolineras-cartografia-respaldo.js');const res=await fallback.handler(event);if(res.statusCode===200){const j=JSON.parse(res.body);return {...res,body:JSON.stringify({...j,source:j.source+' · respaldo sin precios individuales',warning:'No se pudieron consultar los XML de CNE: '+String(error.message||error),pricesVerified:false})};}}catch(_ignored){}
  return{statusCode:503,headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({error:'Fuente de estaciones y precios no disponible: '+String(error.message||error)+'. Verifica el despliegue de Netlify Functions. No se muestran precios inventados.'})};
 }
};
exports._test={parsePlaces,parsePrices,combine,boundsOf};
