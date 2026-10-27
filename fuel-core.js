/* Motor espacial por polígonos ZT SAP: el punto pertenece a una entidad sólo si está dentro de uno de sus polígonos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCStateFuelCore=api;})(typeof window!=='undefined'?window:globalThis,function(){
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={estadodemexico:'mexico',edodemexico:'mexico',mexico:'mexico',cdmx:'ciudaddemexico',distritofederal:'ciudaddemexico',coahuiladezaragoza:'coahuila',guanajuatoztkml:'guanajuato',michoacandeocampo:'michoacan',veracruzdeignaciodelallave:'veracruz'};
 const key=s=>aliases[norm(s)]||norm(s);
 function inBBox(lon,lat,b){return Array.isArray(b)&&lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3]}
 function inRing(lon,lat,ring){let flag=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])flag=!flag;}return flag}
 function inZT(lon,lat,z){if(!inBBox(lon,lat,z.bbox))return false;return (z.rings||[]).some(r=>inRing(lon,lat,r))}
 function hav(a,b){const d=Math.PI/180,lat=(b[0]-a[0])*d,lon=(b[1]-a[1])*d,v=Math.sin(lat/2)**2+Math.cos(a[0]*d)*Math.cos(b[0]*d)*Math.sin(lon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(v)))}
 // Muestreo regular del eje vial. Evita evaluar decenas de miles de vertices OSRM
 // contra los poligonos SAP en cada cotizacion y conserva la participacion km por estado.
 function *pieces(coords,kmStep=1){
  if(!Array.isArray(coords)||coords.length<2)return;
  const cumul=[0];
  for(let i=1;i<coords.length;i++){
   const km=hav(coords[i-1],coords[i]);
   cumul.push(cumul.at(-1)+(Number.isFinite(km)&&km>=0&&km<=500?km:0));
  }
  const total=cumul.at(-1);if(!(total>0))return;
  // 0.6–2.5 km, techo 1,200 muestras; una frontera se aproxima a la resolución indicada.
  const step=Math.max(.6,Math.min(2.5,Math.max(Number(kmStep)||1,total/1200)));
  const n=Math.max(1,Math.min(1200,Math.ceil(total/step)));
  let j=1;
  for(let i=0;i<n;i++){
   const at=total*(i+.5)/n;
   while(j<cumul.length-1&&cumul[j]<at)j++;
   const segment=Math.max(1e-12,cumul[j]-cumul[j-1]);
   const t=Math.max(0,Math.min(1,(at-cumul[j-1])/segment));
   const a=coords[j-1],b=coords[j];
   yield {lat:a[0]+(b[0]-a[0])*t,lon:a[1]+(b[1]-a[1])*t,km:total/n};
  }
 }
 function detect(lon,lat,groups){const candidates=[];for(const g of groups){if(!inBBox(lon,lat,g.bbox))continue;if(g.polygons.some(z=>inZT(lon,lat,z)))candidates.push(key(g.state))}return [...new Set(candidates)].length===1?candidates[0]:null}
 function distribute(coords,groups,routeKm){const byState={},points={},unknown={km:0};let lineKm=0;for(const p of pieces(coords)){const st=detect(p.lon,p.lat,groups);lineKm+=p.km;if(st){byState[st]=(byState[st]||0)+p.km;const c=points[st]||(points[st]={lat:0,lon:0,km:0});c.lat+=p.lat*p.km;c.lon+=p.lon*p.km;c.km+=p.km;}else unknown.km+=p.km;}const factor=routeKm>0&&lineKm>0?routeKm/lineKm:1;Object.keys(byState).forEach(k=>byState[k]*=factor);unknown.km*=factor;const centers={};for(const [k,c] of Object.entries(points))centers[k]=[c.lat/c.km,c.lon/c.km];return {byState,centers,unknownKm:unknown.km,matchedKm:Object.values(byState).reduce((s,v)=>s+v,0),routeKm:routeKm||lineKm,geometryKm:lineKm}}
 function weighted(distribution,prices,fallback){const total=distribution.routeKm||0;let weightedTotal=0,pricedKm=0;
  for(const [st,km] of Object.entries(distribution.byState)){const p=prices[st];if(Number.isFinite(p)&&p>=10&&p<=60){weightedTotal+=km*p;pricedKm+=km;}}
  const unpriced=Math.max(0,total-pricedKm);
  // El diésel del flete se basa SOLO en precios estatales observados, ponderados por km
  // conocidos. Si faltan tramos, no se introduce un supuesto nacional silencioso.
  const price=pricedKm>0?weightedTotal/pricedKm:NaN;
  return {price,pricedKm,unpricedKm:unpriced,coverage:total>0?pricedKm/total:0,source:unpriced<=total*.001?'estatal completo':'promedio de estados reconocidos · cobertura parcial'};
 }

 return {norm,key,inBBox,inRing,inZT,hav,pieces,detect,distribute,weighted};
});
