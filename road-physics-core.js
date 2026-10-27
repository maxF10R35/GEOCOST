/* GeoCoast - normalizador físico independiente de los índices de esfuerzos GeoRisk.
   Ningún coeficiente es un valor certificado por IMT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GCRoadPhysicsCore=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const classes=['urbano','autopista_sin','autopista_con','pavimento_sin','pavimento_con','terraceria_sin','terraceria_con'];
 const zero=()=>Object.fromEntries(classes.map(k=>[k,0]));
 function aggregate(samples,km){const rows=zero();let known=0,steep=0,ascent=0,descent=0;for(const s of samples){const d=Math.max(0,Number(s.km)||0);if(!d)continue;const road=s.road;const grade=Number.isFinite(s.grade)?Number(s.grade):null;const mount=grade!==null&&Math.abs(grade)>=3.5;const key=road==='urbano'?'urbano':road&&['autopista','pavimento','terraceria'].includes(road)?road+'_'+(mount?'con':'sin'):null;
  if(key){rows[key]+=d;known+=d;}if(mount)steep+=d;
  // Sólo diferencia significativa entre muestras; ruido altimétrico <5m no se factura.
  const dz=Number(s.deltaHeight);if(Number.isFinite(dz)&&Math.abs(dz)>=5){if(dz>0)ascent+=dz;else descent-=dz;}
 }
 const factor=km>0&&samples.length&&known>km+.1?km/known:1;
 if(factor!==1)Object.keys(rows).forEach(k=>rows[k]*=factor);
 known=Object.values(rows).reduce((a,b)=>a+b,0);
 return {rows:classes.map(id=>({id,km:Math.round(rows[id]*1000)/1000})),classifiedKm:known,unknownKm:Math.max(0,km-known),steepKm:steep,ascent,descent,model:'GC-FIS-2.0'};
 }
 return {classes,aggregate};
});
