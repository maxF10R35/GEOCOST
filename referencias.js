/* GeoCost SC · referencias de tarifa cercanas (lógica pura; corre en navegador y Node).
 * Candidatos: mismo IdOrigen y TipoConexion; ZT por haversine ≤R; |Kms−km| ≤ max(10 %, 5 km); Kms nulo se incluye (kmSinDato). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.GCReferencias=Object.assign(root.GCReferencias||{},api);})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const RADIOS=[5,10,15],MIN_PINES=3,MAX_PINES=40;
 // [sacos, granel]; si cambia el catálogo de TipoConexion, ajustar solo esta tabla.
 const TIPOS={Camioneta:['CAMIONETA','CAMIONETA'],'Rabón':['RABON','RABON'],Torton:['TORTON','TOR-GRN'],'Tráiler':['TRAILER','TRAILERGRN'],Full:['FULL','FULL-GRN']};
 const tipoConexion=(unidad,granel)=>(TIPOS[unidad]||[])[granel?1:0]||null;
 const rad=Math.PI/180;
 const hav=(a,b)=>{const p=(b[0]-a[0])*rad,q=(b[1]-a[1])*rad,h=Math.sin(p/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(q/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)));};
 const mediana=xs=>{const v=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;};
 const precioCompacto=v=>v>=1000?'$'+(v/1000).toFixed(1)+'k':'$'+Math.round(v);
 function indexar(json){
  const ix=Object.fromEntries(json.cols.map((k,i)=>[k,i])),map=new Map();
  for(const r of json.rows){const o={};for(const k of json.cols)o[k]=r[ix[k]];const key=o.IdOrigen+'|'+o.Tipo;let l=map.get(key);if(!l)map.set(key,l=[]);l.push(o);}
  return {map,corte:json.corte};
 }
 function buscar({indice,idOrigen,tipo,lat,lon,kms,casetasModelo}){
  const lista=(indice&&indice.map.get(idOrigen+'|'+tipo))||[];
  const filtraKm=Number(kms)>0,tol=filtraKm?Math.max(.10*kms,5):Infinity;
  const cand=lista.filter(r=>r.Kms==null||!filtraKm||Math.abs(r.Kms-kms)<=tol)
   .map(r=>({...r,dist:hav([lat,lon],[r.lat,r.lon]),kmSinDato:r.Kms==null,sinCasetas:(r.Base||0)+(r.Ajustes||0),aprox:r.Ancho>15}));
  let radio=RADIOS[0],sel=[];
  for(const R of RADIOS){radio=R;sel=cand.filter(r=>r.dist<=R);if(sel.length>=MIN_PINES)break;}
  const pines=sel.sort((a,b)=>a.dist-b.dist).slice(0,MAX_PINES);
  const conCas=pines.filter(p=>p.TieneCasetas&&p.Casetas>0);   // ZM16 en 0 no cuenta
  return {pines,radio,ampliado:radio>RADIOS[0],candidatos:cand.length,
   avisoCasetas:!(Number(casetasModelo)>0)&&conCas.length>0,
   casetasRefMediana:mediana(conCas.map(p=>p.Casetas)),refSinCasetas:mediana(pines.map(p=>p.sinCasetas)),refMediana:mediana(pines.map(p=>p.Mediana))};
 }
 return {RADIOS,TIPOS,tipoConexion,hav,mediana,precioCompacto,indexar,buscar};
});
