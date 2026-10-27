/* Consulta cartográfica puntual de casetas OSM. No devuelve precios inventados.
 * El catálogo de tarifas se cruza en el navegador, no en este proxy.
 * Netlify Function CommonJS, sin llaves externas.
 */
const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
const valid=x=>Array.isArray(x)&&x.length===2&&Number.isFinite(x[0])&&Number.isFinite(x[1])&&x[0]>=14&&x[0]<=33&&x[1]>=-119&&x[1]<=-86;
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return{statusCode:405,body:'Método no permitido'};
 let points;
 try{points=JSON.parse(event.body||'{}').points;}catch{return{statusCode:400,body:'JSON inválido'}}
 if(!Array.isArray(points)||points.length<2||points.length>105||points.some(x=>!valid(x)))return{statusCode:400,body:'Coordenadas inválidas o demasiados puntos'};
 const path=points.map(([lat,lon])=>`${lat.toFixed(5)},${lon.toFixed(5)}`).join(',');
 const query=`[out:json][timeout:18];(node["barrier"="toll_booth"](around:250,${path});node["highway"="toll_gantry"](around:250,${path}););out body 180;`;
 let last='No se pudo consultar cartografía';
 for(const ep of endpoints){try{
   const res=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(19500)});
   if(!res.ok)throw Error('OSM '+res.status);
   const json=await res.json();const gates=(json.elements||[]).filter(x=>x.type==='node'&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map(x=>({id:`osm:${x.id}`,name:String(x.tags?.name||x.tags?.['name:es']||'').slice(0,150),ref:String(x.tags?.ref||'').slice(0,60),lat:x.lat,lon:x.lon}));
   return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=900'},body:JSON.stringify({gates,source:'OpenStreetMap/Overpass',complete:false})};
  }catch(e){last=e.message||String(e)}}
 return{statusCode:503,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:last,source:'OpenStreetMap/Overpass',complete:false})};
};
