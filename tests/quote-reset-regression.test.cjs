'use strict';
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const begin=src.indexOf('// V4: el error de una cotización');
const end=src.indexOf("$('draw').type='button'",begin);
assert.ok(begin>0&&end>begin,'Existe flujo V4 de cotización');
const code=src.slice(begin,end);
const stub=()=>({addTo(x){return this},bindPopup(){return this},on(){return this}});
let fetchCalls=0, throwingRender=false, failFetch=false, button={disabled:false,textContent:'Calcular ruta y cotizar'};
const origin={name:'Bodega A',ll:[19,-99]},dest={nombre:'Cliente B',ll:[19.4,-99.5]};
const ctx={console:{error(){}},Math,Number,String,Error,Promise,quoteRequest:0,activeComparison:null,originQuotes:[],selectedSite:origin,selectedDest:dest,route:null,lastRouted:[],terrainSamples:null,
 findSite:()=>origin,findFront:()=>dest,dist:()=>18,panel:()=>{},validate:()=>true,gcRouteMode:()=> 'reference',gcRoutingProfile:()=>({planningSpeedKmh:65}),$:(id)=>id==='draw'?button:{innerHTML:''},setStatus:message=>{ctx.status=message},
 map:{fitBounds(){}},L:{latLngBounds:()=>({pad(){return this}}),marker:stub},routingLayer:{clearLayers(){}},extraLayer:{clearLayers(){}},heatLayer:{clearLayers(){}},
 renderSelectableRoutes:()=>{},activateSelectedRoute:()=>{if(throwingRender)throw new Error('Simulated UI renderer failure')},escapeHtml:s=>s,
 fetch:async()=>{fetchCalls++;if(failFetch)throw new Error('OSRM no disponible');return {ok:true,json:async()=>({code:'Ok',routes:[{distance:35000,duration:3000,geometry:{coordinates:[[-99,19],[-99.5,19.4]]}}]})}},
 AbortSignal:{timeout:()=>{}},
};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 // Fallo en representación posterior a OSRM: se conserva trazado y no se reinicia.
 throwingRender=true;
 await ctx.goRoute({preventDefault(){}});
 assert.equal(ctx.route.km,35);
 assert.equal(ctx.lastRouted.length,1);
 assert.equal(button.disabled,false);
 assert.match(ctx.status,/carretera fue calculada.*falló el análisis/i);
 // Fallo externo posterior: tampoco borra la ruta anterior.
 failFetch=true;
 await ctx.goRoute({preventDefault(){}});
 assert.equal(ctx.route.km,35);
 assert.equal(ctx.lastRouted.length,1);
 assert.match(ctx.status,/Conservamos la última cotización/i);
 // Bloqueo de clics duplicados mientras se consulta, sin limpiar el resultado.
 vm.runInContext("routeBusy=true",ctx);
 const oldCalls=fetchCalls;
 await ctx.goRoute({preventDefault(){}});
 assert.equal(fetchCalls,oldCalls);
 assert.equal(ctx.route.km,35);
 assert.equal(vm.runInContext("routeBusy",ctx),true);
 console.log('PASS: ruta preservada ante fallo de render, error OSRM y doble clic; no se borra el presupuesto.');
})().catch(e=>{console.error(e);process.exitCode=1});
