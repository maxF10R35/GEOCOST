/* GeoCost SC · Motor puro de selección conservadora de casetas
 * Fuente geográfica: OSM/Overpass; arancel: catálogo CAPUFE/FONADIN local.
 * OSM no comprueba la aplicación efectiva del cobro ni la categoría de ejes.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GCTollCore=api;})(typeof window==='undefined'?null:window,()=>{
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\b(PLAZA|CASETA|COBRO|PEAJE|DE|DEL|LA|EL|AUTOPISTA|TRONCAL|CUOTA|NUMERO|NO)\b/g,' ').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const rad=Math.PI/180;
 function km(a,b){const dLat=(a[0]-b[0])*rad,dLon=(a[1]-b[1])*rad,lat=(a[0]+b[0])*rad/2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2)));}
 function pointDistanceMeters(point,a,b){const x=(point[1]-a[1])*111320*Math.cos(point[0]*rad),y=(point[0]-a[0])*111320;
 const vx=(b[1]-a[1])*111320*Math.cos(point[0]*rad),vy=(b[0]-a[0])*111320;
 const t=Math.max(0,Math.min(1,(vx*x+vy*y)/Math.max(.000001,vx*vx+vy*vy)));return Math.hypot(x-t*vx,y-t*vy);}
 function nearRouteKm(p,coords){let best=Infinity;for(let i=1;i<(coords||[]).length;i++)best=Math.min(best,pointDistanceMeters(p,coords[i-1],coords[i]));return best/1000;}
 function takeAlongRoute(coords,max=100){if(!Array.isArray(coords)||coords.length<2)return [];
 const points=[coords[0]],target=Math.max(1,Math.ceil(coords.length/(max-1)));
 for(let i=target;i<coords.length-1;i+=target)points.push(coords[i]);points.push(coords.at(-1));
 return points.slice(0,max).filter(x=>Array.isArray(x)&&Number.isFinite(Number(x[0]))&&Number.isFinite(Number(x[1]))).map(x=>[+Number(x[0]).toFixed(5),+Number(x[1]).toFixed(5)]);}
 function matchTolls(geo,prices,vehicleClass,coords){
  const candidates=[];const unknown=[];const valid=Array.isArray(prices)?prices:[];
  const gates=(geo||[]).filter(g=>Number.isFinite(+g.lat)&&Number.isFinite(+g.lon))
   .map(g=>({...g,routeGapKm:nearRouteKm([+g.lat,+g.lon],coords)})).filter(g=>g.routeGapKm<=.18)
   .sort((a,b)=>a.routeGapKm-b.routeGapKm);
  const distinct=[];
  for(const p of gates){const name=norm(p.name||p.ref||'');const dupe=distinct.some(old=>km([old.lat,old.lon],[+p.lat,+p.lon])<.45&&(name===norm(old.name||old.ref||'')||!name||!norm(old.name||old.ref||'')));
   if(!dupe)distinct.push({...p,lat:+p.lat,lon:+p.lon});}
  for(const gate of distinct){const name=norm(gate.name||gate.ref||'');if(!name||name.length<3){unknown.push({...gate,reason:'Caseta geográfica sin nombre verificable en OSM'});continue;}
   const candidatesByName=valid.filter(r=>{const n=norm(r.name);return n&&n===name;});
   const withPrice=candidatesByName.map(r=>({r,price:Number(r.rates?.[vehicleClass])})).filter(x=>Number.isFinite(x.price)&&x.price>0);
   const uniquePrices=[...new Set(withPrice.map(x=>Math.round(x.price*100)))];
   if(uniquePrices.length!==1){unknown.push({...gate,reason:!withPrice.length?'Sin tarifa CAPUFE/FONADIN verificable por nombre y categoría':'Tarifas por sección distintas: requiere verificar tramo'});continue;}
   const record=withPrice.find(x=>x.price*100===uniquePrices[0])||withPrice[0];
   candidates.push({name:gate.name||record.r.name,lat:gate.lat,lon:gate.lon,osmId:gate.id,tariffId:record.r.id,section:record.r.section,vehicleClass,oneWayGross:record.price,source:'OSM + CAPUFE/FONADIN',effective:record.r.effective,confidence:'nombre y clase; tramo por verificar',routeGapMeters:Math.round(gate.routeGapKm*1000)});
  }
  return {identified:candidates,unpriced:unknown,oneWayGross:candidates.reduce((a,b)=>a+b.oneWayGross,0),totalSeen:distinct.length,complete:false,notice:'La cobertura de casetas en OSM/CAPUFE no es exhaustiva; los importes identificados son preliminares hasta validar tramo y sentido.'};
 }
 function vehicleClass(type){return {'Camioneta':'C2','Rabón':'C2','Torton':'C3','Tráiler':'C5','Full':'C9'}[type]||'C2';}
 return {norm,km,nearRouteKm,takeAlongRoute,matchTolls,vehicleClass};
});
