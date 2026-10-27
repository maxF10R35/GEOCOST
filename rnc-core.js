/* Clasificador estricto Red Nacional de Caminos INEGI/SICT, 2025.
   Atributos oficiales Tipo_Vial, Cond_Pav y Recubri. No confunde jerarquía con pavimento. */
(function(root,factory){const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;if(root)root.GCRNCCore=x;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const pick=(p,k)=>{const a=Object.keys(p||{}).find(x=>x.toLowerCase()===k.toLowerCase());return a?p[a]:''};
 const normal=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
 const unknown=new Set(['','n/a','n/d','no aplica','no disponible','no determinado','indeterminado','desconocido','null']);
 function classify(properties={}){
  const type=normal(pick(properties,'Tipo_Vial')||pick(properties,'tipo_vial')||pick(properties,'tipo'));
  const cond=normal(pick(properties,'Cond_Pav')||pick(properties,'cond_pav'));
  const material=normal(pick(properties,'Recubri')||pick(properties,'recubri'));
  const source='RNC INEGI/SICT';
  if(/vereda|sendero|peatonal/.test(type))return {base:null,reason:'No apto como vía vehicular',source};
  const unpaved=/sin pavimento|no paviment|terracer|revestid/.test(cond)||/^(grava|tierra|arena|gravel|dirt)$/.test(material);
  const paved=/con pavimento|pavimentado/.test(cond)||/^(asfalto|concreto|bloques|adoquin|adoquines)$/.test(material);
  if(unpaved)return {base:'terraceria',reason:`Rodamiento no pavimentado (${cond||material})`,source};
  if(/autopista/.test(type)&&paved)return {base:'autopista',reason:'Autopista y rodamiento pavimentado explícitos',source};
  if(paved)return {base:'pavimento',reason:`Rodamiento pavimentado (${cond||material})`,source};
  if(/^(calle|avenida|boulevard|bulevar|vialidad|calzada|eje vial)$/.test(type))return {base:'urbano',reason:'Tipo vial urbano; superficie no especificada',source,urbanSurfaceUnknown:true};
  return {base:null,reason:'RNC sin evidencia suficiente de rodamiento; no se infiere por ser carretera',source};
 }
 function toWay(feature,index=0){
  if(!feature||feature.type!=='Feature')return [];
  const p=feature.properties||{},g=feature.geometry||{},lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
  return lines.filter(l=>l&&l.length>1).map((line,i)=>({id:`rnc-${String(pick(p,'Id_Red')||feature.id||index)}-${i}`,tags:{rnc:true,rncProps:p},geometry:line.filter(pt=>Array.isArray(pt)&&Number.isFinite(pt[0])&&Number.isFinite(pt[1])&&Math.abs(pt[0])<=180&&Math.abs(pt[1])<=90).map(pt=>({lon:pt[0],lat:pt[1]}))})).filter(w=>w.geometry.length>1);
 }
 return {classify,toWay,normal};
});
